use std::sync::atomic::Ordering;

use rquickjs::{Ctx, Function, Value};
use rquickjs::prelude::Opt;

use super::ENGINE_STATE;

/// Register all global helper functions: ObjectId, ISODate, NumberLong, etc.
pub fn register_globals<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<()> {
    let globals = ctx.globals();

    // __print: internal function used by print() and console.log()
    globals.set(
        "__print",
        Function::new(ctx.clone(), |msg: String| {
            ENGINE_STATE.with(|state| {
                let state = state.borrow();
                if let Some(s) = state.as_ref() {
                    s.print_output.borrow_mut().push(msg);
                }
            });
        })?,
    )?;

    // __checkCancelled: check if execution was cancelled
    globals.set(
        "__checkCancelled",
        Function::new(ctx.clone(), |ctx: Ctx<'_>| -> rquickjs::Result<()> {
            ENGINE_STATE.with(|state| {
                let state = state.borrow();
                if let Some(s) = state.as_ref() {
                    if s.cancel_flag.load(Ordering::Relaxed) {
                        return Err(throw_error(&ctx, "Query execution cancelled"));
                    }
                }
                Ok(())
            })
        })?,
    )?;

    // sleep(ms): pause execution, check cancel flag after
    globals.set(
        "sleep",
        Function::new(ctx.clone(), |ctx: Ctx<'_>, ms: u64| -> rquickjs::Result<()> {
            let total = std::time::Duration::from_millis(ms);
            let increment = std::time::Duration::from_millis(100);
            let start = std::time::Instant::now();

            while start.elapsed() < total {
                let remaining = total.saturating_sub(start.elapsed());
                std::thread::sleep(remaining.min(increment));

                let cancelled = ENGINE_STATE.with(|state| {
                    let state = state.borrow();
                    state
                        .as_ref()
                        .map_or(false, |s| s.cancel_flag.load(Ordering::Relaxed))
                });
                if cancelled {
                    return Err(throw_error(&ctx, "Query execution cancelled"));
                }
            }
            Ok(())
        })?,
    )?;

    // ObjectId(str?): create an ObjectId extended JSON object
    globals.set(
        "ObjectId",
        Function::new(
            ctx.clone(),
            |ctx: Ctx<'js>, hex: Opt<String>| -> rquickjs::Result<Value<'js>> {
                let oid = match hex.0 {
                    Some(h) => mongodb::bson::oid::ObjectId::parse_str(&h)
                        .map_err(|e| throw_error(&ctx, &format!("Invalid ObjectId: {e}")))?,
                    None => mongodb::bson::oid::ObjectId::new(),
                };
                let json = serde_json::json!({"$oid": oid.to_hex()});
                super::bson_convert::json_to_js(&ctx, &json)
            },
        )?,
    )?;

    // ISODate(str?): create a Date extended JSON object
    globals.set(
        "ISODate",
        Function::new(
            ctx.clone(),
            |ctx: Ctx<'js>, date_str: Opt<String>| -> rquickjs::Result<Value<'js>> {
                let dt = match date_str.0 {
                    Some(s) => {
                        chrono::DateTime::parse_from_rfc3339(&s)
                            .map(|d| d.with_timezone(&chrono::Utc))
                            .or_else(|_| {
                                chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S%.fZ")
                                    .map(|d| d.and_utc())
                            })
                            .or_else(|_| {
                                chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d")
                                    .map(|d| {
                                        d.and_hms_opt(0, 0, 0)
                                            .expect("valid HMS")
                                            .and_utc()
                                    })
                            })
                            .map_err(|e| throw_error(&ctx, &format!("Invalid date: {e}")))?
                    }
                    None => chrono::Utc::now(),
                };
                let json = serde_json::json!({"$date": dt.to_rfc3339()});
                super::bson_convert::json_to_js(&ctx, &json)
            },
        )?,
    )?;

    // NumberLong(n): create a NumberLong extended JSON object
    globals.set(
        "NumberLong",
        Function::new(
            ctx.clone(),
            |ctx: Ctx<'js>, n: Value<'js>| -> rquickjs::Result<Value<'js>> {
                let val: i64 = if let Some(s) = n.as_string() {
                    let s = s.to_string()?;
                    s.parse::<i64>()
                        .map_err(|e| throw_error(&ctx, &format!("Invalid NumberLong: {e}")))?
                } else if let Some(i) = n.as_int() {
                    i64::from(i)
                } else if let Some(f) = n.as_float() {
                    #[allow(clippy::cast_possible_truncation)]
                    {
                        f as i64
                    }
                } else {
                    return Err(throw_error(&ctx, "NumberLong expects a number or string"));
                };
                let json = serde_json::json!({"$numberLong": val.to_string()});
                super::bson_convert::json_to_js(&ctx, &json)
            },
        )?,
    )?;

    // NumberInt(n): just returns an integer
    globals.set(
        "NumberInt",
        Function::new(
            ctx.clone(),
            |ctx: Ctx<'_>, n: Value<'_>| -> rquickjs::Result<i32> {
                if let Some(i) = n.as_int() {
                    Ok(i)
                } else if let Some(f) = n.as_float() {
                    #[allow(clippy::cast_possible_truncation)]
                    Ok(f as i32)
                } else if let Some(s) = n.as_string() {
                    let s = s.to_string()?;
                    s.parse::<i32>()
                        .map_err(|e| throw_error(&ctx, &format!("Invalid NumberInt: {e}")))
                } else {
                    Err(throw_error(&ctx, "NumberInt expects a number or string"))
                }
            },
        )?,
    )?;

    // NumberDecimal(str): create a NumberDecimal extended JSON object
    globals.set(
        "NumberDecimal",
        Function::new(
            ctx.clone(),
            |ctx: Ctx<'js>, s: String| -> rquickjs::Result<Value<'js>> {
                let json = serde_json::json!({"$numberDecimal": s});
                super::bson_convert::json_to_js(&ctx, &json)
            },
        )?,
    )?;

    // Inject print() and console via JS (wrapping __print)
    ctx.eval::<(), _>(
        r"
        function print(...args) {
            __print(args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a, null, 2) : String(a)).join(' '));
        }
        globalThis.console = {
            log: print,
            warn: function(...args) {
                __print('[WARN] ' + args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)).join(' '));
            },
            error: function(...args) {
                __print('[ERROR] ' + args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)).join(' '));
            },
            info: print,
        };
    ",
    )?;

    Ok(())
}

/// Helper to create a JS error and return it as rquickjs::Error
pub fn throw_error(ctx: &Ctx<'_>, msg: &str) -> rquickjs::Error {
    let Ok(js_str) = rquickjs::String::from_str(ctx.clone(), msg) else {
        return rquickjs::Error::Unknown;
    };
    ctx.throw(js_str.into_value())
}
