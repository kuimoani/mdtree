# MDTree

A lightweight, multi-root Markdown note app for Window.

MDTree treats a set of local folders as your notebook. Open one or more directories as workspaces, browse and edit `.md` files in a tabbed editor, and switch between raw Markdown and a live-styled preview without ever leaving plain text files on disk.

![Screenshot](screenshot.png)

## Features

- **Multi-root workspaces** — add, remove, and reorder any number of local folders in the sidebar; each is a fully independent root with its own resizable, collapsible tree.
- **Markdown editor (CodeMirror 6)** with two view modes:
  - **Source** — raw Markdown with syntax-aware coloring and font styling, no characters hidden.
  - **Live Preview** — an Obsidian-style hybrid view: formatting markers are hidden on inactive lines, headings/bold/italic render styled, checkboxes are interactive, links are clickable, images render inline, and GFM tables render as real `<table>` elements. The line under the cursor always reverts to raw text so you can edit it.
- **Formatting toolbar** — headings, bold/italic/strikethrough, inline code, bullet/numbered/check lists, blockquote, links, images, tables, fenced code blocks, and horizontal rules.
- **File management** — create, rename, and delete files/folders from the sidebar (right-click or the toolbar icons); deletions go to the Recycle Bin, not permanent removal.
- **Drag and drop** — drop a folder onto the sidebar to add it as a workspace, drop a `.md` file anywhere to open it, and drag files between folders in the tree to move them.
- **Tabs** — open multiple files at once, with unsaved-change indicators and a confirmation prompt before closing a tab with unsaved edits.
- **Manual save** (`Ctrl+S`) — no silent autosave; you control when changes hit disk.
- **Workspace search** — full-text search across every open workspace, with results that jump straight to the matching line.
- **Folder filtering** — the tree hides folders that don't contain any Markdown files by default (toggle "show all folders" in the sidebar menu).
- **Customizable** — toggle line numbers, set a custom font family/size, all from a two-pane Settings dialog.
- **Session persistence** — open tabs, workspaces, sidebar layout, and window state are restored the next time you launch the app.
- **Dark theme** — MDTree is dark-mode only by design.

## Tech stack

- [Electron](https://www.electronjs.org/) — desktop shell, packaged with [electron-vite](https://electron-vite.org/) and [electron-builder](https://www.electron.build/)
- [Lit](https://lit.dev/) — lightweight Web Components for the UI
- [CodeMirror 6](https://codemirror.net/) — the editor engine, with [`@lezer/markdown`](https://github.com/lezer-parser/markdown) (GFM) for parsing
- Plain ESM JavaScript, no framework runtime beyond Lit

## Getting started

```sh
npm install
npm run dev      # start in development mode
```

### Building

```sh
npm run build    # build the renderer/main/preload bundles
npm run package  # build + package a Windows installer (electron-builder, NSIS)
```

The packaged installer is written to `release/`.

> **Note:** this project currently targets **Windows only**. macOS/Linux packaging is not configured.

## Project structure

```
src/
├─ main/            # Electron main process (window, filesystem IPC, session/settings persistence)
├─ preload/          # contextBridge bridge exposed to the renderer as window.api
└─ renderer/
   ├─ index.html
   └─ components/    # Lit components: app shell, sidebar, tree, tabs, editor, settings, shared UI helpers
```

The renderer never touches the filesystem directly — all reads/writes go through the IPC bridge in `src/preload`, handled in `src/main/index.js`.

## License

MIT
