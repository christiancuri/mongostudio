#![warn(clippy::all, clippy::pedantic)]
#![deny(clippy::unwrap_used)]

mod commands;
mod error;
mod models;
mod services;
mod state;

use state::AppState;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .setup(|app| {
            // Custom menu to override Cmd+W (close window → close tab)
            let close_tab = MenuItemBuilder::with_id("close_tab", "Close Tab")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit MongoStudio")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&close_tab)
                .separator()
                .item(&quit)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "close_tab" => {
                        // Emit to frontend to close active tab
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.emit("close-active-tab", ());
                        }
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::connection::connect,
            commands::connection::disconnect,
            commands::connection::test_connection,
            commands::connection::list_saved_connections,
            commands::connection::save_connection,
            commands::connection::delete_connection,
            commands::database::list_databases,
            commands::database::list_collections,
            commands::database::list_collections_with_stats,
            commands::database::collection_stats,
            commands::database::database_stats,
            commands::database::list_indexes,
            commands::database::get_indexes_detail,
            commands::database::get_index_info,
            commands::query::execute_query,
            commands::query::explain_query,
            commands::query::cancel_execution,
            commands::document::insert_document,
            commands::document::update_document,
            commands::document::delete_document,
            commands::schema::analyze_schema,
            commands::import_export::import_data,
            commands::import_export::export_data,
            commands::monitoring::server_status,
            commands::monitoring::current_operations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
