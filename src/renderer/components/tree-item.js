import { LitElement, html, css } from 'lit'
import { promptText, confirmDanger, showContextMenu, notifyFsChange } from './ui.js'
import { getSettings } from './settings.js'

// ---- path helpers (renderer side; works for Windows '\' or POSIX '/') ----
function sepOf(p) {
  return p.includes('\\') ? '\\' : '/'
}
function parentDir(p) {
  return p.replace(/[\\/][^\\/]*$/, '')
}
function isDescendant(child, ancestor) {
  return child === ancestor || child.startsWith(ancestor + sepOf(ancestor))
}

const DRAG_TYPE = 'application/x-mdtree-path'

// One node in the folder tree. Lazily loads children on first expand. Supports a
// right-click context menu (create/rename/delete) and drag & drop to move entries
// between folders. Reloads itself when its directory is announced on the fs bus.
export class MdTreeItem extends LitElement {
  static properties = {
    path: {},
    name: {},
    isDir: {},
    expanded: { state: true },
    root: {},
    _children: { state: true },
    _loaded: { state: true },
    _dropActive: { state: true },
  }

  constructor() {
    super()
    this.expanded = false
    this.root = false
    this._children = []
    this._loaded = false
    this._dropActive = false
  }

  static styles = css`
    :host { display: block; }
    .row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px 3px 0;
      cursor: pointer;
      white-space: nowrap;
      color: #cccccc;
      user-select: none;
    }
    .row:hover { background: #2a2d2e; }
    .row.drop { background: #094771; outline: 1px solid #0e639c; }
    .twisty { width: 12px; text-align: center; color: #888; font-size: 10px; flex: 0 0 auto; }
    .children { padding-left: 12px; }
  `

  connectedCallback() {
    super.connectedCallback()
    window.addEventListener('mdtree-fs', this._onBus)
    window.addEventListener('mdtree-settings', this._onSettings)
    if (this.root && this.expanded) this._load()
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('mdtree-fs', this._onBus)
    window.removeEventListener('mdtree-settings', this._onSettings)
  }

  // Reload when this directory's contents changed somewhere in the app.
  _onBus = (e) => {
    if (this.isDir && e.detail.dirs?.includes(this.path)) this._load(true)
  }

  // Folder-visibility setting changed → reload to apply the new filter.
  _onSettings = () => {
    if (this.isDir && this._loaded) this._load(true)
  }

  async _load(force = false) {
    if (this._loaded && !force) return
    try {
      this._children = await window.api.readDir(this.path, getSettings().showAllFolders)
    } catch {
      this._children = []
    }
    this._loaded = true
    this.requestUpdate()
  }

  _onClick() {
    if (this.isDir) {
      this.expanded = !this.expanded
      if (this.expanded) this._load()
    } else {
      this._open()
    }
  }

  _open() {
    this.dispatchEvent(
      new CustomEvent('open-file', { detail: { path: this.path }, bubbles: true, composed: true })
    )
  }

  // ---- context menu ----
  _onContextMenu(e) {
    e.preventDefault()
    e.stopPropagation()
    const items = this.isDir
      ? [
          { label: '새 문서', action: () => this._newFile() },
          { label: '새 폴더', action: () => this._newFolder() },
          { sep: true },
          { label: '이름 변경', action: () => this._rename() },
          { label: '삭제', danger: true, action: () => this._delete() },
        ]
      : [
          { label: '열기', action: () => this._open() },
          { sep: true },
          { label: '이름 변경', action: () => this._rename() },
          { label: '삭제', danger: true, action: () => this._delete() },
        ]
    showContextMenu(e.clientX, e.clientY, items)
  }

  async _newFile() {
    const name = await promptText('새 문서 이름', 'untitled.md')
    if (!name) return
    try {
      const full = await window.api.createFile(this.path, name)
      this.expanded = true
      notifyFsChange([this.path])
      this.dispatchEvent(
        new CustomEvent('open-file', { detail: { path: full }, bubbles: true, composed: true })
      )
    } catch (err) {
      console.error('createFile failed', err)
    }
  }

  async _newFolder() {
    const name = await promptText('새 폴더 이름', 'new-folder')
    if (!name) return
    try {
      await window.api.createFolder(this.path, name)
      this.expanded = true
      notifyFsChange([this.path])
    } catch (err) {
      console.error('createFolder failed', err)
    }
  }

  async _rename() {
    const newName = await promptText('이름 변경', this.name)
    if (!newName || newName === this.name) return
    try {
      const newPath = await window.api.rename(this.path, newName)
      this.dispatchEvent(
        new CustomEvent('file-renamed', {
          detail: { oldPath: this.path, newPath, isDir: this.isDir },
          bubbles: true,
          composed: true,
        })
      )
      notifyFsChange([parentDir(this.path)])
    } catch (err) {
      console.error('rename failed', err)
    }
  }

  async _delete() {
    const ok = await confirmDanger(`'${this.name}'을(를) 휴지통으로 보낼까요?`)
    if (!ok) return
    try {
      await window.api.delete(this.path)
      this.dispatchEvent(
        new CustomEvent('file-deleted', {
          detail: { path: this.path, isDir: this.isDir },
          bubbles: true,
          composed: true,
        })
      )
      notifyFsChange([parentDir(this.path)])
    } catch (err) {
      console.error('delete failed', err)
    }
  }

  // ---- drag & drop (move) ----
  _onDragStart(e) {
    e.stopPropagation()
    e.dataTransfer.setData(DRAG_TYPE, this.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  _onDragOver(e) {
    if (!this.isDir) return
    if (![...e.dataTransfer.types].includes(DRAG_TYPE)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    this._dropActive = true
  }

  _onDragLeave() {
    this._dropActive = false
  }

  async _onDrop(e) {
    if (!this.isDir) return
    e.preventDefault()
    e.stopPropagation()
    this._dropActive = false
    const src = e.dataTransfer.getData(DRAG_TYPE)
    if (!src || isDescendant(this.path, src)) return // can't move into self/descendant
    try {
      const res = await window.api.move(src, this.path)
      if (!res?.ok) return
      this.expanded = true
      this.dispatchEvent(
        new CustomEvent('file-renamed', {
          detail: { oldPath: src, newPath: res.newPath, isDir: false },
          bubbles: true,
          composed: true,
        })
      )
      notifyFsChange([parentDir(src), this.path])
    } catch (err) {
      console.error('move failed', err)
    }
  }

  render() {
    const icon = this.isDir ? (this.expanded ? '📂' : '📁') : '📄'
    const twisty = this.isDir ? (this.expanded ? '▾' : '▸') : ''
    return html`
      ${this.root
        ? ''
        : html`<div
            class="row ${this._dropActive ? 'drop' : ''}"
            draggable="true"
            @click=${this._onClick}
            @contextmenu=${this._onContextMenu}
            @dragstart=${this._onDragStart}
            @dragover=${this._onDragOver}
            @dragleave=${this._onDragLeave}
            @drop=${this._onDrop}
          >
            <span class="twisty">${twisty}</span>
            <span>${icon} ${this.name}</span>
          </div>`}
      ${this.expanded
        ? html`<div class="children">
            ${this._children.map(
              (c) => html`<md-tree-item
                .path=${c.path}
                .name=${c.name}
                .isDir=${c.isDir}
              ></md-tree-item>`
            )}
          </div>`
        : ''}
    `
  }
}

customElements.define('md-tree-item', MdTreeItem)
