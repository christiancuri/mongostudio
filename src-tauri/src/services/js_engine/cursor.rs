use std::sync::atomic::Ordering;

use rquickjs::class::Trace;
use rquickjs::prelude::{Opt, This};
use rquickjs::{Class, Ctx, Function, JsLifetime, Value};

use super::bson_convert::{bson_doc_to_json, json_to_bson_doc, json_to_js, js_to_json};
use super::globals::throw_error;
use super::ENGINE_STATE;

/// Maximum number of documents toArray() will collect
const MAX_TO_ARRAY_DOCS: usize = 10_000;

/// MongoCursor: lazy query builder. Stores parameters and executes on terminal methods.
#[derive(Trace, JsLifetime)]
#[rquickjs::class]
pub struct MongoCursor {
    collection_name: String,
    filter_json: String,
    projection_json: String,
    sort_json: String,
    limit_val: i64,
    skip_val: u64,
    #[qjs(get)]
    __is_cursor: bool,
}

#[rquickjs::methods]
impl MongoCursor {
    #[qjs(constructor)]
    pub fn new(
        collection_name: String,
        filter_json: Opt<String>,
        projection_json: Opt<String>,
    ) -> Self {
        Self {
            collection_name,
            filter_json: filter_json.0.unwrap_or_else(|| "{}".to_string()),
            projection_json: projection_json.0.unwrap_or_else(|| "{}".to_string()),
            sort_json: String::new(),
            limit_val: 0,
            skip_val: 0,
            __is_cursor: true,
        }
    }

    // --- Chainable methods (return this) ---

