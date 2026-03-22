use rquickjs::{Class, Context, Ctx, Runtime};

use super::collection::MongoCollection;
use super::cursor::MongoCursor;
use super::db_proxy::register_db_proxy;
use super::globals::register_globals;

/// Create a configured QuickJS runtime with memory limits and interrupt handler.
pub fn create_runtime(
    cancel_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> rquickjs::Result<Runtime> {
    let rt = Runtime::new()?;

    // Set memory limit (256 MB) - only works with default libc allocator
    rt.set_memory_limit(256 * 1024 * 1024);
    rt.set_max_stack_size(512 * 1024);
    rt.set_gc_threshold(4 * 1024 * 1024);

    // Set interrupt handler to check cancel flag
    let cancel = cancel_flag;
    rt.set_interrupt_handler(Some(Box::new(move || {
        cancel.load(std::sync::atomic::Ordering::Relaxed)
    })));

    Ok(rt)
}

/// Create a full QuickJS context with all globals, classes, and the db proxy registered.
pub fn create_context(rt: &Runtime) -> rquickjs::Result<Context> {
    Context::full(rt)
}

/// Set up all globals, classes, and the db proxy on the given context.
pub fn setup_context(ctx: &Ctx<'_>) -> rquickjs::Result<()> {
    // Register classes first (needed before db proxy can create instances)
    Class::<MongoCursor>::define(&ctx.globals())?;
    Class::<MongoCollection>::define(&ctx.globals())?;

    // Register global helper functions (ObjectId, ISODate, print, etc.)
    register_globals(ctx)?;

    // Register the db proxy object
    register_db_proxy(ctx)?;

    Ok(())
}
