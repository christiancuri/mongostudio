pub mod bson_convert;
pub mod collection;
pub mod context;
pub mod cursor;
pub mod db_proxy;
pub mod globals;

use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use rquickjs::CatchResultExt;

/// Thread-local state shared between all JS engine components.
pub(crate) struct EngineState {
    pub db: mongodb::Database,
    pub handle: tokio::runtime::Handle,
    pub cancel_flag: Arc<AtomicBool>,
    pub print_output: RefCell<Vec<String>>,
    /// Stores the last query result (from toArray, aggregate, findOne, etc.)
    /// so that if the script's return value is undefined, we can fall back to it.
    pub last_query_result: RefCell<Option<serde_json::Value>>,
}

thread_local! {
    pub(crate) static ENGINE_STATE: RefCell<Option<EngineState>> = const { RefCell::new(None) };
}

/// Store a query result in the engine state for fallback when script returns undefined.
pub(crate) fn store_last_query_result(value: &serde_json::Value) {
    ENGINE_STATE.with(|state| {
        let state = state.borrow();
        if let Some(s) = state.as_ref() {
            *s.last_query_result.borrow_mut() = Some(value.clone());
        }
    });
}

/// Result of a JavaScript execution.
#[derive(Debug, Clone)]
pub struct JsExecutionResult {
    pub result: serde_json::Value,
    pub print_output: Vec<String>,
    /// True when the result is raw JS output (not direct MongoDB documents).
    /// Frontend should display in JSON view instead of tree/table.
    pub is_raw_output: bool,
}

