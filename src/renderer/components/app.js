import { LitElement, html, css } from 'lit'

// Root shell: owns workspace + tab state, persists session, wires child components.
export class MdApp extends LitElement {
  static properties = {
    workspaces: { state: true }, // [{ path, name }]
    tabs: { state: true }, // [{ path, name, content, dirty, gotoLine }]
    activeIndex: { state: true },
    sidebarWidth: { state: true },
    sidebarCollapsed: { state: true },
  }

  constructor() {
    super()
    this.workspaces = []
    this.tabs = []
    this.activeIndex = -1
    this.sidebarWidth = 260
    this.sidebarCollapsed = false
    this._restored = false
  }

  static styles = css`
    :host {
      display: block;
      height: 100vh;
      position: relative;
    }
    .grid {
      display: grid;
      height: 100%;
    }
    .side {
      background: #252526;
      border-right: 1px solid #333;
      overflow: hidden;
    }
    .resizer {
      cursor: col-resize;
      background: transparent;
    }
    .resizer:hover,
    .resizer.active {
      background: #0e639c;
    }
    .expand-side {
      position: absolute;
      left: 6px;
      top: 7px;
      z-index: 5;
      width: 26px;
      height: 26px;
      background: #2d2d2d;
      border: 1px solid #444;
      color: #ccc;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .expand-side:hover { background: #37373d; color: #fff; }
    .main {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .editor-wrap {
      flex: 1;
      min-height: 0;
      position: relative;
    }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
      font-size: 14px;
    }
  `

  connectedCallback() {
    super.connectedCallback()
    this._restore()
    window.addEventListener('keydown', this._onKey)
    window.addEventListener('beforeunload', () => this._persist())
    // Window-level DnD: prevent Electron from navigating to dropped files.
    window.addEventListener('dragover', this._onDragOver)
    window.addEventListener('drop', this._onDrop)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('dragover', this._onDragOver)
    window.removeEventListener('drop', this._onDrop)
  }

