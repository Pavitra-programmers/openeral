use crate::connect::{connect, datasource_hash};
use crate::error::{Error, Result};
use crate::model::SCHEMA_VERSION;
use crate::store::PgStore;
use parking_lot::{Condvar, Mutex};
use serde::Deserialize;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

pub const DEFAULT_RUNTIME_DIR: &str = "/var/lib/openeral/runtime";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseReadyMarker {
    version: u32,
    workspace_id: String,
    datasource_hash: String,
    schema_version: i32,
}

enum State {
    Initializing {
        last_error: Option<String>,
    },
    Ready {
        store: Arc<PgStore>,
        datasource_hash: String,
    },
    Fenced {
        reason: String,
    },
}

pub struct RuntimeState {
    state: Mutex<State>,
    changed: Condvar,
    fatal: tokio::sync::Notify,
    workspace_id: String,
    runtime_dir: PathBuf,
}

impl RuntimeState {
    #[must_use]
    pub fn new(workspace_id: String, runtime_dir: PathBuf) -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(State::Initializing { last_error: None }),
            changed: Condvar::new(),
            fatal: tokio::sync::Notify::new(),
            workspace_id,
            runtime_dir,
        })
    }

    #[must_use]
    pub fn from_environment() -> Arc<Self> {
        let workspace_id = std::env::var("WORKSPACE_ID")
            .or_else(|_| std::env::var("OPENSHELL_SANDBOX_ID"))
            .or_else(|_| std::env::var("OPENERAL_WORKSPACE_ID"))
            .unwrap_or_else(|_| "default".to_string());
        let runtime_dir = std::env::var_os("OPENERAL_RUNTIME_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(DEFAULT_RUNTIME_DIR));
        Self::new(workspace_id, runtime_dir)
    }

    pub fn wait_store(&self, timeout: Duration) -> Result<Arc<PgStore>> {
        let mut state = self.state.lock();
        let deadline = std::time::Instant::now() + timeout;
        loop {
            match &*state {
                State::Ready { store, .. } => return Ok(Arc::clone(store)),
                State::Fenced { .. } => return Err(Error::Fenced),
                State::Initializing { .. } => {
                    let remaining = deadline.saturating_duration_since(std::time::Instant::now());
                    if remaining.is_zero() {
                        return Err(Error::Initializing);
                    }
                    self.changed.wait_for(&mut state, remaining);
                }
            }
        }
    }

    #[must_use]
    pub fn ready_store(&self) -> Option<Arc<PgStore>> {
        match &*self.state.lock() {
            State::Ready { store, .. } => Some(Arc::clone(store)),
            _ => None,
        }
    }

    pub async fn wait_fatal(&self) {
        self.fatal.notified().await;
    }

    #[must_use]
    pub fn health_json(
        &self,
        dirty_bytes: usize,
        writeback_error: Option<&str>,
    ) -> serde_json::Value {
        match &*self.state.lock() {
            State::Initializing { last_error } => json!({
                "state": "initializing",
                "workspaceId": self.workspace_id,
                "schemaVersion": SCHEMA_VERSION,
                "dirtyBytes": dirty_bytes,
                "lastWritebackError": writeback_error,
                "lastInitializationError": last_error,
            }),
            State::Ready {
                store,
                datasource_hash,
            } => json!({
                "state": "writable",
                "workspaceId": store.workspace_id(),
                "volumeId": store.volume_id(),
                "datasourceHash": datasource_hash,
                "schemaVersion": SCHEMA_VERSION,
                "leaseOwner": store.owner_id(),
                "leaseEpoch": store.epoch(),
                "dirtyBytes": dirty_bytes,
                "lastWritebackError": writeback_error,
            }),
            State::Fenced { reason } => json!({
                "state": "fenced",
                "workspaceId": self.workspace_id,
                "schemaVersion": SCHEMA_VERSION,
                "reason": reason,
                "dirtyBytes": dirty_bytes,
                "lastWritebackError": writeback_error,
            }),
        }
    }

    fn set_initialization_error(&self, error: impl ToString) {
        let mut state = self.state.lock();
        if matches!(*state, State::Initializing { .. }) {
            *state = State::Initializing {
                last_error: Some(error.to_string()),
            };
        }
        self.changed.notify_all();
    }

    fn set_ready(&self, store: Arc<PgStore>, hash: String) {
        *self.state.lock() = State::Ready {
            store,
            datasource_hash: hash,
        };
        self.changed.notify_all();
    }

    pub fn fence(&self, reason: impl ToString) {
        *self.state.lock() = State::Fenced {
            reason: reason.to_string(),
        };
        self.changed.notify_all();
        // Only the daemon main loop waits for this notification. notify_one
        // retains a permit if fencing races ahead of that waiter.
        self.fatal.notify_one();
    }

    fn database_url_path(&self) -> PathBuf {
        self.runtime_dir.join("database-url")
    }

    fn database_ready_path(&self) -> PathBuf {
        self.runtime_dir.join("database.ready")
    }
}