    pub fn sort<'js>(
        this: This<Class<'js, Self>>,
        ctx: Ctx<'js>,
        sort_doc: Value<'js>,
    ) -> rquickjs::Result<Class<'js, Self>> {
        let json = js_to_json(&ctx, sort_doc)?;
        let json_str =
            serde_json::to_string(&json).map_err(|_| rquickjs::Error::Unknown)?;
        this.0.borrow_mut().sort_json = json_str;
        Ok(this.0)
    }

    pub fn projection<'js>(
        this: This<Class<'js, Self>>,
        ctx: Ctx<'js>,
        proj_doc: Value<'js>,
    ) -> rquickjs::Result<Class<'js, Self>> {
        let json = js_to_json(&ctx, proj_doc)?;
        let json_str =
            serde_json::to_string(&json).map_err(|_| rquickjs::Error::Unknown)?;
        this.0.borrow_mut().projection_json = json_str;
        Ok(this.0)
    }

    pub fn project<'js>(
        this: This<Class<'js, Self>>,
        ctx: Ctx<'js>,
        proj_doc: Value<'js>,
    ) -> rquickjs::Result<Class<'js, Self>> {
        let json = js_to_json(&ctx, proj_doc)?;
        let json_str =
            serde_json::to_string(&json).map_err(|_| rquickjs::Error::Unknown)?;
        this.0.borrow_mut().projection_json = json_str;
        Ok(this.0)
    }

    /// select('name age') or select({name: 1}) — Mongoose/NoSQLBooster-style projection
    pub fn select<'js>(
        this: This<Class<'js, Self>>,
        ctx: Ctx<'js>,
        fields: Value<'js>,
    ) -> rquickjs::Result<Class<'js, Self>> {
        let json_str = if let Some(s) = fields.as_string() {
            // String form: "name age -email" → {name: 1, age: 1, email: 0}
            let s = s.to_string()?;
            let mut proj = serde_json::Map::new();
            for field in s.split_whitespace() {
                if let Some(name) = field.strip_prefix('-') {
                    proj.insert(name.to_string(), serde_json::json!(0));
                } else {
                    proj.insert(field.to_string(), serde_json::json!(1));
                }
            }
            serde_json::to_string(&proj).unwrap_or_else(|_| "{}".to_string())
        } else {
            // Object form: {name: 1}
            let json = js_to_json(&ctx, fields)?;
            serde_json::to_string(&json).unwrap_or_else(|_| "{}".to_string())
        };
        this.0.borrow_mut().projection_json = json_str;
        Ok(this.0)
    }

    pub fn limit<'js>(
        this: This<Class<'js, Self>>,
        n: i64,
    ) -> rquickjs::Result<Class<'js, Self>> {
        this.0.borrow_mut().limit_val = n;
        Ok(this.0)
    }

    pub fn skip<'js>(
        this: This<Class<'js, Self>>,
        n: u64,
    ) -> rquickjs::Result<Class<'js, Self>> {
        this.0.borrow_mut().skip_val = n;
        Ok(this.0)
    }

    // --- Terminal methods (execute the query) ---

    #[qjs(rename = "toArray")]
    pub fn to_array<'js>(&self, ctx: Ctx<'js>) -> rquickjs::Result<Value<'js>> {
        let params = self.build_find_params(&ctx)?;

        ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;

            if state.cancel_flag.load(Ordering::Relaxed) {
                return Err(throw_error(&ctx, "Query execution cancelled"));
            }

            let effective_limit = if params.limit > 0 {
                params.limit.min(MAX_TO_ARRAY_DOCS as i64)
            } else {
                MAX_TO_ARRAY_DOCS as i64
            };

            let opts = build_find_options(
                &params.projection,
                &params.sort,
                Some(effective_limit),
                if params.skip > 0 { Some(params.skip) } else { None },
            );

            let result = state.handle.block_on(async {
                let col = state
                    .db
                    .collection::<mongodb::bson::Document>(&params.collection_name);
                let mut cursor = col
                    .find(params.filter)
                    .with_options(opts)
                    .await
                    .map_err(|e| e.to_string())?;

                let mut docs = Vec::new();
                while cursor.advance().await.map_err(|e| e.to_string())? {
                    let doc = cursor.deserialize_current().map_err(|e| e.to_string())?;
                    docs.push(doc);
                    if docs.len() >= MAX_TO_ARRAY_DOCS {
                        break;
                    }
                }
                Ok::<_, String>(docs)
            });

            match result {
                Ok(docs) => {
                    // Store as last query result for fallback
                    let json_docs: Vec<serde_json::Value> = docs
                        .iter()
                        .filter_map(|d| bson_doc_to_json(d).ok())
                        .collect();
                    super::store_last_query_result(&serde_json::Value::Array(json_docs));
                    docs_to_js_array(&ctx, &docs)
                }
                Err(e) => Err(throw_error(&ctx, &format!("MongoDB error: {e}"))),
            }
        })
    }

    pub fn count<'js>(&self, ctx: Ctx<'js>) -> rquickjs::Result<i64> {
        let collection_name = self.collection_name.clone();
        let filter = parse_json_to_doc(&ctx, &self.filter_json)?;

        ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;

            if state.cancel_flag.load(Ordering::Relaxed) {
                return Err(throw_error(&ctx, "Query execution cancelled"));
            }

            let result = state.handle.block_on(async {
                let col = state
                    .db
                    .collection::<mongodb::bson::Document>(&collection_name);
                col.count_documents(filter)
                    .await
                    .map_err(|e| e.to_string())
            });

            match result {
                #[allow(clippy::cast_possible_wrap)]
                Ok(count) => Ok(count as i64),
                Err(e) => Err(throw_error(&ctx, &format!("MongoDB error: {e}"))),
            }
        })
    }

    #[qjs(rename = "forEach")]
    pub fn for_each<'js>(
        &self,
        ctx: Ctx<'js>,
        callback: Function<'js>,
    ) -> rquickjs::Result<()> {
        let params = self.build_find_params(&ctx)?;

        ENGINE_STATE.with(|state| {
            let state = state.borrow();
            let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;

            if state.cancel_flag.load(Ordering::Relaxed) {
                return Err(throw_error(&ctx, "Query execution cancelled"));
            }

            let opts = build_find_options(
                &params.projection,
                &params.sort,
                if params.limit > 0 { Some(params.limit) } else { None },
                if params.skip > 0 { Some(params.skip) } else { None },
            );

            let docs = state.handle.block_on(async {
                let col = state
                    .db
                    .collection::<mongodb::bson::Document>(&params.collection_name);
                let mut cursor = col
                    .find(params.filter)
                    .with_options(opts)
                    .await
                    .map_err(|e| e.to_string())?;

                let mut docs = Vec::new();
                while cursor.advance().await.map_err(|e| e.to_string())? {
                    let doc = cursor.deserialize_current().map_err(|e| e.to_string())?;
                    docs.push(doc);
                    if docs.len() >= MAX_TO_ARRAY_DOCS {
                        break;
                    }
                }
                Ok::<_, String>(docs)
            });

            match docs {
                Ok(docs) => {
                    for doc in &docs {
                        if state.cancel_flag.load(Ordering::Relaxed) {
                            return Err(throw_error(&ctx, "Query execution cancelled"));
                        }
                        let json_val = match bson_doc_to_json(doc) {
                            Ok(v) => v,
                            Err(e) => {
                                return Err(throw_error(
                                    &ctx,
                                    &format!("Serialization error: {e}"),
                                ))
                            }
                        };
                        let js_val = json_to_js(&ctx, &json_val)?;
                        callback.call::<_, ()>((js_val,))?;
                    }
                    Ok(())
                }
                Err(e) => Err(throw_error(&ctx, &format!("MongoDB error: {e}"))),
            }
        })
    }
}

