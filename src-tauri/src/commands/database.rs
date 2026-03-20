use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::database::{CollectionInfo, CollectionStats, DatabaseInfo, DatabaseStats};
use crate::state::AppState;

/// Extract a numeric value from a BSON document, handling i32, i64, and f64.
fn get_number(doc: &bson::Document, key: &str) -> Option<i64> {
    match doc.get(key) {
        Some(bson::Bson::Int64(v)) => Some(*v),
        Some(bson::Bson::Int32(v)) => Some(i64::from(*v)),
        Some(bson::Bson::Double(v)) => Some(*v as i64),
        _ => None,
    }
}

#[tauri::command]
pub async fn list_databases(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<Vec<DatabaseInfo>> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db_list = client
        .list_databases()
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;

    #[allow(clippy::cast_possible_wrap)]
    let databases = db_list
        .into_iter()
        .map(|db| DatabaseInfo {
            name: db.name,
            size_on_disk: Some(db.size_on_disk as i64),
            empty: Some(db.empty),
            accessible: true,
        })
        .collect();

    Ok(databases)
}

#[tauri::command]
pub async fn list_collections(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
) -> AppResult<Vec<CollectionInfo>> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let collections = db
        .list_collection_names()
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;

    let result = collections
        .into_iter()
        .map(|name| CollectionInfo {
            name,
            collection_type: "collection".to_string(),
            doc_count: None,
            size: None,
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn collection_stats(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    collection: String,
) -> AppResult<CollectionStats> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let result = db
        .run_command(bson::doc! { "collStats": &collection })
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;

    Ok(CollectionStats {
        ns: format!("{database}.{collection}"),
        count: get_number(&result, "count").unwrap_or(0),
        size: get_number(&result, "size").unwrap_or(0),
        avg_obj_size: get_number(&result, "avgObjSize"),
        storage_size: get_number(&result, "storageSize").unwrap_or(0),
        indexes: get_number(&result, "nindexes").unwrap_or(0),
        index_size: get_number(&result, "totalIndexSize").unwrap_or(0),
    })
}

#[tauri::command]
pub async fn database_stats(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
) -> AppResult<DatabaseStats> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let result = db
        .run_command(bson::doc! { "dbStats": 1 })
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;

    Ok(DatabaseStats {
        db: database,
        collections: result.get_i64("collections").unwrap_or(0),
        data_size: result.get_i64("dataSize").unwrap_or(0),
        storage_size: result.get_i64("storageSize").unwrap_or(0),
        indexes: result.get_i64("indexes").unwrap_or(0),
        index_size: result.get_i64("indexSize").unwrap_or(0),
    })
}

