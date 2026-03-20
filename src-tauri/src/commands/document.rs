use mongodb::bson::Document;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub async fn insert_document(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    collection: String,
    document: serde_json::Value,
) -> AppResult<serde_json::Value> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let col = db.collection::<Document>(&collection);

    let bson_val =
        mongodb::bson::to_bson(&document).map_err(|e| AppError::Query(e.to_string()))?;
    let doc =
        mongodb::bson::to_document(&bson_val).map_err(|e| AppError::Query(e.to_string()))?;

    let result = col
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Query(e.to_string()))?;

    Ok(serde_json::json!({
        "insertedId": result.inserted_id.to_string()
    }))
}

#[tauri::command]
pub async fn update_document(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    collection: String,
    filter: serde_json::Value,
    update: serde_json::Value,
) -> AppResult<serde_json::Value> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let col = db.collection::<Document>(&collection);

    let filter_doc: Document =
        serde_json::from_value(filter).map_err(|e| AppError::Query(e.to_string()))?;
    let update_doc: Document =
        serde_json::from_value(update).map_err(|e| AppError::Query(e.to_string()))?;

    let result = col
        .update_one(filter_doc, update_doc)
        .await
        .map_err(|e| AppError::Query(e.to_string()))?;

    Ok(serde_json::json!({
        "matchedCount": result.matched_count,
        "modifiedCount": result.modified_count
    }))
}

#[tauri::command]
pub async fn delete_document(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    collection: String,
    filter: serde_json::Value,
) -> AppResult<serde_json::Value> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let col = db.collection::<Document>(&collection);

    let filter_doc: Document =
        serde_json::from_value(filter).map_err(|e| AppError::Query(e.to_string()))?;

    let result = col
        .delete_one(filter_doc)
        .await
        .map_err(|e| AppError::Query(e.to_string()))?;

    Ok(serde_json::json!({
        "deletedCount": result.deleted_count
    }))
}
