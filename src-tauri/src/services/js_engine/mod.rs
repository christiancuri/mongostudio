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
/// This avoids needing to store non-Trace MongoDB types in JS classes.
pub(crate) struct EngineState {
    pub db: mongodb::Database,
    pub handle: tokio::runtime::Handle,
    pub cancel_flag: Arc<AtomicBool>,
    pub print_output: RefCell<Vec<String>>,
}

thread_local! {
    pub(crate) static ENGINE_STATE: RefCell<Option<EngineState>> = const { RefCell::new(None) };
}

/// Result of a JavaScript execution.
#[derive(Debug, Clone)]
pub struct JsExecutionResult {
    /// The result value, serialized as JSON.
    pub result: serde_json::Value,
    /// Any output from print() / console.log() calls.
    pub print_output: Vec<String>,
}

/// Execute a JavaScript script with access to a MongoDB database.
///
/// This function MUST be called from a dedicated OS thread (via std::thread::spawn),
/// NOT from a tokio thread or spawn_blocking, to avoid deadlocks with handle.block_on().
///
/// The JS engine (QuickJS via rquickjs) is a sandboxed JavaScript runtime specifically
/// designed for executing user-provided MongoDB shell scripts. It provides a controlled
/// environment with only MongoDB-related globals (db, ObjectId, ISODate, etc.) and no
/// access to the filesystem, network, or other system resources beyond MongoDB operations.
///
/// # Arguments
/// * `script` - The JavaScript code to execute (MongoDB shell syntax)
/// * `db` - The MongoDB database to operate on
/// * `handle` - A tokio runtime handle for executing async MongoDB operations
/// * `cancel_flag` - An atomic flag that can be set to cancel execution
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
        });
    });

    // 2. Create QuickJS runtime with memory limits and interrupt handler
    let rt = context::create_runtime(cancel_flag.clone())
        .map_err(|e| format!("Failed to create JS runtime: {e}"))?;

    // 3. Create context
    let ctx = context::create_context(&rt)
        .map_err(|e| format!("Failed to create JS context: {e}"))?;

    // 4. Execute script within context
    let result = ctx.with(|ctx| {
        // Set up globals, classes, and db proxy
        context::setup_context(&ctx)
            .map_err(|e| format!("Failed to setup JS context: {e}"))?;

        // Use QuickJS eval to execute the user's MongoDB shell script.
        // This is intentional - QuickJS is a sandboxed JS runtime with no system access,
        // specifically designed for evaluating user-provided MongoDB queries.
        let eval_result: rquickjs::Result<rquickjs::Value<'_>> = ctx.eval(script);

        // Handle evaluation result with proper error catching
        match eval_result.catch(&ctx) {
            Ok(value) => {
                // Check if result is a MongoCursor (auto-call toArray).
                // We must call toArray() via JS to preserve the `this` binding,
                // otherwise rquickjs can't resolve &self on the MongoCursor.
                if value.is_object() {
                    if let Some(obj) = value.as_object() {
                        if let Ok(true) = obj.get::<_, bool>("__is_cursor") {
                            ctx.globals().set("__auto_cursor", value)
                                .map_err(|e| format!("Failed to set cursor: {e}"))?;
                            let auto_result: rquickjs::Result<rquickjs::Value<'_>> =
                                ctx.eval("__auto_cursor.toArray()");
                            let _ = ctx.globals().remove("__auto_cursor");
                            match auto_result.catch(&ctx) {
                                Ok(array_val) => {
                                    return bson_convert::js_to_json(&ctx, array_val)
                                        .map_err(|e| {
                                            format!("Failed to convert result: {e}")
                                        });
                                }
                                Err(caught) => {
                                    return Err(format_caught_error(&caught));
                                }
                            }
                        }
                    }
                }

                // Regular value conversion
                bson_convert::js_to_json(&ctx, value)
                    .map_err(|e| format!("Failed to convert result: {e}"))
            }
            Err(caught) => {
                // Check if this was a cancellation
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
        Ok(value) => Ok(JsExecutionResult {
            result: value,
            print_output,
        }),
        Err(e) => Err(e),
    }
}

/// Format a caught JS error into a user-friendly error message.
fn format_caught_error(caught: &rquickjs::CaughtError<'_>) -> String {
    format!("{caught}")
}
