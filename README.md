# MDTree

A lightweight, multi-root Markdown note app for Windows.

MDTree treats a set of local folders as your notebook. Open one or more directories as workspaces, browse and edit `.md` files in a tabbed editor, and switch freely between raw Markdown, a rendered preview, and a live side-by-side view — all while your notes stay as plain `.md` files on disk.

![Screenshot](screenshot.png)

## Features

- **Multi-root workspaces** — add, remove, and reorder any number of local folders in the sidebar; each is an independent root with its own resizable, collapsible tree.
- **Markdown editor (EasyMDE)** with three view modes, toggled from the toolbar:
  - **Edit** — raw Markdown with syntax-aware coloring.
  - **Preview** — the rendered document (read-only), with syntax-highlighted fenced code blocks.
  - **Side-by-side** — editor and live preview in two independently scrolling panes.

  The selected view mode is remembered across documents and app restarts.
- **Full formatting toolbar** — headings, bold/italic/strikethrough, inline code, bullet/numbered/check lists, blockquote, links, images, tables, fenced code blocks, horizontal rules, undo/redo, plus a Save button that reflects the unsaved state.
- **Images** — several ways to add them, all rendered inline in the preview:
  - **Paste** an image from the clipboard — it's saved into an `assets/` folder next to the document and inserted as `![](assets/…)`.
  - **Drag & drop** an image file onto the editor — it's referenced in place (relative path) at the drop location, without copying.
  - **Insert from the toolbar** — pick a local image file to reference.

  Local images are served to the preview through a privileged `mdfile://` protocol, since Chromium blocks `file://` resources in the renderer.
- **Syntax highlighting** — fenced code blocks are highlighted in the preview via highlight.js (One Dark theme).
- **File management** — create, rename, and delete files/folders from the sidebar (right-click or the toolbar icons); deletions go to the Recycle Bin, not permanent removal.
- **Drag and drop** — drop a folder onto the sidebar to add it as a workspace, drop a `.md` file anywhere to open it, and drag files between folders in the tree to move them.
- **Tabs** — open multiple files at once, with unsaved-change indicators, middle-click (or ×) to close, and a confirmation prompt before closing a tab with unsaved edits.
- **Manual save** (`Ctrl+S`) — no silent autosave; you control when changes hit disk.
- **Workspace search** — full-text search across every open workspace, with results that jump straight to the matching line.
- **Folder filtering** — the tree hides folders that contain no Markdown files by default (toggle "show all folders" in the sidebar menu).
- **Customizable** — set a custom font family and size from the Settings dialog.
- **Session persistence** — open tabs, workspaces, sidebar layout, and the last view mode are restored the next time you launch the app.
- **Dark theme** — MDTree is dark-mode only by design.

## Tech stack

- [Electron](https://www.electronjs.org/) — desktop shell, packaged with [electron-vite](https://electron-vite.org/) and [electron-builder](https://www.electron.build/)
- [Lit](https://lit.dev/) — lightweight Web Components for the UI
- [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) — the Markdown editor (CodeMirror 5 + [marked](https://marked.js.org/) under the hood)
- [highlight.js](https://highlightjs.org/) — code-block syntax highlighting in the preview
- [Font Awesome 4](https://fontawesome.com/v4/) — toolbar icons (bundled offline)
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
├─ main/            # Electron main process: window, filesystem IPC,
│                   #   the mdfile:// image protocol, session/settings persistence
├─ preload/         # contextBridge bridge exposed to the renderer as window.api
└─ renderer/
   ├─ index.html
   └─ components/   # Lit components: app shell, sidebar, tree, tabs,
                    #   editor (EasyMDE), settings, shared UI helpers
```

The renderer never touches the filesystem directly — all reads/writes go through the IPC bridge in `src/preload`, handled in `src/main/index.js`.

## License

MIT
