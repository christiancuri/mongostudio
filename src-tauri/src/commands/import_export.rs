use tauri::State;

use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub async fn import_data(
    _state: State<'_, AppState>,
    _connection_id: String,
    _database: String,
    _collection: String,
    _file_path: String,
    _format: String,
) -> AppResult<serde_json::Value> {
    // TODO: Implement import
    Ok(serde_json::json!({ "imported": 0 }))
}

#[tauri::command]
pub async fn export_data(
    _state: State<'_, AppState>,
    _connection_id: String,
    _database: String,
    _collection: String,
    _file_path: String,
    _format: String,
) -> AppResult<serde_json::Value> {
    // TODO: Implement export
    Ok(serde_json::json!({ "exported": 0 }))
}
