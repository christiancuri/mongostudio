use std::sync::Arc;
use tokio::sync::RwLock;

use crate::services::connection_manager::ConnectionManager;

pub struct AppState {
    pub connections: Arc<RwLock<ConnectionManager>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(ConnectionManager::new())),
        }
    }
}
