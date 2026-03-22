use std::sync::atomic::Ordering;

use rquickjs::class::Trace;
use rquickjs::JsLifetime;
use rquickjs::prelude::Opt;
use rquickjs::{Class, Ctx, Value};

use super::bson_convert::{bson_doc_to_json, json_to_bson_doc, json_to_js, js_to_json};
use super::cursor::MongoCursor;
use super::globals::throw_error;
use super::ENGINE_STATE;

/// MongoCollection: represents a MongoDB collection with all CRUD methods.
#[derive(Trace, JsLifetime)]
#[rquickjs::class(rename = "MongoCollection")]
pub struct MongoCollection {
    collection_name: String,
}

#[rquickjs::methods]
impl MongoCollection {
    #[qjs(constructor)]
    pub fn new(name: String) -> Self {
        Self {
            collection_name: name,
        }
    }

    // --- Query methods ---

    /// find(filter?, projection?) -> MongoCursor (lazy)
    pub fn find<'js>(
        &self,
        ctx: Ctx<'js>,
        filter: Opt<Value<'js>>,
        projection: Opt<Value<'js>>,
    ) -> rquickjs::Result<Class<'js, MongoCursor>> {
        let filter_json = match filter.0 {
            Some(v) if !v.is_undefined() && !v.is_null() => {
                let json = js_to_json(&ctx, v)?;
                serde_json::to_string(&json).unwrap_or_else(|_| "{}".to_string())
            }
            _ => "{}".to_string(),
        };
        let proj_json = match projection.0 {
            Some(v) if !v.is_undefined() && !v.is_null() => {
                let json = js_to_json(&ctx, v)?;
                serde_json::to_string(&json).unwrap_or_else(|_| "{}".to_string())
            }
            _ => "{}".to_string(),
        };

        Class::instance(
            ctx,
            MongoCursor::new(
                self.collection_name.clone(),
                Opt(Some(filter_json)),
                Opt(Some(proj_json)),
            ),
        )
    }

    /// findOne(filter?, projection?) -> Document or null
    #[qjs(rename = "findOne")]
    pub fn find_one<'js>(
        &self,
        ctx: Ctx<'js>,
        filter: Opt<Value<'js>>,
        projection: Opt<Value<'js>>,
    ) -> rquickjs::Result<Value<'js>> {
        let filter_doc = parse_filter(&ctx, &filter)?;
        let proj_doc = parse_optional_doc(&ctx, &projection)?;

        let mut find_one_opts = mongodb::options::FindOneOptions::default();
        if let Some(p) = proj_doc {
            find_one_opts.projection = Some(p);
        }

        with_collection(&ctx, &self.collection_name, |col, handle| {
            handle.block_on(async {
                col.find_one(filter_doc)
                    .with_options(find_one_opts)
                    .await
                    .map_err(|e| e.to_string())
            })
        })
        .and_then(|result| match result {
            Some(doc) => {
                let json = match bson_doc_to_json(&doc) {
                    Ok(v) => v,
                    Err(e) => return Err(throw_error(&ctx, &format!("Serialization error: {e}"))),
                };
                json_to_js(&ctx, &json)
            }
            None => Ok(Value::new_null(ctx.clone())),
        })
    }

    /// aggregate(pipeline) -> Array
    pub fn aggregate<'js>(
        &self,
        ctx: Ctx<'js>,
        pipeline: Value<'js>,
    ) -> rquickjs::Result<Value<'js>> {
        let pipeline_json = js_to_json(&ctx, pipeline)?;
        let pipeline_arr = match pipeline_json {
            serde_json::Value::Array(arr) => arr,
            _ => return Err(throw_error(&ctx, "aggregate() expects an array pipeline")),
        };

        let bson_pipeline: Vec<mongodb::bson::Document> = pipeline_arr
            .iter()
            .map(|stage| json_to_bson_doc(stage))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| throw_error(&ctx, &format!("Invalid pipeline stage: {e}")))?;

        let collection_name = self.collection_name.clone();
        let docs = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    let mut cursor = col.aggregate(bson_pipeline).await.map_err(|e| e.to_string())?;
                    let mut docs = Vec::new();
                    while cursor.advance().await.map_err(|e| e.to_string())? {
                        let doc = cursor.deserialize_current().map_err(|e| e.to_string())?;
                        docs.push(doc);
                        if docs.len() >= 10_000 {
                            break;
                        }
                    }
                    Ok::<_, String>(docs)
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let arr = rquickjs::Array::new(ctx.clone())?;
        for (i, doc) in docs.iter().enumerate() {
            let json = bson_doc_to_json(doc)
                .map_err(|e| throw_error(&ctx, &format!("Serialization error: {e}")))?;
            let js_val = json_to_js(&ctx, &json)?;
            arr.set(i, js_val)?;
        }
        Ok(arr.into_value())
    }

    // --- Insert methods ---

    /// insertOne(doc) -> { insertedId }
    #[qjs(rename = "insertOne")]
    pub fn insert_one<'js>(
        &self,
        ctx: Ctx<'js>,
        doc: Value<'js>,
    ) -> rquickjs::Result<Value<'js>> {
        let json = js_to_json(&ctx, doc)?;
        let bson_doc = json_to_bson_doc(&json)
            .map_err(|e| throw_error(&ctx, &format!("Invalid document: {e}")))?;

        let collection_name = self.collection_name.clone();
        let result = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.insert_one(bson_doc).await.map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let id_json = serde_json::to_value(&result.inserted_id)
            .map_err(|_| rquickjs::Error::Unknown)?;
        let result_json = serde_json::json!({"insertedId": id_json});
        json_to_js(&ctx, &result_json)
    }

    /// insertMany(docs) -> { insertedIds }
    #[qjs(rename = "insertMany")]
    pub fn insert_many<'js>(
        &self,
        ctx: Ctx<'js>,
        docs: Value<'js>,
    ) -> rquickjs::Result<Value<'js>> {
        let json = js_to_json(&ctx, docs)?;
        let arr = match json {
            serde_json::Value::Array(arr) => arr,
            _ => return Err(throw_error(&ctx, "insertMany() expects an array")),
        };

        let bson_docs: Vec<mongodb::bson::Document> = arr
            .iter()
            .map(|v| json_to_bson_doc(v))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| throw_error(&ctx, &format!("Invalid document: {e}")))?;

        let collection_name = self.collection_name.clone();
        let result = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.insert_many(bson_docs).await.map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let ids: Vec<serde_json::Value> = result
            .inserted_ids
            .values()
            .map(|id| serde_json::to_value(id).unwrap_or(serde_json::Value::Null))
            .collect();
        let result_json = serde_json::json!({"insertedIds": ids});
        json_to_js(&ctx, &result_json)
    }

    // --- Update methods ---

    /// updateOne(filter, update) -> { matchedCount, modifiedCount }
    #[qjs(rename = "updateOne")]
    pub fn update_one<'js>(
        &self,
        ctx: Ctx<'js>,
        filter: Value<'js>,
        update: Value<'js>,
    ) -> rquickjs::Result<Value<'js>> {
        let filter_doc = parse_value_as_doc(&ctx, filter)?;
        let update_doc = parse_update_doc(&ctx, update)?;

        let collection_name = self.collection_name.clone();
        let result = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.update_one(filter_doc, update_doc)
                        .await
                        .map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let result_json = serde_json::json!({
            "matchedCount": result.matched_count,
            "modifiedCount": result.modified_count,
        });
        json_to_js(&ctx, &result_json)
    }

    /// updateMany(filter, update) -> { matchedCount, modifiedCount }
    #[qjs(rename = "updateMany")]
    pub fn update_many<'js>(
        &self,
        ctx: Ctx<'js>,
        filter: Value<'js>,
        update: Value<'js>,
    ) -> rquickjs::Result<Value<'js>> {
        let filter_doc = parse_value_as_doc(&ctx, filter)?;
        let update_doc = parse_update_doc(&ctx, update)?;

        let collection_name = self.collection_name.clone();
        let result = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.update_many(filter_doc, update_doc)
                        .await
                        .map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let result_json = serde_json::json!({
            "matchedCount": result.matched_count,
            "modifiedCount": result.modified_count,
        });
        json_to_js(&ctx, &result_json)
    }

    /// replaceOne(filter, replacement) -> { matchedCount, modifiedCount }
    #[qjs(rename = "replaceOne")]
    pub fn replace_one<'js>(
        &self,
        ctx: Ctx<'js>,
        filter: Value<'js>,
        replacement: Value<'js>,
    ) -> rquickjs::Result<Value<'js>> {
        let filter_doc = parse_value_as_doc(&ctx, filter)?;
        let replacement_doc = parse_value_as_doc(&ctx, replacement)?;

        let collection_name = self.collection_name.clone();
        let result = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.replace_one(filter_doc, replacement_doc)
                        .await
                        .map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let result_json = serde_json::json!({
            "matchedCount": result.matched_count,
            "modifiedCount": result.modified_count,
        });
        json_to_js(&ctx, &result_json)
    }

    // --- Delete methods ---

    /// deleteOne(filter) -> { deletedCount }
    #[qjs(rename = "deleteOne")]
    pub fn delete_one<'js>(
        &self,
        ctx: Ctx<'js>,
        filter: Value<'js>,
    ) -> rquickjs::Result<Value<'js>> {
        let filter_doc = parse_value_as_doc(&ctx, filter)?;

        let collection_name = self.collection_name.clone();
        let result = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.delete_one(filter_doc).await.map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let result_json = serde_json::json!({"deletedCount": result.deleted_count});
        json_to_js(&ctx, &result_json)
    }

    /// deleteMany(filter) -> { deletedCount }
    #[qjs(rename = "deleteMany")]
    pub fn delete_many<'js>(
        &self,
        ctx: Ctx<'js>,
        filter: Value<'js>,
    ) -> rquickjs::Result<Value<'js>> {
        let filter_doc = parse_value_as_doc(&ctx, filter)?;

        let collection_name = self.collection_name.clone();
        let result = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.delete_many(filter_doc)
                        .await
                        .map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let result_json = serde_json::json!({"deletedCount": result.deleted_count});
        json_to_js(&ctx, &result_json)
    }

    // --- Count and distinct ---

    /// countDocuments(filter?) -> number
    #[qjs(rename = "countDocuments")]
    pub fn count_documents<'js>(&self, ctx: Ctx<'js>, filter: Opt<Value<'js>>) -> rquickjs::Result<i64> {
        let filter_doc = parse_filter(&ctx, &filter)?;

        let collection_name = self.collection_name.clone();
        ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            let result = state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.count_documents(filter_doc)
                        .await
                        .map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))?;

            #[allow(clippy::cast_possible_wrap)]
            Ok(result as i64)
        })
    }

    /// estimatedDocumentCount() -> number
    #[qjs(rename = "estimatedDocumentCount")]
    pub fn estimated_document_count<'js>(&self, ctx: Ctx<'js>) -> rquickjs::Result<i64> {
        let collection_name = self.collection_name.clone();
        ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            let result = state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.estimated_document_count()
                        .await
                        .map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))?;

            #[allow(clippy::cast_possible_wrap)]
            Ok(result as i64)
        })
    }

    /// distinct(field, filter?) -> Array
    pub fn distinct<'js>(
        &self,
        ctx: Ctx<'js>,
        field_name: String,
        filter: Opt<Value<'js>>,
    ) -> rquickjs::Result<Value<'js>> {
        let filter_doc = parse_filter(&ctx, &filter)?;

        let collection_name = self.collection_name.clone();
        let values = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.distinct(&field_name, filter_doc)
                        .await
                        .map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let json_arr: Vec<serde_json::Value> = values
            .iter()
            .map(|v| serde_json::to_value(v).unwrap_or(serde_json::Value::Null))
            .collect();
        let json = serde_json::Value::Array(json_arr);
        json_to_js(&ctx, &json)
    }

    // --- Index methods ---

    /// createIndex(keys, options?) -> string
    #[qjs(rename = "createIndex")]
    pub fn create_index<'js>(
        &self,
        ctx: Ctx<'js>,
        keys: Value<'js>,
        options: Opt<Value<'js>>,
    ) -> rquickjs::Result<String> {
        let keys_doc = parse_value_as_doc(&ctx, keys)?;

        let mut index_opts = None;
        if let Some(opts_val) = options.0 {
            if !opts_val.is_undefined() && !opts_val.is_null() {
                let opts_json = js_to_json(&ctx, opts_val)?;
                if let Some(name) = opts_json.get("name").and_then(|v| v.as_str()) {
                    let mut io = mongodb::options::IndexOptions::default();
                    io.name = Some(name.to_string());
                    index_opts = Some(io);
                }
            }
        }

        let mut model = mongodb::IndexModel::default();
        model.keys = keys_doc;
        model.options = index_opts;
        let collection_name = self.collection_name.clone();

        ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.create_index(model).await.map_err(|e| e.to_string())
                })
                .map(|r| r.index_name)
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })
    }

    /// getIndexes() -> Array
    #[qjs(rename = "getIndexes")]
    pub fn get_indexes<'js>(&self, ctx: Ctx<'js>) -> rquickjs::Result<Value<'js>> {
        let collection_name = self.collection_name.clone();
        let indexes = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    let mut cursor = col.list_indexes().await.map_err(|e| e.to_string())?;
                    let mut indexes = Vec::new();
                    while cursor.advance().await.map_err(|e| e.to_string())? {
                        let idx = cursor.deserialize_current().map_err(|e| e.to_string())?;
                        let json = serde_json::to_value(&idx)
                            .map_err(|e| e.to_string())?;
                        indexes.push(json);
                    }
                    Ok::<_, String>(indexes)
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let json = serde_json::Value::Array(indexes);
        json_to_js(&ctx, &json)
    }

    /// drop() -> bool
    #[qjs(rename = "drop")]
    pub fn drop_collection<'js>(&self, ctx: Ctx<'js>) -> rquickjs::Result<bool> {
        let collection_name = self.collection_name.clone();
        ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    let col = state
                        .db
                        .collection::<mongodb::bson::Document>(&collection_name);
                    col.drop().await.map_err(|e| e.to_string())
                })
                .map(|()| true)
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })
    }

    /// stats() -> collStats result
    #[qjs(rename = "stats")]
    pub fn collection_stats<'js>(&self, ctx: Ctx<'js>) -> rquickjs::Result<Value<'js>> {
        let collection_name = self.collection_name.clone();
        let result = ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
            check_cancelled(&ctx, state)?;

            state
                .handle
                .block_on(async {
                    state
                        .db
                        .run_command(mongodb::bson::doc! { "collStats": &collection_name })
                        .await
                        .map_err(|e| e.to_string())
                })
                .map_err(|e| throw_error(&ctx, &format!("MongoDB error: {e}")))
        })?;

        let json = bson_doc_to_json(&result)
            .map_err(|e| throw_error(&ctx, &format!("Serialization error: {e}")))?;
        json_to_js(&ctx, &json)
    }
}

