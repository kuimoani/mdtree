import { LitElement, html, css } from 'lit'
import { promptText, showContextMenu, notifyFsChange, openSettingsDialog } from './ui.js'
import { getSettings, setSettings } from './settings.js'

const DEFAULT_ROOT_HEIGHT = 220

const DRAG_TYPE = 'application/x-mdtree-path'
const sepOf = (p) => (p.includes('\\') ? '\\' : '/')
const parentDir = (p) => p.replace(/[\\/][^\\/]*$/, '')
const isDescendant = (child, anc) => child === anc || child.startsWith(anc + sepOf(anc))

// Left panel: collapsible multi-root workspaces + lazy folder trees + global search.
export class MdSidebar extends LitElement {
  static properties = {
    workspaces: {},
    rootHeights: {}, // path -> px (from app, persisted)
    _dragIndex: { state: true },
    _collapsed: { state: true }, // Set of collapsed root paths
    _searchOpen: { state: true },
    _query: { state: true },
    _results: { state: true },
    _searching: { state: true },
    _drag: { state: true }, // active root-height drag { path, height }
  }

  constructor() {
    super()
    this.workspaces = []
    this.rootHeights = {}
    this._dragIndex = -1
    this._collapsed = new Set()
    this._searchOpen = false
    this._query = ''
    this._results = []
    this._searching = false
    this._drag = null
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      font-size: 13px;
    }
    .roots {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      /* Scroll the whole list when expanded roots don't all fit, instead of
         clipping a root out of view. */
      overflow-y: auto;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      color: #888;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    header .actions { display: flex; gap: 4px; }
    header button {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
    }
    header button:hover { color: #fff; }
    header button.on { color: #4daafc; }
    .search {
      padding: 6px 10px;
      border-bottom: 1px solid #2d2d2d;
    }
    .search input {
      width: 100%;
      box-sizing: border-box;
      background: #1e1e1e;
      color: #d4d4d4;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 12px;
      outline: none;
    }
    .search input:focus { border-color: #0e639c; }
    .results { max-height: 40vh; overflow: auto; }
    .result {
      padding: 4px 10px;
      cursor: pointer;
      border-bottom: 1px solid #2a2a2a;
    }
    .result:hover { background: #2a2d2e; }
    .result .file { color: #4daafc; font-size: 11px; }
    .result .line { color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hint { padding: 8px 10px; color: #666; font-size: 12px; }
    .root {
      display: flex;
      flex-direction: column;
      border-width: 1px;
      border-style: solid;
      border-color: #333333;
      border-radius: 10px;
      margin: 0px 4px 4px 4px;
      background: #1c1c1c;
    }
    /* Expanded roots have an explicit, drag-adjustable height; the root list
       scrolls when they don't all fit. */
    .root.expanded { flex: 0 0 auto; }
    .root.collapsed { flex: 0 0 auto; }
    .root-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
    }
    .root-resizer {
      flex: 0 0 auto;
      height: 5px;
      cursor: row-resize;
      background: transparent;
    }
    .root-resizer:hover { background: #0e639c; }
    .root-head {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 8px;
      font-weight: 600;
      color: #cccccc;
      cursor: pointer;
      user-select: none;
    }
    .root-head:hover { background: #2a2d2e; }
    .root-head.dragover { border-top: 2px solid #0e639c; }
    .root-head .twisty { width: 12px; text-align: center; color: #888; font-size: 10px; }
    .root-head .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .newdoc {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 12px;
      padding: 0 2px;
      opacity: 0.8;
    }
    .newdoc:hover { opacity: 1; }
    .remove {
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
    }
    .remove:hover { color: #f48771; }
    .empty { padding: 16px 10px; color: #666; }
  `

  // ---- reorder drag ----
  _onDragStart(i, e) {
    this._dragIndex = i
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-mdtree-root', String(i))
  }
  _onDragOver(e) {
    e.preventDefault()
    e.currentTarget.classList.add('dragover')
  }
  _onDragLeave(e) {
    e.currentTarget.classList.remove('dragover')
  }
  _onDrop(i, e) {
    e.preventDefault()
    e.currentTarget.classList.remove('dragover')
    if (this._dragIndex < 0 || this._dragIndex === i) return
    const next = [...this.workspaces]
    const [moved] = next.splice(this._dragIndex, 1)
    next.splice(i, 0, moved)
    this._dragIndex = -1
    this.dispatchEvent(new CustomEvent('reorder-workspaces', { detail: { workspaces: next } }))
  }

  // ---- collapse ----
  _toggleRoot(path) {
    const next = new Set(this._collapsed)
    next.has(path) ? next.delete(path) : next.add(path)
    this._collapsed = next
  }

  // ---- context menus (create at root) ----
  _rootMenu(root, e) {
    e.preventDefault()
    showContextMenu(e.clientX, e.clientY, [
      { label: 'New Document', action: () => this._createAtRoot(root, 'file') },
      { label: 'New Folder', action: () => this._createAtRoot(root, 'folder') },
      { sep: true },
      {
        label: 'Remove Workspace',
        danger: true,
        action: () =>
          this.dispatchEvent(
            new CustomEvent('remove-workspace', { detail: { path: root.path } })
          ),
      },
    ])
  }

  // Right-click on the empty area of a root's body.
  _rootBodyMenu(root, e) {
    e.preventDefault()
    showContextMenu(e.clientX, e.clientY, [
      { label: 'New Document', action: () => this._createAtRoot(root, 'file') },
      { label: 'New Folder', action: () => this._createAtRoot(root, 'folder') },
    ])
  }

  async _createAtRoot(root, kind) {
    const name = await promptText(
      kind === 'file' ? 'New document name' : 'New folder name',
      kind === 'file' ? 'untitled.md' : 'new-folder'
    )
    if (!name) return
    try {
      // Make sure the root is expanded so the new entry is visible.
      this._collapsed = new Set([...this._collapsed].filter((p) => p !== root.path))
      if (kind === 'file') {
        const full = await window.api.createFile(root.path, name)
        notifyFsChange([root.path])
        this.dispatchEvent(
          new CustomEvent('open-file', { detail: { path: full }, bubbles: true, composed: true })
        )
      } else {
        await window.api.createFolder(root.path, name)
        notifyFsChange([root.path])
      }
    } catch (err) {
      console.error(err)
    }
  }

  // ---- drop a tree entry onto a root's body to move it to the root ----
  _onRootDragOver(e) {
    if (![...e.dataTransfer.types].includes(DRAG_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async _onRootDrop(root, e) {
    const src = e.dataTransfer.getData(DRAG_TYPE)
    if (!src) return // external (OS) drop — let the window handler add a workspace
    e.preventDefault()
    e.stopPropagation()
    if (isDescendant(root.path, src) || parentDir(src) === root.path) return
    try {
      const res = await window.api.move(src, root.path)
      if (!res?.ok) return
      this.dispatchEvent(
        new CustomEvent('file-renamed', {
          detail: { oldPath: src, newPath: res.newPath, isDir: false },
          bubbles: true,
          composed: true,
        })
      )
      notifyFsChange([parentDir(src), root.path])
    } catch (err) {
      console.error('move failed', err)
    }
  }

  // ---- overflow (...) menu: folder visibility + settings + about ----
  _moreMenu(e) {
    e.stopPropagation()
    const s = getSettings()
    showContextMenu(e.clientX, e.clientY, [
      {
        label: s.showAllFolders ? 'Show folders with .md only' : 'Show all folders',
        action: () => setSettings({ showAllFolders: !s.showAllFolders }),
      },
      { sep: true },
      { label: 'Settings', action: () => this._openSettings('general') },
      { label: 'About', action: () => this._openSettings('about') },
    ])
  }

  async _openSettings(tab = 'general') {
    const version = await window.api.getVersion().catch(() => '0.1.0')
    const res = await openSettingsDialog(getSettings(), version, tab)
    if (res) setSettings(res)
  }

  // ---- per-root height drag ----
  _rootHeight(path) {
    if (this._drag?.path === path) return this._drag.height
    return this.rootHeights?.[path] || DEFAULT_ROOT_HEIGHT
  }

  _startRootResize(path, e) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startH = this._rootHeight(path)
    const move = (ev) => {
      this._drag = { path, height: Math.max(60, startH + (ev.clientY - startY)) }
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      if (this._drag) {
        this.dispatchEvent(
          new CustomEvent('resize-root', {
            detail: { path: this._drag.path, height: this._drag.height },
          })
        )
        this._drag = null
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // ---- search ----
  _toggleSearch() {
    this._searchOpen = !this._searchOpen
  }

  async _runSearch(e) {
    this._query = e.target.value
    if (!this._query.trim()) {
      this._results = []
      return
    }
    this._searching = true
    const roots = this.workspaces.map((w) => w.path)
    this._results = await window.api.searchInFiles(roots, this._query)
    this._searching = false
  }

  _openResult(r) {
    this.dispatchEvent(
      new CustomEvent('open-file', {
        detail: { path: r.path, line: r.line },
        bubbles: true,
        composed: true,
      })
    )
  }

  render() {
    return html`
      <header>
        <span>Workspaces</span>
        <div class="actions">
          <button
            class=${this._searchOpen ? 'on' : ''}
            title="Search all"
            @click=${this._toggleSearch}
          >
            🔍
          </button>
          <button title="Add folder" @click=${() => this.dispatchEvent(new CustomEvent('add-workspace'))}>
            +
          </button>
          <button title="More" @click=${this._moreMenu}>⋯</button>
          <button
            title="Collapse sidebar"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('toggle-sidebar', { bubbles: true, composed: true })
              )}
          >
            ⟨
          </button>
        </div>
      </header>

      ${this._searchOpen
        ? html`
            <div class="search">
              <input
                type="text"
                placeholder="Search across all workspaces…"
                .value=${this._query}
                @input=${this._runSearch}
              />
            </div>
            <div class="results">
              ${this._searching
                ? html`<div class="hint">Searching…</div>`
                : this._query.trim() && this._results.length === 0
                  ? html`<div class="hint">No results</div>`
                  : this._results.map(
                      (r) => html`<div class="result" @click=${() => this._openResult(r)}>
                        <div class="file">${r.name}:${r.line}</div>
                        <div class="line">${r.text}</div>
                      </div>`
                    )}
            </div>
          `
        : ''}

      <div class="roots">
      ${this.workspaces.length === 0
        ? html`<div class="empty">Click + or drag a folder here</div>`
        : this.workspaces.map((w, i) => {
            const collapsed = this._collapsed.has(w.path)
            const style = collapsed ? '' : `height:${this._rootHeight(w.path)}px`
            return html`
              <div class="root ${collapsed ? 'collapsed' : 'expanded'}" style=${style}>
                <div
                  class="root-head"
                  draggable="true"
                  @click=${() => this._toggleRoot(w.path)}
                  @contextmenu=${(e) => this._rootMenu(w, e)}
                  @dragstart=${(e) => this._onDragStart(i, e)}
                  @dragover=${this._onDragOver}
                  @dragleave=${this._onDragLeave}
                  @drop=${(e) => this._onDrop(i, e)}
                >
                  <span class="twisty">${collapsed ? '▸' : '▾'}</span>
                  <span class="label">${w.name}</span>
                  <button
                    class="newdoc"
                    title="New document"
                    @click=${(e) => {
                      e.stopPropagation()
                      this._createAtRoot(w, 'file')
                    }}
                  >
                    📝
                  </button>
                  <button
                    class="remove"
                    title="Remove"
                    @click=${(e) => {
                      e.stopPropagation()
                      this.dispatchEvent(
                        new CustomEvent('remove-workspace', { detail: { path: w.path } })
                      )
                    }}
                  >
                    ×
                  </button>
                </div>
                ${collapsed
                  ? ''
                  : html`<div
                      class="root-body"
                      @contextmenu=${(e) => this._rootBodyMenu(w, e)}
                      @dragover=${this._onRootDragOver}
                      @drop=${(e) => this._onRootDrop(w, e)}
                    >
                      <md-tree-item
                        .path=${w.path}
                        .name=${w.name}
                        .isDir=${true}
                        .expanded=${true}
                        .root=${true}
                      ></md-tree-item>
                    </div>`}
                ${collapsed
                  ? ''
                  : html`<div
                      class="root-resizer"
                      title="Drag to resize height"
                      @mousedown=${(e) => this._startRootResize(w.path, e)}
                    ></div>`}
              </div>
            `
          })}
      </div>
    `
  }
}

customElements.define('md-sidebar', MdSidebar)
