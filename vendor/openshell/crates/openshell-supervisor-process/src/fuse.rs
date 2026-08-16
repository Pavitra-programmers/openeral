// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! Privileged FUSE mount preparation and unprivileged daemon launch.

use crate::netns::NetworkNamespace;
use crate::process::{
    InheritedFd, ProcessEnforcementMode, ProcessHandle, ResolvedProcessIdentity, ResolvedWorkspace,
};
use miette::{IntoDiagnostic, Result};
use nix::unistd::{Gid, Uid, User};
use openshell_core::policy::{FuseMountPolicy, SandboxPolicy};
use std::collections::HashMap;
use std::ffi::CString;
use std::fs::OpenOptions;
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, Instant};

const FUSE_FD_FLOOR: i32 = 200;
const FUSE_READY_BYTE: u8 = 1;

#[derive(Debug, Clone, Copy)]
struct ExecutableIdentity {
    device: u64,
    inode: u64,
}

/// A mounted FUSE connection that has not yet been handed to its daemon.
pub struct PreparedFuseMount {
    declaration: FuseMountPolicy,
    fuse_fd: OwnedFd,
    ready_read: OwnedFd,
    ready_write: OwnedFd,
    executable_identity: ExecutableIdentity,
}

/// A supervisor-managed critical FUSE daemon.
pub struct FuseDaemon {
    pub handle: ProcessHandle,
}

/// Validate request/policy consistency and prepare the privileged mount.
pub fn prepare(
    policy: &SandboxPolicy,
    workspace: &ResolvedWorkspace,
    resolved_identity: ResolvedProcessIdentity,
    ssh_socket_path: Option<&Path>,
) -> Result<Option<PreparedFuseMount>> {
    let requested =
        std::env::var(openshell_core::sandbox_env::FUSE_REQUESTED).is_ok_and(|value| value == "1");
    match (requested, policy.fuse_mounts.as_slice()) {
        (false, []) => return Ok(None),
        (false, _) => {
            return Err(miette::miette!(
                "image policy declares FUSE but the sandbox request did not include --fuse"
            ));
        }
        (true, []) => {
            return Err(miette::miette!(
                "sandbox requested FUSE but image policy declares no fuse_mounts"
            ));
        }
        (true, [declaration]) => {
            validate_runtime_declaration(declaration, workspace, ssh_socket_path)?;
        }
        (true, mounts) => {
            return Err(miette::miette!(
                "v1 supports exactly one FUSE mount, got {}",
                mounts.len()
            ));
        }
    }

    let declaration = policy.fuse_mounts[0].clone();
    let executable_identity = validate_executable(&declaration.binary)?;
    prepare_mountpoint(&declaration.mountpoint)?;
    let (uid, gid) = effective_mount_identity(policy, resolved_identity)?;
    let fuse_fd = open_fuse_device()?;
    mount_fuse(&declaration, fuse_fd.as_raw_fd(), uid, gid)?;
    let (ready_read, ready_write) = nonblocking_pipe()?;

    Ok(Some(PreparedFuseMount {
        declaration,
        fuse_fd,
        ready_read,
        ready_write,
        executable_identity,
    }))
}

