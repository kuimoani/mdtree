import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Tauri expects a fixed dev server port (matches src-tauri/tauri.conf.json
// build.devUrl) and wants console output left alone so cargo's build log stays
// visible. See https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  root: 'src/renderer',
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../../out/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: resolve('src/renderer/index.html') },
    },
  },
})
