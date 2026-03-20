use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::connection::ConnectionConfig;
use crate::state::AppState;

#[tauri::command]
pub async fn connect(state: State<'_, AppState>, config: ConnectionConfig) -> AppResult<String> {
    let mut manager = state.connections.write().await;
    manager.connect(&config).await?;
    Ok(config.id.clone())
}

#[tauri::command]
pub async fn disconnect(state: State<'_, AppState>, connection_id: String) -> AppResult<()> {
    let mut manager = state.connections.write().await;
    manager.disconnect(&connection_id)
}

#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> AppResult<String> {
    let conn_str = config.to_connection_string();
    let client_options = mongodb::options::ClientOptions::parse(&conn_str)
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;
    let client = mongodb::Client::with_options(client_options)
        .map_err(|e| AppError::Connection(e.to_string()))?;
    client
        .list_database_names()
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;
    Ok("Connection successful".to_string())
}

#[tauri::command]
pub async fn list_saved_connections() -> AppResult<Vec<ConnectionConfig>> {
    // TODO: Load from tauri-plugin-store
    Ok(vec![])
}

#[tauri::command]
pub async fn save_connection(_config: ConnectionConfig) -> AppResult<()> {
    // TODO: Save to tauri-plugin-store
    Ok(())
}

#[tauri::command]
pub async fn delete_connection(_connection_id: String) -> AppResult<()> {
    // TODO: Delete from tauri-plugin-store
    Ok(())
}