impl PreparedFuseMount {
    /// Spawn the daemon through the normal sandboxed child path and wait for
    /// its FUSE INIT readiness signal.
    #[allow(clippy::too_many_arguments)]
    pub async fn spawn(
        self,
        policy: &SandboxPolicy,
        resolved_identity: ResolvedProcessIdentity,
        enforcement_mode: ProcessEnforcementMode,
        netns: Option<&NetworkNamespace>,
        ca_paths: Option<&(PathBuf, PathBuf)>,
    ) -> Result<FuseDaemon> {
        let current = validate_executable(&self.declaration.binary)?;
        if current.device != self.executable_identity.device
            || current.inode != self.executable_identity.inode
        {
            return Err(miette::miette!(
                "FUSE daemon executable changed between validation and spawn"
            ));
        }

        let fuse_mapping = InheritedFd::duplicate_at_least(
            self.fuse_fd,
            FUSE_FD_FLOOR,
            format!("{}0", openshell_core::sandbox_env::FUSE_FD_PREFIX),
        )
        .into_diagnostic()?;
        let readiness_mapping = InheritedFd::duplicate_at_least(
            self.ready_write,
            FUSE_FD_FLOOR,
            format!("{}1", openshell_core::sandbox_env::FUSE_FD_PREFIX),
        )
        .into_diagnostic()?;
        let mappings = [fuse_mapping, readiness_mapping];
        // The daemon starts in `/` so it never depends on its own not-yet-served
        // mount, but that directory must not become a Landlock read-write grant:
        // `include_workdir` would otherwise add the workspace root ("/") to the
        // daemon's ruleset and disable Landlock for it entirely. The daemon gets
        // exactly the static filesystem policy, nothing more.
        let daemon_workspace = ResolvedWorkspace::new(Some("/".to_string()), false);
        let mut daemon_policy = policy.clone();
        daemon_policy.filesystem.include_workdir = false;
        let mut handle = ProcessHandle::spawn_with_inherited_fds(
            self.declaration.binary.to_string_lossy().as_ref(),
            &self.declaration.args,
            &daemon_workspace,
            false,
            &daemon_policy,
            resolved_identity,
            enforcement_mode,
            netns,
            ca_paths,
            &HashMap::new(),
            &mappings,
        )?;
        drop(mappings);

        wait_for_readiness(
            &self.ready_read,
            &mut handle,
            Duration::from_secs(u64::from(self.declaration.startup_timeout_seconds)),
        )
        .await?;
        Ok(FuseDaemon { handle })
    }
}

