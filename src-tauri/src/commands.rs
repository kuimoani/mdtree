use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct PathInfo {
    exists: bool,
    #[serde(rename = "isDir")]
    is_dir: bool,
    name: String,
}

#[derive(Serialize)]
pub struct DirEntryInfo {
    name: String,
    path: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
}

#[derive(Serialize)]
pub struct MoveResult {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    #[serde(rename = "newPath", skip_serializing_if = "Option::is_none")]
    new_path: Option<String>,
}

#[derive(Serialize)]
pub struct SearchResult {
    path: String,
    name: String,
    line: usize,
    text: String,
}

fn name_of(p: &Path) -> String {
    p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
}

#[tauri::command]
pub fn path_info(path: String) -> PathInfo {
    let p = Path::new(&path);
    match fs::metadata(p) {
        Ok(meta) => PathInfo { exists: true, is_dir: meta.is_dir(), name: name_of(p) },
        Err(_) => PathInfo { exists: false, is_dir: false, name: name_of(p) },
    }
}

fn dir_has_markdown(dir: &Path) -> bool {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return false,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if name == "node_modules" || name.starts_with('.') {
                continue;
            }
            if dir_has_markdown(&path) {
                return true;
            }
        } else if name.to_lowercase().ends_with(".md") {
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn read_dir(dir_path: String, show_all_folders: bool) -> Result<Vec<DirEntryInfo>, String> {
    let dir = Path::new(&dir_path);
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if !show_all_folders && !dir_has_markdown(&path) {
                continue;
            }
            out.push(DirEntryInfo { name, path: path.to_string_lossy().to_string(), is_dir: true });
        } else if name.to_lowercase().ends_with(".md") {
            out.push(DirEntryInfo { name, path: path.to_string_lossy().to_string(), is_dir: false });
        }
    }
    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(out)
}

#[tauri::command]
pub fn read_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file(file_path: String, content: String) -> Result<(), String> {
    fs::write(file_path, content).map_err(|e| e.to_string())
}

// `data` arrives base64-encoded from the renderer to keep the IPC payload small.
#[tauri::command]
pub fn save_image(base_file_path: String, data: String, suggested_name: String) -> Result<String, String> {
    let base = Path::new(&base_file_path);
    let dir = base.parent().unwrap_or_else(|| Path::new(".")).join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let mut name: String = suggested_name
        .chars()
        .map(|c| if "\\/:*?\"<>|".contains(c) { '_' } else { c })
        .collect();
    if name.is_empty() {
        name = "image.png".to_string();
    }
    if !name.contains('.') {
        name.push_str(".png");
    }
    let (stem, ext) = match name.rfind('.') {
        Some(i) => (name[..i].to_string(), name[i..].to_string()),
        None => (name.clone(), String::new()),
    };

    let mut target = dir.join(&name);
    let mut i = 1;
    while target.exists() {
        target = dir.join(format!("{stem}-{i}{ext}"));
        i += 1;
    }

    let bytes = STANDARD.decode(data).map_err(|e| e.to_string())?;
    fs::write(&target, bytes).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_file(dir_path: String, name: String) -> Result<String, String> {
    let file_name = if name.to_lowercase().ends_with(".md") { name } else { format!("{name}.md") };
    let full = Path::new(&dir_path).join(file_name);
    if full.exists() {
        return Err("EEXIST".to_string());
    }
    fs::write(&full, "").map_err(|e| e.to_string())?;
    Ok(full.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_folder(dir_path: String, name: String) -> Result<String, String> {
    let full = Path::new(&dir_path).join(name);
    fs::create_dir(&full).map_err(|e| e.to_string())?;
    Ok(full.to_string_lossy().to_string())
}

#[tauri::command]
pub fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    let old = Path::new(&old_path);
    let target = old.parent().unwrap_or_else(|| Path::new(".")).join(new_name);
    fs::rename(old, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn move_path(src: String, dest_dir: String) -> MoveResult {
    let src_path = PathBuf::from(&src);
    let dest_dir_path = PathBuf::from(&dest_dir);
    let target = dest_dir_path.join(name_of(&src_path));

    if src_path == target {
        return MoveResult { ok: false, reason: Some("same".into()), new_path: None };
    }
    if src_path.parent() == Some(dest_dir_path.as_path()) {
        return MoveResult { ok: false, reason: Some("same-dir".into()), new_path: None };
    }
    if target.exists() {
        return MoveResult { ok: false, reason: Some("exists".into()), new_path: None };
    }
    match fs::rename(&src_path, &target) {
        Ok(_) => MoveResult { ok: true, reason: None, new_path: Some(target.to_string_lossy().to_string()) },
        Err(e) => MoveResult { ok: false, reason: Some(e.to_string()), new_path: None },
    }
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_in_files(roots: Vec<String>, query: String) -> Vec<SearchResult> {
    const MAX: usize = 300;
    let q = query.to_lowercase();
    let mut results = Vec::new();
    if q.is_empty() {
        return results;
    }

    fn walk(dir: &Path, q: &str, results: &mut Vec<SearchResult>) {
        if results.len() >= MAX {
            return;
        }
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            if results.len() >= MAX {
                return;
            }
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                if name == "node_modules" || name.starts_with('.') {
                    continue;
                }
                walk(&path, q, results);
            } else if name.to_lowercase().ends_with(".md") {
                let text = match fs::read_to_string(&path) {
                    Ok(t) => t,
                    Err(_) => continue,
                };
                for (i, line) in text.lines().enumerate() {
                    if line.to_lowercase().contains(q) {
                        results.push(SearchResult {
                            path: path.to_string_lossy().to_string(),
                            name: name.clone(),
                            line: i + 1,
                            text: line.trim().to_string(),
                        });
                        if results.len() >= MAX {
                            return;
                        }
                    }
                }
            }
        }
    }

    for r in &roots {
        walk(Path::new(r), &q, &mut results);
    }
    results
}
