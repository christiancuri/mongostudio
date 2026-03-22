use rquickjs::{Ctx, Value};

/// Convert a JS value to serde_json::Value via JSON stringify
pub fn js_to_json<'js>(ctx: &Ctx<'js>, value: Value<'js>) -> rquickjs::Result<serde_json::Value> {
    if value.is_undefined() || value.is_null() {
        return Ok(serde_json::Value::Null);
    }
    if let Some(b) = value.as_bool() {
        return Ok(serde_json::Value::Bool(b));
    }
    if let Some(n) = value.as_int() {
        return Ok(serde_json::json!(n));
    }
    if let Some(n) = value.as_float() {
        return Ok(serde_json::json!(n));
    }

    let json_str = ctx.json_stringify(value)?.ok_or(rquickjs::Error::Unknown)?;
    let s = json_str.to_string()?;
    serde_json::from_str(&s).map_err(|_| rquickjs::Error::Unknown)
}

/// Convert serde_json::Value to a JS value via JSON parse
pub fn json_to_js<'js>(ctx: &Ctx<'js>, value: &serde_json::Value) -> rquickjs::Result<Value<'js>> {
    if value.is_null() {
        return Ok(Value::new_null(ctx.clone()));
    }
    let json_str = serde_json::to_string(value).map_err(|_| rquickjs::Error::Unknown)?;
    ctx.json_parse(json_str)
}

/// Convert serde_json::Value to a bson::Document, handling extended JSON markers.
/// Extended JSON markers like {"$oid": "..."} are converted to proper BSON types.
pub fn json_to_bson_doc(value: &serde_json::Value) -> Result<mongodb::bson::Document, String> {
    let bson_val = json_to_bson(value);
    match bson_val {
        mongodb::bson::Bson::Document(doc) => Ok(doc),
        _ => Err("Expected a document".to_string()),
    }
}

/// Recursively convert serde_json::Value to bson::Bson, recognizing extended JSON markers.
pub fn json_to_bson(value: &serde_json::Value) -> mongodb::bson::Bson {
    match value {
        serde_json::Value::Object(map) => {
            // Check for extended JSON markers
            if map.len() == 1 {
                if let Some(oid_val) = map.get("$oid") {
                    if let Some(s) = oid_val.as_str() {
                        if let Ok(oid) = mongodb::bson::oid::ObjectId::parse_str(s) {
                            return mongodb::bson::Bson::ObjectId(oid);
                        }
                    }
                }
                if let Some(date_val) = map.get("$date") {
                    if let Some(s) = date_val.as_str() {
                        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                            return mongodb::bson::Bson::DateTime(
                                mongodb::bson::DateTime::from_chrono(
                                    dt.with_timezone(&chrono::Utc),
                                ),
                            );
                        }
                        // Try ISO 8601 without timezone
                        if let Ok(dt) =
                            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.fZ")
                        {
                            return mongodb::bson::Bson::DateTime(
                                mongodb::bson::DateTime::from_chrono(dt.and_utc()),
                            );
                        }
                    }
                    if let Some(ms) = date_val.as_i64() {
                        return mongodb::bson::Bson::DateTime(
                            mongodb::bson::DateTime::from_millis(ms),
                        );
                    }
                    // Handle {"$date": {"$numberLong": "..."}}
                    if let Some(obj) = date_val.as_object() {
                        if let Some(nl) = obj.get("$numberLong") {
                            if let Some(s) = nl.as_str() {
                                if let Ok(ms) = s.parse::<i64>() {
                                    return mongodb::bson::Bson::DateTime(
                                        mongodb::bson::DateTime::from_millis(ms),
                                    );
                                }
                            }
                        }
                    }
                }
                if let Some(nl_val) = map.get("$numberLong") {
                    if let Some(s) = nl_val.as_str() {
                        if let Ok(n) = s.parse::<i64>() {
                            return mongodb::bson::Bson::Int64(n);
                        }
                    }
                    if let Some(n) = nl_val.as_i64() {
                        return mongodb::bson::Bson::Int64(n);
                    }
                }
                if let Some(ni_val) = map.get("$numberInt") {
                    if let Some(s) = ni_val.as_str() {
                        if let Ok(n) = s.parse::<i32>() {
                            return mongodb::bson::Bson::Int32(n);
                        }
                    }
                    if let Some(n) = ni_val.as_i64() {
                        #[allow(clippy::cast_possible_truncation)]
                        return mongodb::bson::Bson::Int32(n as i32);
                    }
                }
                if let Some(nd_val) = map.get("$numberDecimal") {
                    if let Some(s) = nd_val.as_str() {
                        // Store as extended JSON document - the driver handles the conversion
                        let mut doc = mongodb::bson::Document::new();
                        doc.insert(
                            "$numberDecimal".to_string(),
                            mongodb::bson::Bson::String(s.to_string()),
                        );
                        return mongodb::bson::Bson::Document(doc);
                    }
                }
                if let Some(regex_val) = map.get("$regularExpression") {
                    if let Some(obj) = regex_val.as_object() {
                        let pattern = obj.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
                        let options = obj.get("options").and_then(|v| v.as_str()).unwrap_or("");
                        return mongodb::bson::Bson::RegularExpression(mongodb::bson::Regex {
                            pattern: pattern.to_string(),
                            options: options.to_string(),
                        });
                    }
                }
            }

            // Regular document
            let mut doc = mongodb::bson::Document::new();
            for (k, v) in map {
                doc.insert(k.clone(), json_to_bson(v));
            }
            mongodb::bson::Bson::Document(doc)
        }
        serde_json::Value::Array(arr) => {
            mongodb::bson::Bson::Array(arr.iter().map(json_to_bson).collect())
        }
        serde_json::Value::String(s) => mongodb::bson::Bson::String(s.clone()),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                if i >= i64::from(i32::MIN) && i <= i64::from(i32::MAX) {
                    #[allow(clippy::cast_possible_truncation)]
                    mongodb::bson::Bson::Int32(i as i32)
                } else {
                    mongodb::bson::Bson::Int64(i)
                }
            } else if let Some(f) = n.as_f64() {
                mongodb::bson::Bson::Double(f)
            } else {
                mongodb::bson::Bson::Null
            }
        }
        serde_json::Value::Bool(b) => mongodb::bson::Bson::Boolean(*b),
        serde_json::Value::Null => mongodb::bson::Bson::Null,
    }
}

/// Convert a bson::Document to serde_json::Value using standard serialization.
/// BSON types are serialized as extended JSON (e.g., ObjectId -> {"$oid": "..."}).
pub fn bson_doc_to_json(doc: &mongodb::bson::Document) -> Result<serde_json::Value, String> {
    serde_json::to_value(doc).map_err(|e| e.to_string())
}