async fn wait_for_readiness(
    ready_read: &OwnedFd,
    handle: &mut ProcessHandle,
    timeout: Duration,
) -> Result<()> {
    let deadline = Instant::now() + timeout;
    let mut byte = [0_u8; 1];
    loop {
        #[allow(unsafe_code)]
        let count = unsafe { libc::read(ready_read.as_raw_fd(), byte.as_mut_ptr().cast(), 1) };
        if count == 1 {
            if byte[0] == FUSE_READY_BYTE {
                return Ok(());
            }
            return Err(miette::miette!(
                "FUSE daemon sent an invalid readiness byte"
            ));
        }
        if count == 0 {
            return Err(miette::miette!(
                "FUSE daemon closed its readiness channel before FUSE INIT"
            ));
        }
        let error = std::io::Error::last_os_error();
        if error.kind() != std::io::ErrorKind::WouldBlock {
            return Err(error).into_diagnostic();
        }
        if let Some(status) = handle.try_wait().into_diagnostic()? {
            return Err(miette::miette!(
                "FUSE daemon exited before readiness with status {}",
                status.code()
            ));
        }
        if Instant::now() >= deadline {
            let _ = handle.kill();
            return Err(miette::miette!("timed out waiting for FUSE INIT readiness"));
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

fn validate_runtime_declaration(
    declaration: &FuseMountPolicy,
    workspace: &ResolvedWorkspace,
    ssh_socket_path: Option<&Path>,
) -> Result<()> {
    let workspace = workspace
        .root()
        .ok_or_else(|| miette::miette!("FUSE requires a driver-resolved workspace root"))?;
    if workspace != "/sandbox" {
        return Err(miette::miette!(
            "FUSE v1 requires workspace root /sandbox, got {workspace}"
        ));
    }
    if declaration.mountpoint == Path::new(workspace)
        || !declaration.mountpoint.starts_with(workspace)
    {
        return Err(miette::miette!(
            "FUSE mountpoint must be below the workspace root"
        ));
    }
    if let Some(socket) = ssh_socket_path
        && (socket.starts_with(&declaration.mountpoint)
            || declaration.mountpoint.starts_with(socket))
    {
        return Err(miette::miette!(
            "FUSE mountpoint overlaps the OpenShell SSH control socket"
        ));
    }
    for path in [&declaration.binary, &declaration.mountpoint] {
        if !path.is_absolute()
            || path
                .components()
                .any(|part| matches!(part, Component::ParentDir))
        {
            return Err(miette::miette!(
                "FUSE binary and mountpoint must be normalized absolute paths"
            ));
        }
    }
    Ok(())
}

fn validate_executable(path: &Path) -> Result<ExecutableIdentity> {
    let metadata = std::fs::symlink_metadata(path).into_diagnostic()?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(miette::miette!(
            "FUSE daemon binary must be a regular non-symlink file"
        ));
    }
    if metadata.uid() != 0 || metadata.mode() & 0o022 != 0 || metadata.mode() & 0o111 == 0 {
        return Err(miette::miette!(
            "FUSE daemon binary must be root-owned, executable, and not group/world writable"
        ));
    }
    let mut current = path.parent();
    while let Some(parent) = current {
        let metadata = std::fs::symlink_metadata(parent).into_diagnostic()?;
        if metadata.file_type().is_symlink()
            || !metadata.is_dir()
            || metadata.uid() != 0
            || metadata.permissions().mode() & 0o022 != 0
        {
            return Err(miette::miette!(
                "FUSE daemon parent chain must be root-owned and not group/world writable"
            ));
        }
        current = parent.parent();
    }
    Ok(ExecutableIdentity {
        device: metadata.dev(),
        inode: metadata.ino(),
    })
}

fn prepare_mountpoint(path: &Path) -> Result<()> {
    // SECURITY: this name-based walk and the mount happen synchronously before
    // the supervisor exposes SSH or starts any workload process. A static image
    // can supply hostile path components, but cannot race this validation; every
    // existing component is therefore rejected if it is a symlink.
    let mut current = PathBuf::from("/");
    for component in path.components() {
        if matches!(component, Component::RootDir) {
            continue;
        }
        current.push(component.as_os_str());
        let metadata = match std::fs::symlink_metadata(&current) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                std::fs::create_dir(&current).into_diagnostic()?;
                std::fs::symlink_metadata(&current).into_diagnostic()?
            }
            Err(error) => return Err(error).into_diagnostic(),
        };
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(miette::miette!(
                "FUSE mountpoint contains a symlink or non-directory component"
            ));
        }
    }
    if std::fs::read_dir(path)
        .into_diagnostic()?
        .next()
        .transpose()
        .into_diagnostic()?
        .is_some()
    {
        return Err(miette::miette!("FUSE mountpoint must be empty"));
    }
    Ok(())
}

fn effective_mount_identity(
    policy: &SandboxPolicy,
    resolved_identity: ResolvedProcessIdentity,
) -> Result<(Uid, Gid)> {
    let (uid, gid, _) = crate::process::resolve_filesystem_identity(policy, resolved_identity)?;
    if let (Some(uid), Some(gid)) = (uid, gid) {
        return Ok((uid, gid));
    }
    let fallback = if uid.is_none() || gid.is_none() {
        User::from_name("sandbox")
            .into_diagnostic()?
            .ok_or_else(|| miette::miette!("sandbox user is required for FUSE"))?
    } else {
        unreachable!("complete identities returned above")
    };
    Ok((uid.unwrap_or(fallback.uid), gid.unwrap_or(fallback.gid)))
}

fn open_fuse_device() -> Result<OwnedFd> {
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .custom_flags(libc::O_CLOEXEC)
        .open("/dev/fuse")
        .into_diagnostic()?;
    Ok(file.into())
}

