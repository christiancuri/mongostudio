use std::sync::atomic::Ordering;

use rquickjs::{Ctx, Function, Value};

use super::bson_convert::{bson_doc_to_json, json_to_bson_doc, json_to_js, js_to_json};
use super::globals::throw_error;
use super::ENGINE_STATE;

/// Register the `db` proxy object and its helper functions.
pub fn register_db_proxy<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<()> {
    let globals = ctx.globals();

    // __dbGetName(): returns the database name
    globals.set(
        "__dbGetName",
        Function::new(ctx.clone(), db_get_name)?,
    )?;

    // __dbRunCommand(cmd): run a database command
    globals.set(
        "__dbRunCommand",
        Function::new(ctx.clone(), db_run_command)?,
    )?;

    // __dbAdminCommand(cmd): run an admin command
    globals.set(
        "__dbAdminCommand",
        Function::new(ctx.clone(), db_admin_command)?,
    )?;

    // __dbVersion(): get server version
    globals.set(
        "__dbVersion",
        Function::new(ctx.clone(), db_version)?,
    )?;

    // Create the db Proxy via JS code.
    // The Proxy intercepts property access to create MongoCollection instances dynamically.
    ctx.eval::<(), _>(
        r#"
        const db = new Proxy({}, {
            get(target, prop) {
                if (typeof prop === 'symbol') return undefined;
                switch (prop) {
                    case 'getCollection':
                        return (name) => new MongoCollection(name);
                    case 'getName':
                        return () => __dbGetName();
                    case 'runCommand':
                        return (cmd) => __dbRunCommand(cmd);
                    case 'adminCommand':
                        return (cmd) => __dbAdminCommand(cmd);
                    case 'version':
                        return () => __dbVersion();
                    case 'toString':
                    case 'valueOf':
                    case 'toJSON':
                        return () => __dbGetName();
                    case 'constructor':
                    case 'prototype':
                    case '__proto__':
                        return undefined;
                    default:
                        return new MongoCollection(prop);
                }
            },
            has(target, prop) {
                return typeof prop === 'string';
            }
        });
    "#,
    )?;

    Ok(())
}

// Named functions for global registration (avoids closure lifetime issues)

fn db_get_name(_ctx: Ctx<'_>) -> rquickjs::Result<String> {
    ENGINE_STATE.with(|state| {
        let state = state.borrow();
        let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;
        Ok(state.db.name().to_string())
    })
}

fn db_run_command<'js>(ctx: Ctx<'js>, cmd: Value<'js>) -> rquickjs::Result<Value<'js>> {
    let cmd_json = js_to_json(&ctx, cmd)?;
    let cmd_doc = match json_to_bson_doc(&cmd_json) {
        Ok(doc) => doc,
        Err(e) => return Err(throw_error(&ctx, &format!("Invalid command: {e}"))),
    };

    let result = ENGINE_STATE.with(|state| {
        let state = state.borrow();
        let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;

        if state.cancel_flag.load(Ordering::Relaxed) {
            return Err(throw_error(&ctx, "Query execution cancelled"));
        }

        let r = state.handle.block_on(async {
            state.db.run_command(cmd_doc).await.map_err(|e| e.to_string())
        });
        match r {
            Ok(doc) => Ok(doc),
            Err(e) => Err(throw_error(&ctx, &format!("MongoDB error: {e}"))),
        }
    })?;

    let json = match bson_doc_to_json(&result) {
        Ok(v) => v,
        Err(e) => return Err(throw_error(&ctx, &format!("Serialization error: {e}"))),
    };
    json_to_js(&ctx, &json)
}

fn db_admin_command<'js>(ctx: Ctx<'js>, cmd: Value<'js>) -> rquickjs::Result<Value<'js>> {
    let cmd_json = js_to_json(&ctx, cmd)?;
    let cmd_doc = match json_to_bson_doc(&cmd_json) {
        Ok(doc) => doc,
        Err(e) => return Err(throw_error(&ctx, &format!("Invalid command: {e}"))),
    };

    let result = ENGINE_STATE.with(|state| {
        let state = state.borrow();
        let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;

        if state.cancel_flag.load(Ordering::Relaxed) {
            return Err(throw_error(&ctx, "Query execution cancelled"));
        }

        let r = state.handle.block_on(async {
            let admin_db = state.db.client().database("admin");
            admin_db.run_command(cmd_doc).await.map_err(|e| e.to_string())
        });
        match r {
            Ok(doc) => Ok(doc),
            Err(e) => Err(throw_error(&ctx, &format!("MongoDB error: {e}"))),
        }
    })?;

    let json = match bson_doc_to_json(&result) {
        Ok(v) => v,
        Err(e) => return Err(throw_error(&ctx, &format!("Serialization error: {e}"))),
    };
    json_to_js(&ctx, &json)
}

fn db_version(ctx: Ctx<'_>) -> rquickjs::Result<String> {
    ENGINE_STATE.with(|state| {
        let state = state.borrow();
        let state = state.as_ref().ok_or(rquickjs::Error::Unknown)?;

        let result = state.handle.block_on(async {
            let admin_db = state.db.client().database("admin");
            let result = admin_db
                .run_command(mongodb::bson::doc! { "buildInfo": 1 })
                .await
                .map_err(|e| e.to_string())?;
            Ok::<_, String>(
                result
                    .get_str("version")
                    .unwrap_or("unknown")
                    .to_string(),
            )
        });
        match result {
            Ok(v) => Ok(v),
            Err(e) => Err(throw_error(&ctx, &format!("MongoDB error: {e}"))),
        }
    })
}
