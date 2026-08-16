use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const SCHEMA_VERSION: i32 = 1;
pub const CHUNK_SIZE: usize = 256 * 1024;
pub const FUSE_ROOT_INODE: u64 = 1;
pub const BLOCK_SIZE: u32 = 4096;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i16)]
pub enum NodeKind {
    File = 1,
    Directory = 2,
    Symlink = 3,
}

impl TryFrom<i16> for NodeKind {
    type Error = String;

    fn try_from(value: i16) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::File),
            2 => Ok(Self::Directory),
            3 => Ok(Self::Symlink),
            _ => Err(format!("unknown filesystem node kind {value}")),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Node {
    pub node_id: i64,
    pub kind: NodeKind,
    pub mode: i32,
    pub uid: i32,
    pub gid: i32,
    pub size: i64,
    pub nlink: i32,
    pub atime_ns: i64,
    pub mtime_ns: i64,
    pub ctime_ns: i64,
    pub symlink_target: Option<Vec<u8>>,
    pub deleted: bool,
}

#[derive(Debug, Clone)]
pub struct DirectoryEntry {
    pub name: Vec<u8>,
    pub node: Node,
}

#[derive(Debug, Clone)]
pub struct ChunkWrite {
    pub index: i64,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct DataSnapshot {
    pub node_id: i64,
    pub through_sequence: u64,
    pub size: i64,
    pub mtime_ns: i64,
    pub chunks: Vec<ChunkWrite>,
}

#[must_use]
pub fn now_ns() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .try_into()
        .unwrap_or(i64::MAX)
}

#[must_use]
pub fn ns_to_system_time(ns: i64) -> SystemTime {
    if ns <= 0 {
        UNIX_EPOCH
    } else {
        UNIX_EPOCH + Duration::from_nanos(ns as u64)
    }
}

pub fn validate_name(name: &[u8]) -> Result<(), &'static str> {
    if name.is_empty() || name.len() > 255 {
        return Err("filesystem names must contain 1-255 bytes");
    }
    if name == b"." || name == b".." || name.contains(&b'/') || name.contains(&0) {
        return Err("filesystem names may not be '.', '..', or contain slash/NUL");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_validation_matches_linux_component_rules() {
        assert!(validate_name(b"settings.json").is_ok());
        for invalid in [b"".as_slice(), b".", b"..", b"a/b", b"a\0b"] {
            assert!(validate_name(invalid).is_err());
        }
    }
}