fn mount_fuse(declaration: &FuseMountPolicy, fuse_fd: i32, uid: Uid, gid: Gid) -> Result<()> {
    let source = CString::new(declaration.fs_name.as_bytes()).into_diagnostic()?;
    let target = CString::new(declaration.mountpoint.as_os_str().as_bytes()).into_diagnostic()?;
    let filesystem = CString::new("fuse").expect("static string");
    let mut options = format!(
        "fd={fuse_fd},rootmode=40000,user_id={},group_id={},default_permissions,max_read=1048576",
        uid.as_raw(),
        gid.as_raw()
    );
    if declaration.allow_other {
        options.push_str(",allow_other");
    }
    let options = CString::new(options).into_diagnostic()?;
    #[allow(unsafe_code)]
    let result = unsafe {
        libc::mount(
            source.as_ptr(),
            target.as_ptr(),
            filesystem.as_ptr(),
            libc::MS_NOSUID | libc::MS_NODEV | libc::MS_RELATIME,
            options.as_ptr().cast(),
        )
    };
    if result != 0 {
        return Err(std::io::Error::last_os_error()).into_diagnostic();
    }
    Ok(())
}

fn nonblocking_pipe() -> Result<(OwnedFd, OwnedFd)> {
    let mut fds = [-1_i32; 2];
    #[allow(unsafe_code)]
    let result = unsafe { libc::pipe2(fds.as_mut_ptr(), libc::O_CLOEXEC | libc::O_NONBLOCK) };
    if result != 0 {
        return Err(std::io::Error::last_os_error()).into_diagnostic();
    }
    #[allow(unsafe_code)]
    Ok(unsafe { (OwnedFd::from_raw_fd(fds[0]), OwnedFd::from_raw_fd(fds[1])) })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::symlink;

    #[test]
    fn runtime_declaration_rejects_workspace_as_mountpoint() {
        let declaration = FuseMountPolicy {
            binary: "/usr/local/bin/example-fused".into(),
            args: vec!["serve".into()],
            mountpoint: "/sandbox".into(),
            fs_name: "example".into(),
            allow_other: false,
            startup_timeout_seconds: 30,
        };
        let workspace = ResolvedWorkspace::new(Some("/sandbox".into()), false);
        assert!(validate_runtime_declaration(&declaration, &workspace, None).is_err());
    }

    #[test]
    fn runtime_declaration_accepts_child_mountpoint() {
        let declaration = FuseMountPolicy {
            binary: "/usr/local/bin/example-fused".into(),
            args: vec!["serve".into()],
            mountpoint: "/sandbox/work".into(),
            fs_name: "example".into(),
            allow_other: false,
            startup_timeout_seconds: 30,
        };
        let workspace = ResolvedWorkspace::new(Some("/sandbox".into()), false);
        validate_runtime_declaration(&declaration, &workspace, None).unwrap();
    }

    #[test]
    fn mountpoint_preparation_creates_an_empty_directory_tree() {
        let root = tempfile::tempdir().unwrap();
        let mountpoint = root.path().join("nested/work");

        prepare_mountpoint(&mountpoint).unwrap();

        assert!(mountpoint.is_dir());
        assert!(std::fs::read_dir(mountpoint).unwrap().next().is_none());
    }

    #[test]
    fn mountpoint_preparation_rejects_symlink_components() {
        let root = tempfile::tempdir().unwrap();
        let real = root.path().join("real");
        let link = root.path().join("link");
        std::fs::create_dir(&real).unwrap();
        symlink(&real, &link).unwrap();

        let error = prepare_mountpoint(&link.join("work")).unwrap_err();

        assert!(error.to_string().contains("symlink or non-directory"));
    }

    #[test]
    fn mountpoint_preparation_rejects_nonempty_directories() {
        let root = tempfile::tempdir().unwrap();
        let mountpoint = root.path().join("work");
        std::fs::create_dir(&mountpoint).unwrap();
        std::fs::write(mountpoint.join("unexpected"), b"data").unwrap();

        let error = prepare_mountpoint(&mountpoint).unwrap_err();

        assert!(error.to_string().contains("must be empty"));
    }
}
