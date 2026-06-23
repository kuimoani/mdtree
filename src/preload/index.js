import { contextBridge, ipcRenderer } from 'electron'

// Renderer talks to the filesystem only through this bridge — no direct fs access.
contextBridge.exposeInMainWorld('api', {
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  pathInfo: (path) => ipcRenderer.invoke('fs:pathInfo', path),
  readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
  createFile: (dir, name) => ipcRenderer.invoke('fs:createFile', dir, name),
  createFolder: (dir, name) => ipcRenderer.invoke('fs:createFolder', dir, name),
  rename: (oldPath, newName) => ipcRenderer.invoke('fs:rename', oldPath, newName),
  delete: (path) => ipcRenderer.invoke('fs:delete', path),
  searchInFiles: (roots, query) => ipcRenderer.invoke('fs:searchInFiles', roots, query),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
})