/// Execute a JavaScript script with access to a MongoDB database.
///
/// This function MUST be called from a dedicated OS thread (via std::thread::spawn),
/// NOT from a tokio thread or spawn_blocking, to avoid deadlocks with handle.block_on().
///
/// The JS engine (QuickJS via rquickjs) is a sandboxed JavaScript runtime specifically
/// designed for executing user-provided MongoDB shell scripts.
pub fn execute(
    script: &str,
    db: mongodb::Database,
    handle: tokio::runtime::Handle,
    cancel_flag: Arc<AtomicBool>,
) -> Result<JsExecutionResult, String> {
    // 1. Set up thread-local engine state
    ENGINE_STATE.with(|state| {
        *state.borrow_mut() = Some(EngineState {
            db,
            handle,
            cancel_flag: cancel_flag.clone(),
            print_output: RefCell::new(Vec::new()),
            last_query_result: RefCell::new(None),
        });
    });

    // 2. Create QuickJS runtime with memory limits and interrupt handler
    let rt = context::create_runtime(cancel_flag.clone())
        .map_err(|e| format!("Failed to create JS runtime: {e}"))?;

    // 3. Create context
    let ctx =
        context::create_context(&rt).map_err(|e| format!("Failed to create JS context: {e}"))?;

    // 4. Execute script within context
    // Returns (json_value, is_raw_output)
    let result = ctx.with(|ctx| -> Result<(serde_json::Value, bool), String> {
        context::setup_context(&ctx).map_err(|e| format!("Failed to setup JS context: {e}"))?;

        let eval_result: rquickjs::Result<rquickjs::Value<'_>> = ctx.eval(script);

        match eval_result.catch(&ctx) {
            Ok(value) => {
                // Auto-call toArray() on MongoCursor → direct MongoDB docs
                if value.is_object() {
                    if let Some(obj) = value.as_object() {
                        if let Ok(true) = obj.get::<_, bool>("__is_cursor") {
                            ctx.globals()
                                .set("__auto_cursor", value)
                                .map_err(|e| format!("Failed to set cursor: {e}"))?;
                            let auto_result: rquickjs::Result<rquickjs::Value<'_>> =
                                ctx.eval("__auto_cursor.toArray()");
                            let _ = ctx.globals().remove("__auto_cursor");
                            match auto_result.catch(&ctx) {
                                Ok(array_val) => {
                                    let json = bson_convert::js_to_json(&ctx, array_val)
                                        .map_err(|e| format!("Failed to convert result: {e}"))?;
                                    return Ok((json, false));
                                }
                                Err(caught) => return Err(format_caught_error(&caught)),
                            }
                        }
                    }
                }

                // Script returned undefined/null — recover a meaningful result
                if value.is_undefined() || value.is_null() {
                    // 1. Try the last assigned variable (JS transforms like .map())
                    if let Some(var_name) = find_last_assigned_variable(script) {
                        let var_result: rquickjs::Result<rquickjs::Value<'_>> =
                            ctx.eval(var_name.as_bytes().to_vec());
                        if let Ok(var_val) = var_result {
                            if !var_val.is_undefined() && !var_val.is_null() {
                                // Check if it's a MongoCursor — auto-call toArray()
                                if let Some(obj) = var_val.as_object() {
                                    if let Ok(true) = obj.get::<_, bool>("__is_cursor") {
                                        // Call toArray() via JS using the variable name directly
                                        let expr = format!("{var_name}.toArray()");
                                        let auto_result: rquickjs::Result<rquickjs::Value<'_>> =
                                            ctx.eval(expr.into_bytes());
                                        if let Ok(Ok(array_val)) = auto_result
                                            .catch(&ctx)
                                            .map(|v| bson_convert::js_to_json(&ctx, v))
                                        {
                                            return Ok((array_val, false));
                                        }
                                    }
                                }
                                // Regular JS value
                                let json = bson_convert::js_to_json(&ctx, var_val)
                                    .map_err(|e| format!("Failed to convert result: {e}"))?;
                                let is_raw = !is_document_array(&json);
                                return Ok((json, is_raw));
                            }
                        }
                    }
                    // 2. Fall back to last MongoDB query result
                    let fallback = ENGINE_STATE.with(|state| {
                        let state = state.borrow();
                        state
                            .as_ref()
                            .and_then(|s| s.last_query_result.borrow().clone())
                    });
                    if let Some(last) = fallback {
                        return Ok((last, false));
                    }
                }

                // Direct script result — check if it looks like MongoDB documents
                let json = bson_convert::js_to_json(&ctx, value)
                    .map_err(|e| format!("Failed to convert result: {e}"))?;
                // If the result is an array of objects with _id, treat as docs; otherwise raw
                let is_raw = !is_document_array(&json);
                Ok((json, is_raw))
            }
            Err(caught) => {
                if cancel_flag.load(Ordering::Relaxed) {
                    return Err("Query execution cancelled".to_string());
                }
                Err(format_caught_error(&caught))
            }
        }
    });

    // 5. Collect print output
    let print_output = ENGINE_STATE.with(|state| {
        let state = state.borrow();
        state
            .as_ref()
            .map(|s| s.print_output.borrow().clone())
            .unwrap_or_default()
    });

    // 6. Clean up thread-local state
    ENGINE_STATE.with(|state| {
        *state.borrow_mut() = None;
    });

    match result {
        Ok((value, is_raw)) => Ok(JsExecutionResult {
            result: value,
            print_output,
            is_raw_output: is_raw,
        }),
        Err(e) => Err(e),
    }
}

fn format_caught_error(caught: &rquickjs::CaughtError<'_>) -> String {
    format!("{caught}")
}

/// Check if a JSON value looks like an array of MongoDB documents (objects with fields).
fn is_document_array(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Array(arr) => {
            // Empty array is still a valid query result
            arr.is_empty() || arr.iter().all(|v| v.is_object())
        }
        serde_json::Value::Object(_) => true,
        _ => false,
    }
}

/// Find the last `const/let/var` variable name in the script.
/// Used to recover meaningful results when the script ends with a void
/// statement like `console.log(x)`.
fn find_last_assigned_variable(script: &str) -> Option<String> {
    let mut last_var = None;
    for line in script.lines() {
        let trimmed = line.trim();
        for keyword in &["const ", "let ", "var "] {
            if let Some(rest) = trimmed.strip_prefix(keyword) {
                let var_name: String = rest
                    .chars()
                    .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '$')
                    .collect();
                if !var_name.is_empty() {
                    last_var = Some(var_name);
                }
            }
        }
    }
    last_var
}
