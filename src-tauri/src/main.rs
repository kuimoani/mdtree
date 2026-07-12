#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod store;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::path_info,
            commands::read_dir,
            commands::read_file,
            commands::write_file,
            commands::save_image,
            commands::create_file,
            commands::create_folder,
            commands::rename_path,
            commands::move_path,
            commands::delete_path,
            commands::search_in_files,
            store::state_load,
            store::state_save,
            store::settings_load,
            store::settings_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