// --- Helper functions ---

fn check_cancelled<'js>(ctx: &Ctx<'js>, state: &super::EngineState) -> rquickjs::Result<()> {
    if state.cancel_flag.load(Ordering::Relaxed) {
        Err(throw_error(ctx, "Query execution cancelled"))
    } else {
        Ok(())
    }
}

fn parse_filter<'js>(
    ctx: &Ctx<'js>,
    filter: &Opt<Value<'js>>,
) -> rquickjs::Result<mongodb::bson::Document> {
    match &filter.0 {
        Some(v) if !v.is_undefined() && !v.is_null() => {
            let json = js_to_json(ctx, v.clone())?;
            match json_to_bson_doc(&json) {
                Ok(doc) => Ok(doc),
                Err(e) => Err(throw_error(ctx, &format!("Invalid filter: {e}"))),
            }
        }
        _ => Ok(mongodb::bson::Document::new()),
    }
}

fn parse_value_as_doc<'js>(
    ctx: &Ctx<'js>,
    value: Value<'js>,
) -> rquickjs::Result<mongodb::bson::Document> {
    let json = js_to_json(ctx, value)?;
    match json_to_bson_doc(&json) {
        Ok(doc) => Ok(doc),
        Err(e) => Err(throw_error(ctx, &format!("Invalid document: {e}"))),
    }
}

