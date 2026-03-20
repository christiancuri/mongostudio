use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub async fn server_status(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<serde_json::Value> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database("admin");
    let result = db
        .run_command(mongodb::bson::doc! { "serverStatus": 1 })
        .await
        .map_err(|e| AppError::Query(e.to_string()))?;
    serde_json::to_value(&result).map_err(|e| AppError::Query(e.to_string()))
}

#[tauri::command]
pub async fn current_operations(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<serde_json::Value> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database("admin");
    let result = db
        .run_command(mongodb::bson::doc! { "currentOp": 1 })
        .await
        .map_err(|e| AppError::Query(e.to_string()))?;
    serde_json::to_value(&result).map_err(|e| AppError::Query(e.to_string()))
}
