import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  rename,
  stat,
} from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadState, saveState } from './store.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---- IPC: filesystem ----

ipcMain.handle('dialog:pickFolder', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return res.canceled ? null : res.filePaths[0]
})

// Tells the renderer whether a dropped path is a folder or a file.
ipcMain.handle('fs:pathInfo', async (_e, p) => {
  try {
    const s = await stat(p)
    return { exists: true, isDir: s.isDirectory(), name: basename(p) }
  } catch {
    return { exists: false, isDir: false, name: basename(p) }
  }
})

// List immediate children of a directory (folders + .md files only).
ipcMain.handle('fs:readDir', async (_e, dirPath) => {
  const entries = await readdir(dirPath, { withFileTypes: true })
  return entries
    .filter((d) => d.isDirectory() || d.name.toLowerCase().endsWith('.md'))
    .map((d) => ({
      name: d.name,
      path: join(dirPath, d.name),
      isDir: d.isDirectory(),
    }))
    .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
})

ipcMain.handle('fs:readFile', async (_e, filePath) => {
  return readFile(filePath, 'utf8')
})

ipcMain.handle('fs:writeFile', async (_e, filePath, content) => {
  await writeFile(filePath, content, 'utf8')
  return true
})

ipcMain.handle('fs:createFile', async (_e, dirPath, name) => {
  const full = join(dirPath, name.toLowerCase().endsWith('.md') ? name : `${name}.md`)
  await writeFile(full, '', { encoding: 'utf8', flag: 'wx' }) // wx: fail if exists
  return full
})

ipcMain.handle('fs:createFolder', async (_e, dirPath, name) => {
  const full = join(dirPath, name)
  await mkdir(full)
  return full
})

ipcMain.handle('fs:rename', async (_e, oldPath, newName) => {
  const target = join(dirname(oldPath), newName)
  await rename(oldPath, target)
  return target
})

// Move a file/folder into another directory (drag & drop in the tree).
ipcMain.handle('fs:move', async (_e, src, destDir) => {
  const target = join(destDir, basename(src))
  if (join(src) === join(target)) return { ok: false, reason: 'same' }
  if (dirname(src) === destDir) return { ok: false, reason: 'same-dir' }
  try {
    await stat(target)
    return { ok: false, reason: 'exists' } // refuse to clobber an existing entry
  } catch {
    /* target does not exist — good */
  }
  await rename(src, target)
  return { ok: true, newPath: target }
})

// Soft-delete to the OS recycle bin rather than permanent removal.
ipcMain.handle('fs:delete', async (_e, p) => {
  await shell.trashItem(p)
  return true
})

// Recursive case-insensitive substring search across roots. Returns matching lines.
ipcMain.handle('fs:searchInFiles', async (_e, roots, query) => {
  const q = String(query || '').toLowerCase()
  if (!q) return []
  const results = []
  const MAX = 300

  async function walk(dir) {
    if (results.length >= MAX) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const d of entries) {
      if (results.length >= MAX) return
      const full = join(dir, d.name)
      if (d.isDirectory()) {
        if (d.name === 'node_modules' || d.name.startsWith('.')) continue
        await walk(full)
      } else if (d.name.toLowerCase().endsWith('.md')) {
        let text
        try {
          text = await readFile(full, 'utf8')
        } catch {
          continue
        }
        const lines = text.split(/\r?\n/)
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            results.push({ path: full, name: basename(full), line: i + 1, text: lines[i].trim() })
            if (results.length >= MAX) return
          }
        }
      }
    }
  }

  for (const r of roots) await walk(r)
  return results
})

ipcMain.handle('shell:openExternal', async (_e, url) => {
  await shell.openExternal(url)
  return true
})

// ---- IPC: session state ----

ipcMain.handle('state:load', () => loadState())
ipcMain.handle('state:save', (_e, state) => saveState(state))

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
