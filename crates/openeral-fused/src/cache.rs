use crate::error::{Error, Result};
use crate::model::{now_ns, ChunkWrite, DataSnapshot, Node, CHUNK_SIZE};
use crate::store::PgStore;
use dashmap::DashMap;
use parking_lot::Mutex;
use std::collections::BTreeMap;
use std::sync::Arc;

pub const MAX_DIRTY_PER_INODE: usize = 16 * 1024 * 1024;
pub const MAX_DIRTY_GLOBAL: usize = 64 * 1024 * 1024;

#[derive(Clone)]
struct DirtyChunk {
    data: Vec<u8>,
    sequence: u64,
}

struct InodeData {
    size: i64,
    mtime_ns: i64,
    next_sequence: u64,
    dirty: BTreeMap<i64, DirtyChunk>,
    writeback_error: Option<String>,
}

pub struct InodeState {
    node_id: i64,
    inner: Mutex<InodeData>,
    writeback: tokio::sync::Mutex<()>,
}

impl InodeState {
    fn new(node: &Node) -> Self {
        Self {
            node_id: node.node_id,
            inner: Mutex::new(InodeData {
                size: node.size,
                mtime_ns: node.mtime_ns,
                next_sequence: 1,
                dirty: BTreeMap::new(),
                writeback_error: None,
            }),
            writeback: tokio::sync::Mutex::new(()),
        }
    }

    pub async fn lock_writeback(&self) -> tokio::sync::MutexGuard<'_, ()> {
        self.writeback.lock().await
    }

    pub async fn prepare_chunks(&self, store: &PgStore, offset: u64, len: usize) -> Result<()> {
        if len == 0 {
            return Ok(());
        }
        let first = (offset as usize / CHUNK_SIZE) as i64;
        let last = ((offset as usize + len - 1) / CHUNK_SIZE) as i64;
        let missing = {
            let inner = self.inner.lock();
            (first..=last)
                .filter(|index| !inner.dirty.contains_key(index))
                .collect::<Vec<_>>()
        };
        for index in missing {
            let mut data = store.read_chunk(self.node_id, index).await?;
            data.resize(CHUNK_SIZE, 0);
            let mut inner = self.inner.lock();
            inner
                .dirty
                .entry(index)
                .or_insert(DirtyChunk { data, sequence: 0 });
        }
        Ok(())
    }

    pub fn write(&self, offset: u64, bytes: &[u8]) -> Result<u64> {
        let mut inner = self.inner.lock();
        if let Some(error) = &inner.writeback_error {
            return Err(Error::Internal(format!("prior writeback failed: {error}")));
        }
        let sequence = inner.next_sequence;
        inner.next_sequence += 1;
        let mut consumed = 0;
        while consumed < bytes.len() {
            let absolute = offset as usize + consumed;
            let index = (absolute / CHUNK_SIZE) as i64;
            let within = absolute % CHUNK_SIZE;
            let count = (CHUNK_SIZE - within).min(bytes.len() - consumed);
            let chunk = inner
                .dirty
                .get_mut(&index)
                .ok_or_else(|| Error::Internal("write chunk was not prepared".into()))?;
            chunk.data[within..within + count].copy_from_slice(&bytes[consumed..consumed + count]);
            chunk.sequence = sequence;
            consumed += count;
        }
        inner.size = inner.size.max((offset as usize + bytes.len()) as i64);
        inner.mtime_ns = now_ns();
        Ok(sequence)
    }

    pub async fn read(&self, store: &PgStore, offset: u64, size: u32) -> Result<Vec<u8>> {
        let file_size = self.inner.lock().size.max(0) as u64;
        if offset >= file_size || size == 0 {
            return Ok(Vec::new());
        }
        let end = (offset + u64::from(size)).min(file_size);
        let mut output = Vec::with_capacity((end - offset) as usize);
        let first = (offset as usize / CHUNK_SIZE) as i64;
        let last = ((end as usize - 1) / CHUNK_SIZE) as i64;
        for index in first..=last {
            let cached = self
                .inner
                .lock()
                .dirty
                .get(&index)
                .map(|chunk| chunk.data.clone());
            let mut data = match cached {
                Some(data) => data,
                None => store.read_chunk(self.node_id, index).await?,
            };
            data.resize(CHUNK_SIZE, 0);
            let chunk_start = index as u64 * CHUNK_SIZE as u64;
            let from = offset.saturating_sub(chunk_start) as usize;
            let to = (end.saturating_sub(chunk_start) as usize).min(CHUNK_SIZE);
            if to > from {
                output.extend_from_slice(&data[from..to]);
            }
        }
        Ok(output)
    }

    #[must_use]
    pub fn snapshot(&self) -> Option<DataSnapshot> {
        let inner = self.inner.lock();
        let through_sequence = inner
            .dirty
            .values()
            .filter(|chunk| chunk.sequence > 0)
            .map(|chunk| chunk.sequence)
            .max()?;
        let chunks = inner
            .dirty
            .iter()
            .filter(|(_, chunk)| chunk.sequence > 0)
            .filter_map(|(index, chunk)| {
                let start = *index * CHUNK_SIZE as i64;
                if start >= inner.size {
                    return None;
                }
                let stored_len = (inner.size - start).min(CHUNK_SIZE as i64) as usize;
                Some(ChunkWrite {
                    index: *index,
                    data: chunk.data[..stored_len].to_vec(),
                })
            })
            .collect::<Vec<_>>();
        if chunks.is_empty() {
            return None;
        }
        Some(DataSnapshot {
            node_id: self.node_id,
            through_sequence,
            size: inner.size,
            mtime_ns: inner.mtime_ns,
            chunks,
        })
    }

    pub fn committed(&self, snapshot: &DataSnapshot) {
        let mut inner = self.inner.lock();
        inner
            .dirty
            .retain(|_, chunk| chunk.sequence > snapshot.through_sequence);
    }

    pub fn truncate_local(&self, size: i64) {
        let mut inner = self.inner.lock();
        inner.size = size;
        let first_removed = (size + CHUNK_SIZE as i64 - 1) / CHUNK_SIZE as i64;
        inner.dirty.retain(|index, _| *index < first_removed);
        if size > 0 && size % CHUNK_SIZE as i64 != 0 {
            let retained = size / CHUNK_SIZE as i64;
            if let Some(chunk) = inner.dirty.get_mut(&retained) {
                chunk.data[(size as usize % CHUNK_SIZE)..].fill(0);
            }
        }
        inner.mtime_ns = now_ns();
    }

    #[must_use]
    pub fn dirty_bytes(&self) -> usize {
        self.inner
            .lock()
            .dirty
            .values()
            .filter(|chunk| chunk.sequence > 0)
            .map(|chunk| chunk.data.len())
            .sum()
    }

    #[must_use]
    pub fn size(&self) -> i64 {
        self.inner.lock().size
    }

    pub fn record_error(&self, error: impl ToString) {
        let mut inner = self.inner.lock();
        if inner.writeback_error.is_none() {
            inner.writeback_error = Some(error.to_string());
        }
    }

    #[must_use]
    pub fn writeback_error(&self) -> Option<String> {
        self.inner.lock().writeback_error.clone()
    }

    pub fn discard_dirty_as_error(&self, reason: &str) {
        let mut inner = self.inner.lock();
        if !inner.dirty.is_empty() {
            inner.dirty.clear();
            if inner.writeback_error.is_none() {
                inner.writeback_error = Some(reason.to_string());
            }
        }
    }
}

