use std::time::Instant;

use mongodb::bson::Document;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::query::{ExplainResult, QueryRequest, QueryResult};
use crate::state::AppState;

#[tauri::command]
pub async fn execute_query(
    state: State<'_, AppState>,
    request: QueryRequest,
) -> AppResult<QueryResult> {
    let start = Instant::now();
    let manager = state.connections.read().await;
    let client = manager.get_client(&request.connection_id)?;
    let db = client.database(&request.database);
    let collection = db.collection::<Document>(&request.collection);

    let page = request.page.unwrap_or(1);
    let page_size = request.page_size.unwrap_or(50);
    let skip = (page - 1) * page_size;

    // For now, just do a simple find with empty filter
    // TODO: Use query_parser to parse query_text
    let filter = mongodb::bson::doc! {};
    let find_options = mongodb::options::FindOptions::builder()
        .skip(skip)
        .limit(page_size as i64)
        .build();

    let mut cursor = collection
        .find(filter.clone())
        .with_options(find_options)
        .await
        .map_err(|e| AppError::Query(e.to_string()))?;

    let mut documents = Vec::new();
    while cursor
        .advance()
        .await
        .map_err(|e| AppError::Query(e.to_string()))?
    {
        let doc = cursor
            .deserialize_current()
            .map_err(|e| AppError::Query(e.to_string()))?;
        let json =
            serde_json::to_value(&doc).map_err(|e| AppError::Query(e.to_string()))?;
        documents.push(json);
    }

    let total_count = collection
        .count_documents(filter)
        .await
        .ok()
        .map(|c| c as i64);

    Ok(QueryResult {
        documents,
        total_count,
        execution_time_ms: start.elapsed().as_millis(),
        page,
        page_size,
    })
}

#[tauri::command]
pub async fn explain_query(
    state: State<'_, AppState>,
    request: QueryRequest,
) -> AppResult<ExplainResult> {
    let start = Instant::now();
    let manager = state.connections.read().await;
    let client = manager.get_client(&request.connection_id)?;
    let db = client.database(&request.database);

    let result = db
        .run_command(mongodb::bson::doc! {
            "explain": {
                "find": &request.collection,
                "filter": {}
            },
            "verbosity": "executionStats"
        })
        .await
        .map_err(|e| AppError::Query(e.to_string()))?;

    let plan: serde_json::Value =
        serde_json::to_value(&result).map_err(|e| AppError::Query(e.to_string()))?;

    Ok(ExplainResult {
        plan,
        execution_time_ms: start.elapsed().as_millis(),
    })
}
