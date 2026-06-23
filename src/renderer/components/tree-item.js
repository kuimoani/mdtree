import { LitElement, html, css } from 'lit'
import { promptText, confirmDanger, showContextMenu } from './ui.js'

// One node in the folder tree. Lazily loads children on first expand. Supports a
// right-click context menu for create/rename/delete, and reloads itself when a
// child changes (via the bubbling `child-changed` event).
export class MdTreeItem extends LitElement {
  static properties = {
    path: {},
    name: {},
    isDir: {},
    expanded: { state: true },
    root: {},
    _children: { state: true },
    _loaded: { state: true },
  }

  constructor() {
    super()
    this.expanded = false
    this.root = false
    this._children = []
    this._loaded = false
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
    .twisty { width: 12px; text-align: center; color: #888; font-size: 10px; flex: 0 0 auto; }
    .children { padding-left: 12px; }
  `

  firstUpdated() {
    if (this.root && this.expanded) this._load()
  }

  async _load(force = false) {
    if (this._loaded && !force) return
    try {
      this._children = await window.api.readDir(this.path)
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
      new CustomEvent('open-file', {
        detail: { path: this.path },
        bubbles: true,
        composed: true,
      })
    )
  }

  _onContextMenu(e) {
    e.preventDefault()
    e.stopPropagation()
    const items = this.isDir
      ? [
          { label: '새 파일', action: () => this._newFile() },
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
    const name = await promptText('새 파일 이름', 'untitled.md')
    if (!name) return
    try {
      const full = await window.api.createFile(this.path, name)
      await this._reload()
      this.expanded = true
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
      await this._reload()
      this.expanded = true
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
      this._notifyParent()
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
      this._notifyParent()
    } catch (err) {
      console.error('delete failed', err)
    }
  }

  // Tell the parent node (which renders us) to reload its children.
  _notifyParent() {
    this.dispatchEvent(new CustomEvent('child-changed', { bubbles: true, composed: true }))
  }

  // Force-reload this node's own children.
  async _reload() {
    await this._load(true)
  }

  _onChildChanged = (e) => {
    e.stopPropagation()
    this._reload()
  }

  render() {
    const icon = this.isDir ? (this.expanded ? '📂' : '📁') : '📄'
    const twisty = this.isDir ? (this.expanded ? '▾' : '▸') : ''
    return html`
      ${this.root
        ? ''
        : html`<div class="row" @click=${this._onClick} @contextmenu=${this._onContextMenu}>
            <span class="twisty">${twisty}</span>
            <span>${icon} ${this.name}</span>
          </div>`}
      ${this.expanded
        ? html`<div class="children" @child-changed=${this._onChildChanged}>
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