// --- Internal helpers ---

struct FindParams {
    collection_name: String,
    filter: mongodb::bson::Document,
    projection: Option<mongodb::bson::Document>,
    sort: Option<mongodb::bson::Document>,
    limit: i64,
    skip: u64,
}

impl MongoCursor {
    fn build_find_params(&self, ctx: &Ctx<'_>) -> rquickjs::Result<FindParams> {
        let filter = parse_json_to_doc(ctx, &self.filter_json)?;

        let projection = parse_optional_json_to_doc(ctx, &self.projection_json)?;
        let sort = if self.sort_json.is_empty() {
            None
        } else {
            parse_optional_json_to_doc(ctx, &self.sort_json)?
        };

        Ok(FindParams {
            collection_name: self.collection_name.clone(),
            filter,
            projection,
            sort,
            limit: self.limit_val,
            skip: self.skip_val,
        })
    }
}

fn parse_json_to_doc(
    ctx: &Ctx<'_>,
    json_str: &str,
) -> rquickjs::Result<mongodb::bson::Document> {
    let value: serde_json::Value =
        serde_json::from_str(json_str).unwrap_or(serde_json::json!({}));
    match json_to_bson_doc(&value) {
        Ok(doc) => Ok(doc),
        Err(e) => Err(throw_error(ctx, &format!("Invalid document: {e}"))),
    }
}

fn parse_optional_json_to_doc(
    ctx: &Ctx<'_>,
    json_str: &str,
) -> rquickjs::Result<Option<mongodb::bson::Document>> {
    let value: serde_json::Value =
        serde_json::from_str(json_str).unwrap_or(serde_json::json!({}));
    if value.is_null() || value == serde_json::json!({}) {
        return Ok(None);
    }
    match json_to_bson_doc(&value) {
        Ok(doc) => Ok(Some(doc)),
        Err(e) => Err(throw_error(ctx, &format!("Invalid document: {e}"))),
    }
}

fn build_find_options(
    projection: &Option<mongodb::bson::Document>,
    sort: &Option<mongodb::bson::Document>,
    limit: Option<i64>,
    skip: Option<u64>,
) -> mongodb::options::FindOptions {
    let mut opts = mongodb::options::FindOptions::default();
    if let Some(p) = projection {
        opts.projection = Some(p.clone());
    }
    if let Some(s) = sort {
        opts.sort = Some(s.clone());
    }
    if let Some(l) = limit {
        opts.limit = Some(l);
    }
    if let Some(s) = skip {
        opts.skip = Some(s);
    }
    opts
}

fn docs_to_js_array<'js>(
    ctx: &Ctx<'js>,
    docs: &[mongodb::bson::Document],
) -> rquickjs::Result<Value<'js>> {
    let arr = rquickjs::Array::new(ctx.clone())?;
    for (i, doc) in docs.iter().enumerate() {
        let json_val = match bson_doc_to_json(doc) {
            Ok(v) => v,
            Err(e) => return Err(throw_error(ctx, &format!("Serialization error: {e}"))),
        };
        let js_val = json_to_js(ctx, &json_val)?;
        arr.set(i, js_val)?;
    }
    Ok(arr.into_value())
}
