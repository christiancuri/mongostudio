use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::services::connection_manager::ConnectionManager;

pub struct AppState {
    pub connections: Arc<RwLock<ConnectionManager>>,
    /// Maps execution IDs to their cancel flags for in-flight query cancellation.
    pub running_executions: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(ConnectionManager::new())),
            running_executions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
