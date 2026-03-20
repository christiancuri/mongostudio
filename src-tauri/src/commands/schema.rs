use tauri::State;

use crate::error::AppResult;
use crate::models::schema::SchemaAnalysisResult;
use crate::services::schema_analyzer;
use crate::state::AppState;

#[tauri::command]
pub async fn analyze_schema(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    collection: String,
    sample_size: Option<u64>,
) -> AppResult<SchemaAnalysisResult> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    schema_analyzer::analyze_collection_schema(
        client,
        &database,
        &collection,
        sample_size.unwrap_or(1000),
    )
    .await
}
