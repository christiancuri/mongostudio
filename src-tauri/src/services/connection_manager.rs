use std::collections::HashMap;

use mongodb::{options::ClientOptions, Client};

use crate::error::{AppError, AppResult};
use crate::models::connection::ConnectionConfig;

pub struct ManagedConnection {
    pub config: ConnectionConfig,
    pub client: Client,
}

pub struct ConnectionManager {
    connections: HashMap<String, ManagedConnection>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    pub async fn connect(&mut self, config: &ConnectionConfig) -> AppResult<()> {
        let conn_str = config.to_connection_string();
        let client_options = ClientOptions::parse(&conn_str)
            .await
            .map_err(|e| AppError::Connection(e.to_string()))?;
        let client =
            Client::with_options(client_options).map_err(|e| AppError::Connection(e.to_string()))?;

        // Test the connection
        client
            .list_database_names()
            .await
            .map_err(|e| AppError::Connection(e.to_string()))?;

        self.connections.insert(
            config.id.clone(),
            ManagedConnection {
                config: config.clone(),
                client,
            },
        );
        Ok(())
    }

    pub fn disconnect(&mut self, id: &str) -> AppResult<()> {
        self.connections
            .remove(id)
            .ok_or_else(|| AppError::ConnectionNotFound(id.to_string()))?;
        Ok(())
    }

    pub fn get_client(&self, id: &str) -> AppResult<&Client> {
        self.connections
            .get(id)
            .map(|c| &c.client)
            .ok_or_else(|| AppError::ConnectionNotFound(id.to_string()))
    }

    #[allow(dead_code)]
    pub fn get_config(&self, id: &str) -> AppResult<&ConnectionConfig> {
        self.connections
            .get(id)
            .map(|c| &c.config)
            .ok_or_else(|| AppError::ConnectionNotFound(id.to_string()))
    }

    #[allow(dead_code)]
    pub fn is_connected(&self, id: &str) -> bool {
        self.connections.contains_key(id)
    }

    #[allow(dead_code)]
    pub fn connected_ids(&self) -> Vec<String> {
        self.connections.keys().cloned().collect()
    }
}
