// Tauri equivalent of the old Electron preload script. Builds the same
// `window.api` surface the rest of the renderer already calls, so app.js /
// editor.js / sidebar.js / tree-item.js / settings.js / ui.js need no changes.
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']

// Chunked to avoid call-stack blowups on large images (String.fromCharCode.apply
// with a huge argument list throws "Maximum call stack size exceeded").
function bytesToBase64(bytes) {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

window.api = {
  pickFolder: async () => (await open({ directory: true })) || null,
  pickImage: async () =>
    (await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    })) || null,
  pathInfo: (path) => invoke('path_info', { path }),
  readDir: (path, showAllFolders = false) => invoke('read_dir', { dirPath: path, showAllFolders }),
  readFile: (path) => invoke('read_file', { filePath: path }),
  writeFile: (path, content) => invoke('write_file', { filePath: path, content }),
  saveImage: (baseFilePath, data, name) =>
    invoke('save_image', { baseFilePath, data: bytesToBase64(data), suggestedName: name }),
  createFile: (dir, name) => invoke('create_file', { dirPath: dir, name }),
  createFolder: (dir, name) => invoke('create_folder', { dirPath: dir, name }),
  rename: (oldPath, newName) => invoke('rename_path', { oldPath, newName }),
  move: (src, destDir) => invoke('move_path', { src, destDir }),
  delete: (path) => invoke('delete_path', { path }),
  searchInFiles: (roots, query) => invoke('search_in_files', { roots, query }),
  openExternal: (url) => openUrl(url),
  loadState: () => invoke('state_load'),
  saveState: (state) => invoke('state_save', { state }),
  loadSettings: () => invoke('settings_load'),
  saveSettings: (s) => invoke('settings_save', { settings: s }),
  getVersion: () => getVersion(),
}

// Used by editor.js to turn a local absolute path into a URL the webview is
// allowed to load (replaces the old Electron `mdfile://` custom protocol).
window.mdtreeConvertFileSrc = convertFileSrc
