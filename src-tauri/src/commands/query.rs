use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

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

    // Get MongoDB client + database
    let manager = state.connections.read().await;
    let client = manager.get_client(&request.connection_id)?;
    let db = client.database(&request.database);
    drop(manager); // Release the lock early

    // Capture tokio handle for bridge to sync QuickJS
    let handle = tokio::runtime::Handle::current();

    // Create cancel flag and register it
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let execution_id = format!("{}:{}", request.connection_id, uuid::Uuid::new_v4());
    {
        let mut executions = state.running_executions.write().await;
        executions.insert(execution_id.clone(), cancel_flag.clone());
    }

    let script = request.query_text.clone();
    let page = request.page.unwrap_or(1);
    let page_size = request.page_size.unwrap_or(50);

    // Execute on a dedicated OS thread (NOT spawn_blocking) to avoid tokio deadlock.
    // QuickJS is synchronous and uses handle.block_on() for MongoDB async operations.
    let (tx, rx) = tokio::sync::oneshot::channel();
    std::thread::spawn(move || {
        let result = crate::services::js_engine::execute(&script, db, handle, cancel_flag);
        let _ = tx.send(result);
    });

    // Wait for the JS engine result
    let js_result = rx
        .await
        .map_err(|_| AppError::Query("Execution thread panicked".to_string()))?;

    // Clean up cancel flag
    {
        let mut executions = state.running_executions.write().await;
        executions.remove(&execution_id);
    }

    match js_result {
        Ok(exec_result) => {
            // Convert result to paginated QueryResult
            let all_documents = match &exec_result.result {
                serde_json::Value::Array(arr) => arr.clone(),
                serde_json::Value::Null => Vec::new(),
                other => vec![other.clone()],
            };

            #[allow(clippy::cast_possible_wrap)]
            let total_count = all_documents.len() as i64;

            #[allow(clippy::cast_possible_truncation)]
            let skip = ((page - 1) * page_size) as usize;

            let documents: Vec<serde_json::Value> = all_documents
                .into_iter()
                .skip(skip)
                .take(page_size as usize)
                .collect();

            Ok(QueryResult {
                documents,
                total_count: Some(total_count),
                execution_time_ms: start.elapsed().as_millis(),
                page,
                page_size,
                print_output: if exec_result.print_output.is_empty() {
                    None
                } else {
                    Some(exec_result.print_output)
                },
                is_raw_output: exec_result.is_raw_output,
            })
        }
        Err(e) => {
            if e.contains("cancelled") {
                Err(AppError::Cancelled)
            } else {
                Err(AppError::JavaScript(e))
            }
        }
    }
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

    let collection = request.collection.as_deref().unwrap_or("test");

    let result = db
        .run_command(mongodb::bson::doc! {
            "explain": {
                "find": collection,
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

#[tauri::command]
pub async fn cancel_execution(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<bool> {
    let executions = state.running_executions.read().await;

    // Find any execution matching this connection
    let mut cancelled = false;
    for (key, flag) in executions.iter() {
        if key.starts_with(&connection_id) {
            flag.store(true, Ordering::Relaxed);
            cancelled = true;
        }
    }

    Ok(cancelled)
}
