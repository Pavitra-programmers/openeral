# Historical FUSE Test Inventory

This inventory preserves useful behavior from `crates/openeral-core` without treating
the historical implementation as a production base. New tests belong under
`crates/openeral-fused` or `tests/fuse`; old tests remain unchanged until parity is
demonstrated.

## Reuse As Evidence

- inherited `/dev/fuse` fd parsing and mount-option coverage from
  `src/cli/fuse_fd.rs`;
- workspace create, lookup, list, update, delete, rename, seed, and cascade behavior
  from `tests/workspace_integration.rs`;
- metadata-only lookup behavior and inode/attribute conversion helpers;
- `O_TRUNC`, partial-write, rename-identity, and Supabase parameter-typing regressions
  recorded in historical commits and `FUSE.md`.

## Do Not Port As Architecture

- `workspace_files` path identity and whole-file rows;
- per-handle `Vec<u8>` write-back buffers;
- split `rename_file` and `rename_tree` operations;
- success after descendant-rename failure;
- daemon-owned Refinery migrations;
- direct PostgreSQL `NoTls` connections;
- background FUSE sessions kept alive with `thread::park()`;
- in-place unmount/remount recovery.

## Required New Coverage

- stable inode identity across file and directory rename;
- atomic replacement and `RENAME_NOREPLACE`;
- sparse, partial, and out-of-order chunk I/O;
- open-unlinked lifecycle and restart-time orphan collection;
- bounded coherent dirty state shared across handles;
- `fsync`, `fdatasync`, `O_SYNC`, and `O_DSYNC` durability;
- dirty-source rename and existing-file `O_TRUNC` close barriers;
- uncertain PostgreSQL commit deduplication by operation ID;
- lease expiry, stale-epoch fencing, and old-dirty-data discard;
- FUSE event-loop failure causing process exit rather than parking.