#[derive(Default)]
pub struct DirtyCache {
    inodes: DashMap<i64, Arc<InodeState>>,
}

impl DirtyCache {
    pub fn state_for(&self, node: &Node) -> Arc<InodeState> {
        Arc::clone(
            self.inodes
                .entry(node.node_id)
                .or_insert_with(|| Arc::new(InodeState::new(node)))
                .value(),
        )
    }

    pub fn existing(&self, node_id: i64) -> Option<Arc<InodeState>> {
        self.inodes
            .get(&node_id)
            .map(|value| Arc::clone(value.value()))
    }

    pub fn states(&self) -> Vec<Arc<InodeState>> {
        self.inodes
            .iter()
            .map(|entry| Arc::clone(entry.value()))
            .collect()
    }

    #[must_use]
    pub fn dirty_bytes(&self) -> usize {
        self.inodes.iter().map(|entry| entry.dirty_bytes()).sum()
    }

    pub fn first_error(&self) -> Option<String> {
        self.inodes.iter().find_map(|entry| entry.writeback_error())
    }

    pub fn discard_all_as_error(&self, reason: &str) {
        for state in self.states() {
            state.discard_dirty_as_error(reason);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::NodeKind;

    fn node() -> Node {
        Node {
            node_id: 2,
            kind: NodeKind::File,
            mode: 0o644,
            uid: 1000,
            gid: 1000,
            size: 0,
            nlink: 1,
            atime_ns: 0,
            mtime_ns: 0,
            ctime_ns: 0,
            generation: 1,
            symlink_target: None,
            deleted: false,
        }
    }

    #[test]
    fn commit_does_not_clear_a_chunk_modified_after_snapshot() {
        let state = InodeState::new(&node());
        state.inner.lock().dirty.insert(
            0,
            DirtyChunk {
                data: vec![0; CHUNK_SIZE],
                sequence: 1,
            },
        );
        {
            let mut inner = state.inner.lock();
            inner.next_sequence = 2;
            inner.size = CHUNK_SIZE as i64;
        }
        let snapshot = state.snapshot().unwrap();
        state.write(0, b"new").unwrap();
        state.committed(&snapshot);
        assert_eq!(state.dirty_bytes(), CHUNK_SIZE);
    }

    #[test]
    fn truncate_drops_dirty_chunks_beyond_eof() {
        let state = InodeState::new(&node());
        for index in 0..3 {
            state.inner.lock().dirty.insert(
                index,
                DirtyChunk {
                    data: vec![1; CHUNK_SIZE],
                    sequence: 1,
                },
            );
        }
        state.truncate_local((CHUNK_SIZE + 10) as i64);
        assert_eq!(state.dirty_bytes(), CHUNK_SIZE * 2);
        assert!(state.inner.lock().dirty[&1].data[10..]
            .iter()
            .all(|byte| *byte == 0));
    }

    #[test]
    fn snapshot_omits_clean_preload_and_trims_the_last_chunk() {
        let state = InodeState::new(&node());
        state.inner.lock().dirty.insert(
            0,
            DirtyChunk {
                data: vec![0; CHUNK_SIZE],
                sequence: 0,
            },
        );
        assert!(state.snapshot().is_none());
        assert_eq!(state.dirty_bytes(), 0);

        state.inner.lock().next_sequence = 1;
        state.write(0, b"small").unwrap();
        let snapshot = state.snapshot().unwrap();
        assert_eq!(snapshot.chunks.len(), 1);
        assert_eq!(snapshot.chunks[0].data, b"small");
    }
}