pub async fn coordinate_database(state: Arc<RuntimeState>) {
    loop {
        match try_activate(&state).await {
            Ok(Some((store, hash))) => {
                if let Err(error) = store.startup_gc().await {
                    state.fence(format!("startup orphan collection failed: {error}"));
                    return;
                }
                state.set_ready(Arc::clone(&store), hash.clone());
                monitor_lease_and_marker(&state, &store, &hash).await;
                return;
            }
            Ok(None) => {}
            Err(error) => {
                state.set_initialization_error(&error);
                tracing::warn!(error = %error, "filesystem database is not ready yet");
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

async fn try_activate(state: &RuntimeState) -> Result<Option<(Arc<PgStore>, String)>> {
    if !state.database_ready_path().exists() || !state.database_url_path().exists() {
        return Ok(None);
    }
    let marker: DatabaseReadyMarker = read_json(&state.database_ready_path()).await?;
    if marker.version != 1
        || marker.workspace_id != state.workspace_id
        || marker.schema_version != SCHEMA_VERSION
    {
        return Err(Error::Invalid(
            "database.ready identity or schema does not match this sandbox".into(),
        ));
    }
    let database_url = tokio::fs::read_to_string(state.database_url_path())
        .await?
        .trim()
        .to_string();
    if database_url.is_empty() {
        return Err(Error::Invalid("database-url is empty".into()));
    }
    let hash = datasource_hash(&database_url);
    if marker.datasource_hash != hash {
        return Err(Error::Invalid(
            "database.ready datasource hash does not match database-url".into(),
        ));
    }
    let connected = connect(&database_url).await?;
    let uid = unsafe { libc::geteuid() };
    let gid = unsafe { libc::getegid() };
    let store = Arc::new(
        PgStore::open(
            connected,
            database_url,
            state.workspace_id.clone(),
            uid,
            gid,
        )
        .await?,
    );
    Ok(Some((store, hash)))
}

async fn monitor_lease_and_marker(state: &RuntimeState, store: &PgStore, hash: &str) {
    let mut ticker = tokio::time::interval(Duration::from_secs(3));
    let mut terminal_fence = store.subscribe_terminal_fence();
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tokio::select! {
            _ = ticker.tick() => {
                if let Err(error) = verify_marker_identity(state, hash).await {
                    state.fence(format!("database readiness changed: {error}"));
                    return;
                }
                if let Err(error) = store.heartbeat().await {
                    state.fence(format!("writer lease lost: {error}"));
                    return;
                }
            }
            changed = terminal_fence.changed() => {
                let reason = if changed.is_ok() {
                    terminal_fence
                        .borrow()
                        .clone()
                        .unwrap_or_else(|| "filesystem requested terminal fencing".to_string())
                } else {
                    "filesystem terminal-fence channel closed".to_string()
                };
                state.fence(reason);
                return;
            }
        }
    }
}

async fn verify_marker_identity(state: &RuntimeState, expected_hash: &str) -> Result<()> {
    let marker: DatabaseReadyMarker = read_json(&state.database_ready_path()).await?;
    if marker.version != 1
        || marker.workspace_id != state.workspace_id
        || marker.schema_version != SCHEMA_VERSION
        || marker.datasource_hash != expected_hash
    {
        return Err(Error::Fenced);
    }
    Ok(())
}

async fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
    let bytes = tokio::fs::read(path).await?;
    Ok(serde_json::from_slice(&bytes)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_runtime_wait_is_bounded_and_returns_eio_class() {
        let runtime = RuntimeState::new("test".into(), PathBuf::from("/nonexistent"));
        let started = std::time::Instant::now();
        let error = match runtime.wait_store(Duration::from_millis(10)) {
            Ok(_) => panic!("an unavailable runtime unexpectedly became ready"),
            Err(error) => error,
        };
        assert!(matches!(error, Error::Initializing));
        assert!(started.elapsed() < Duration::from_secs(1));
        assert_eq!(error.errno().code(), fuser::Errno::EIO.code());
    }
}