  _onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      this._saveActive()
    }
  }

  // ---- global drag & drop ----
  _onDragOver = (e) => {
    e.preventDefault()
  }

  _onDrop = async (e) => {
    e.preventDefault()
    const files = [...(e.dataTransfer?.files || [])]
    for (const f of files) {
      if (!f.path) continue
      const info = await window.api.pathInfo(f.path)
      if (info.isDir) {
        this._addWorkspacePath(f.path)
      } else if (f.path.toLowerCase().endsWith('.md')) {
        this._openFile(f.path)
      }
    }
  }

  // ---- sidebar resize / collapse ----
  _toggleSidebar = () => {
    this.sidebarCollapsed = !this.sidebarCollapsed
    this._persist()
  }

  _startResize = (e) => {
    e.preventDefault()
    const move = (ev) => {
      // Sidebar starts at the left edge, so its width tracks the cursor X.
      this.sidebarWidth = Math.min(500, Math.max(160, ev.clientX))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      this._persist()
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  async _restore() {
    const state = await window.api.loadState()
    if (typeof state.sidebarWidth === 'number') this.sidebarWidth = state.sidebarWidth
    if (typeof state.sidebarCollapsed === 'boolean') this.sidebarCollapsed = state.sidebarCollapsed
    this.workspaces = (state.workspaces || []).map((p) => ({ path: p, name: baseName(p) }))
    for (const tab of state.tabs || []) {
      await this._openFile(tab.path, false)
    }
    if (this.tabs.length) {
      const idx = (state.tabs || []).findIndex((t) => t.active)
      this.activeIndex = idx >= 0 ? idx : 0
    }
    this._restored = true
  }

  _persist() {
    if (!this._restored) return
    window.api.saveState({
      workspaces: this.workspaces.map((w) => w.path),
      tabs: this.tabs.map((t, i) => ({ path: t.path, active: i === this.activeIndex })),
      sidebarWidth: this.sidebarWidth,
      sidebarCollapsed: this.sidebarCollapsed,
    })
  }

  // ---- workspace handlers ----
  async _addWorkspace() {
    const path = await window.api.pickFolder()
    this._addWorkspacePath(path)
  }

  _addWorkspacePath(path) {
    if (!path || this.workspaces.some((w) => w.path === path)) return
    this.workspaces = [...this.workspaces, { path, name: baseName(path) }]
    this._persist()
  }

  _removeWorkspace(e) {
    this.workspaces = this.workspaces.filter((w) => w.path !== e.detail.path)
    this._persist()
  }

  _reorderWorkspaces(e) {
    this.workspaces = e.detail.workspaces
    this._persist()
  }

  // ---- tab / file handlers ----
  async _openFile(path, activate = true, line = 0) {
    const existing = this.tabs.findIndex((t) => t.path === path)
    if (existing >= 0) {
      if (line) this.tabs[existing].gotoLine = line
      this.tabs = [...this.tabs]
      if (activate) this.activeIndex = existing
      return
    }
    let content = ''
    try {
      content = await window.api.readFile(path)
    } catch {
      content = ''
    }
    this.tabs = [...this.tabs, { path, name: baseName(path), content, dirty: false, gotoLine: line }]
    if (activate) this.activeIndex = this.tabs.length - 1
    this._persist()
  }

  _onOpenFile(e) {
    this._openFile(e.detail.path, true, e.detail.line || 0)
  }

  _selectTab(e) {
    this.activeIndex = e.detail.index
  }

  _closeTab(e) {
    const i = e.detail.index
    this.tabs = this.tabs.filter((_, idx) => idx !== i)
    if (this.activeIndex >= this.tabs.length) this.activeIndex = this.tabs.length - 1
    this._persist()
  }

  _onEdit(e) {
    const t = this.tabs[this.activeIndex]
    if (!t) return
    t.content = e.detail.content
    if (!t.dirty) {
      t.dirty = true
      this.tabs = [...this.tabs]
    }
  }

  async _saveActive() {
    const t = this.tabs[this.activeIndex]
    if (!t || !t.dirty) return
    await window.api.writeFile(t.path, t.content)
    t.dirty = false
    this.tabs = [...this.tabs]
  }

  // ---- keep open tabs in sync with filesystem changes from the tree ----
  _onFileRenamed(e) {
    const { oldPath, newPath, isDir } = e.detail
    let changed = false
    for (const t of this.tabs) {
      if (t.path === oldPath) {
        t.path = newPath
        t.name = baseName(newPath)
        changed = true
      } else if (isDir && t.path.startsWith(oldPath + sep(oldPath))) {
        t.path = newPath + t.path.slice(oldPath.length)
        changed = true
      }
    }
    if (changed) {
      this.tabs = [...this.tabs]
      this._persist()
    }
  }

  _onFileDeleted(e) {
    const { path, isDir } = e.detail
    const before = this.tabs.length
    this.tabs = this.tabs.filter(
      (t) => !(t.path === path || (isDir && t.path.startsWith(path + sep(path))))
    )
    if (this.tabs.length !== before) {
      if (this.activeIndex >= this.tabs.length) this.activeIndex = this.tabs.length - 1
      this._persist()
    }
  }

  render() {
    const active = this.tabs[this.activeIndex]
    const cols = this.sidebarCollapsed
      ? '0 1fr'
      : `${this.sidebarWidth}px 5px 1fr`
    return html`
      ${this.sidebarCollapsed
        ? html`<button class="expand-side" title="사이드바 펼치기" @click=${this._toggleSidebar}>
            ⟩
          </button>`
        : ''}
      <div class="grid" style="grid-template-columns:${cols}" @toggle-sidebar=${this._toggleSidebar}>
      <div class="side">
        <md-sidebar
          .workspaces=${this.workspaces}
          @add-workspace=${this._addWorkspace}
          @remove-workspace=${this._removeWorkspace}
          @reorder-workspaces=${this._reorderWorkspaces}
          @open-file=${this._onOpenFile}
          @file-renamed=${this._onFileRenamed}
          @file-deleted=${this._onFileDeleted}
        ></md-sidebar>
      </div>
      ${this.sidebarCollapsed
        ? ''
        : html`<div class="resizer" @mousedown=${this._startResize}></div>`}
      <div class="main">
        <md-tabs
          .tabs=${this.tabs}
          .activeIndex=${this.activeIndex}
          @select-tab=${this._selectTab}
          @close-tab=${this._closeTab}
        ></md-tabs>
        <div class="editor-wrap" @open-file=${this._onOpenFile}>
          ${active
            ? html`<md-editor
                .path=${active.path}
                .content=${active.content}
                .gotoLine=${active.gotoLine || 0}
                @doc-change=${this._onEdit}
              ></md-editor>`
            : html`<div class="empty">.md 파일을 여기로 드래그하거나 왼쪽에서 선택하세요</div>`}
        </div>
      </div>
      </div>
    `
  }
}

function baseName(p) {
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p
}

// Path separator inferred from the path itself (Windows backslash or forward slash).
function sep(p) {
  return p.includes('\\') ? '\\' : '/'
}

customElements.define('md-app', MdApp)
