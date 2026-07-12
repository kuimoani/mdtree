use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

static DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

// Portable by default: store session/settings next to the executable so they
// travel with it. Falls back to the per-user app data dir if that location
// isn't writable (e.g. installed to Program Files without admin rights).
fn data_dir(app: &AppHandle) -> PathBuf {
    DATA_DIR
        .get_or_init(|| {
            if let Ok(exe) = std::env::current_exe() {
                if let Some(dir) = exe.parent() {
                    let probe = dir.join(".mdtree-write-test");
                    if fs::write(&probe, b"").is_ok() {
                        let _ = fs::remove_file(&probe);
                        return dir.to_path_buf();
                    }
                }
            }
            app.path().app_data_dir().expect("app data dir")
        })
        .clone()
}

fn state_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("session.json")
}

fn settings_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("settings.json")
}

fn default_state() -> Value {
    json!({ "workspaces": [], "tabs": [] })
}

fn default_settings() -> Value {
    json!({
        "showAllFolders": false,
        "showLineNumbers": true,
        "fontFamily": "",
        "fontSize": 14,
        "editorTheme": "dark",
        "viewMode": "edit"
    })
}

fn load_merged(path: &std::path::Path, defaults: Value) -> Value {
    match fs::read_to_string(path) {
        Ok(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(Value::Object(map)) => {
                let mut merged = defaults;
                if let Value::Object(base) = &mut merged {
                    for (k, v) in map {
                        base.insert(k, v);
                    }
                }
                merged
            }
            _ => defaults,
        },
        Err(_) => defaults,
    }
}

fn save(path: &std::path::Path, value: &Value) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let pretty = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, pretty).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn state_load(app: AppHandle) -> Value {
    load_merged(&state_file(&app), default_state())
}

#[tauri::command]
pub fn state_save(app: AppHandle, state: Value) -> Result<(), String> {
    save(&state_file(&app), &state)
}

#[tauri::command]
pub fn settings_load(app: AppHandle) -> Value {
    load_merged(&settings_file(&app), default_settings())
}

#[tauri::command]
pub fn settings_save(app: AppHandle, settings: Value) -> Result<(), String> {
    save(&settings_file(&app), &settings)
}