#[tauri::command]
pub async fn list_collections_with_stats(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
) -> AppResult<Vec<CollectionInfo>> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let names = db
        .list_collection_names()
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;

    let mut result = Vec::new();
    for name in names {
        let stats = db.run_command(bson::doc! { "collStats": &name }).await;
        let (doc_count, size) = match stats {
            Ok(s) => {
                let count = get_number(&s, "count");
                let sz = get_number(&s, "size");
                (count, sz)
            }
            Err(_) => (None, None),
        };
        result.push(CollectionInfo {
            name,
            collection_type: "collection".to_string(),
            doc_count,
            size,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn list_indexes(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    collection: String,
) -> AppResult<serde_json::Value> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let col = db.collection::<mongodb::bson::Document>(&collection);

    let mut cursor = col
        .list_indexes()
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;

    let mut indexes = Vec::new();
    while cursor
        .advance()
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?
    {
        let idx = cursor
            .deserialize_current()
            .map_err(|e| AppError::Connection(e.to_string()))?;
        let json = serde_json::to_value(&idx)
            .map_err(|e| AppError::Connection(e.to_string()))?;
        indexes.push(json);
    }

    Ok(serde_json::json!(indexes))
}

/// Returns detailed index information for all indexes in a collection,
/// including size, type, usage stats, and namespace.
#[tauri::command]
pub async fn get_indexes_detail(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    collection: String,
) -> AppResult<serde_json::Value> {
    let manager = state.connections.read().await;
    let client = manager.get_client(&connection_id)?;
    let db = client.database(&database);
    let col = db.collection::<mongodb::bson::Document>(&collection);
    let ns = format!("{database}.{collection}");

    // Get indexes
    let mut cursor = col
        .list_indexes()
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?;
    let mut indexes: Vec<serde_json::Value> = Vec::new();
    while cursor
        .advance()
        .await
        .map_err(|e| AppError::Connection(e.to_string()))?
    {
        let idx = cursor
            .deserialize_current()
            .map_err(|e| AppError::Connection(e.to_string()))?;
        let json = serde_json::to_value(&idx)
            .map_err(|e| AppError::Connection(e.to_string()))?;
        indexes.push(json);
    }

    // Get index sizes from collStats
    let index_sizes: std::collections::HashMap<String, i64> =
        match db.run_command(bson::doc! { "collStats": &collection }).await {
            Ok(stats) => {
                if let Some(bson::Bson::Document(sizes)) = stats.get("indexSizes") {
                    sizes
                        .iter()
                        .filter_map(|(k, v)| {
                            let size = match v {
                                bson::Bson::Int64(n) => Some(*n),
                                bson::Bson::Int32(n) => Some(i64::from(*n)),
                                bson::Bson::Double(n) => Some(*n as i64),
                                _ => None,
                            };
                            size.map(|s| (k.clone(), s))
                        })
                        .collect()
                } else {
                    std::collections::HashMap::new()
                }
            }
            Err(_) => std::collections::HashMap::new(),
        };

    // Get index stats via $indexStats aggregation
    let index_stats: std::collections::HashMap<String, serde_json::Value> = {
        let pipeline = vec![bson::doc! { "$indexStats": {} }];
        match col.aggregate(pipeline).await {
            Ok(mut agg_cursor) => {
                let mut stats_map = std::collections::HashMap::new();
                while agg_cursor
                    .advance()
                    .await
                    .unwrap_or(false)
                {
                    if let Ok(doc) = agg_cursor.deserialize_current() {
                        if let Some(name) = doc.get_str("name").ok() {
                            let json = serde_json::to_value(&doc).unwrap_or_default();
                            stats_map.insert(name.to_string(), json);
                        }
                    }
                }
                stats_map
            }
            Err(_) => std::collections::HashMap::new(),
        }
    };

    // Build enriched index list
    let result: Vec<serde_json::Value> = indexes
        .into_iter()
        .map(|idx| {
            let name = idx.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
            let key = idx.get("key").cloned().unwrap_or(serde_json::json!({}));

            // Determine type from key values
            let idx_type = key
                .as_object()
                .and_then(|obj| {
                    obj.values().find_map(|v| v.as_str().map(|s| s.to_uppercase()))
                })
                .unwrap_or_else(|| "REGULAR".to_string());

            let size = index_sizes.get(name).copied();

            // Get accesses from $indexStats
            let accesses = index_stats.get(name).and_then(|stat| {
                stat.get("accesses").map(|a| {
                    let ops = a.get("ops").and_then(|v| v.as_i64()).unwrap_or(0);
                    let since = a.get("since").and_then(|v| v.get("$date")).cloned();
                    serde_json::json!({ "ops": ops, "since": since })
                })
            });

            let host = index_stats
                .get(name)
                .and_then(|stat| stat.get("host").cloned());

            let mut entry = serde_json::json!({
                "name": name,
                "key": key,
                "type": idx_type,
                "ns": ns,
            });
            let obj = entry.as_object_mut().expect("just created");
            if let Some(s) = size {
                obj.insert("size".to_string(), serde_json::json!(s));
            }
            if let Some(a) = accesses {
                obj.insert("accesses".to_string(), a);
            }
            if let Some(h) = host {
                obj.insert("host".to_string(), h);
            }
            // Add any extra properties (unique, sparse, etc.)
            if let Some(unique) = idx.get("unique") {
                obj.insert("unique".to_string(), unique.clone());
            }
            if let Some(sparse) = idx.get("sparse") {
                obj.insert("sparse".to_string(), sparse.clone());
            }
            if let Some(expire) = idx.get("expireAfterSeconds") {
                obj.insert("expireAfterSeconds".to_string(), expire.clone());
            }
            entry
        })
        .collect();

    Ok(serde_json::json!(result))
}

/// Returns detailed info for a single index.
#[tauri::command]
pub async fn get_index_info(
    state: State<'_, AppState>,
    connection_id: String,
    database: String,
    collection: String,
    index_name: String,
) -> AppResult<serde_json::Value> {
    let all = get_indexes_detail(state, connection_id, database, collection).await?;
    if let Some(arr) = all.as_array() {
        if let Some(idx) = arr.iter().find(|v| {
            v.get("name").and_then(|n| n.as_str()) == Some(&index_name)
        }) {
            return Ok(idx.clone());
        }
    }
    Ok(serde_json::json!({}))
}