fn parse_optional_doc<'js>(
    ctx: &Ctx<'js>,
    value: &Opt<Value<'js>>,
) -> rquickjs::Result<Option<mongodb::bson::Document>> {
    match &value.0 {
        Some(v) if !v.is_undefined() && !v.is_null() => {
            let json = js_to_json(ctx, v.clone())?;
            match json_to_bson_doc(&json) {
                Ok(doc) => Ok(Some(doc)),
                Err(e) => Err(throw_error(ctx, &format!("Invalid document: {e}"))),
            }
        }
        _ => Ok(None),
    }
}

fn parse_update_doc<'js>(
    ctx: &Ctx<'js>,
    value: Value<'js>,
) -> rquickjs::Result<mongodb::bson::Document> {
    let json = js_to_json(ctx, value)?;
    match json_to_bson_doc(&json) {
        Ok(doc) => Ok(doc),
        Err(e) => Err(throw_error(ctx, &format!("Invalid update document: {e}"))),
    }
}

fn with_collection<'js, F, T>(
    ctx: &Ctx<'js>,
    collection_name: &str,
    f: F,
) -> rquickjs::Result<T>
where
    F: FnOnce(
        mongodb::Collection<mongodb::bson::Document>,
        &tokio::runtime::Handle,
    ) -> Result<T, String>,
{
    let name = collection_name.to_string();
    ENGINE_STATE.with(|state| {
        let state = state.borrow();
        let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
        check_cancelled(ctx, state)?;

        let col = state.db.collection::<mongodb::bson::Document>(&name);
        match f(col, &state.handle) {
            Ok(v) => Ok(v),
            Err(e) => Err(throw_error(ctx, &format!("MongoDB error: {e}"))),
        }
    })
}
