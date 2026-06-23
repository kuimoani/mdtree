import { LitElement, html, css } from 'lit'
import { promptText, showContextMenu } from './ui.js'

// Left panel: collapsible multi-root workspaces + lazy folder trees + global search.
export class MdSidebar extends LitElement {
  static properties = {
    workspaces: {},
    _dragIndex: { state: true },
    _collapsed: { state: true }, // Set of collapsed root paths
    _searchOpen: { state: true },
    _query: { state: true },
    _results: { state: true },
    _searching: { state: true },
  }

  constructor() {
    super()
    this.workspaces = []
    this._dragIndex = -1
    this._collapsed = new Set()
    this._searchOpen = false
    this._query = ''
    this._results = []
    this._searching = false
  }

  static styles = css`
    :host { display: block; font-size: 13px; }
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
    .root { border-top: 1px solid #2d2d2d; }
    .root-head {
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

  // ---- root context menu (create at root) ----
  _rootMenu(root, e) {
    e.preventDefault()
    showContextMenu(e.clientX, e.clientY, [
      { label: '새 파일', action: () => this._createAtRoot(root, 'file') },
      { label: '새 폴더', action: () => this._createAtRoot(root, 'folder') },
      { sep: true },
      {
        label: '워크폴더 제거',
        danger: true,
        action: () =>
          this.dispatchEvent(
            new CustomEvent('remove-workspace', { detail: { path: root.path } })
          ),
      },
    ])
  }

  async _createAtRoot(root, kind) {
    const name = await promptText(
      kind === 'file' ? '새 파일 이름' : '새 폴더 이름',
      kind === 'file' ? 'untitled.md' : 'new-folder'
    )
    if (!name) return
    try {
      if (kind === 'file') {
        const full = await window.api.createFile(root.path, name)
        this.dispatchEvent(
          new CustomEvent('open-file', { detail: { path: full }, bubbles: true, composed: true })
        )
      } else {
        await window.api.createFolder(root.path, name)
      }
      this._collapsed = new Set([...this._collapsed].filter((p) => p !== root.path))
      this._reloadRoot(root.path)
    } catch (err) {
      console.error(err)
    }
  }

  _reloadRoot(path) {
    this.updateComplete.then(() => {
      const node = [...this.renderRoot.querySelectorAll('md-tree-item')].find(
        (n) => n.path === path
      )
      node?._reload?.()
    })
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
        <span>워크폴더</span>
        <div class="actions">
          <button
            class=${this._searchOpen ? 'on' : ''}
            title="전체 검색"
            @click=${this._toggleSearch}
          >
            🔍
          </button>
          <button title="폴더 추가" @click=${() => this.dispatchEvent(new CustomEvent('add-workspace'))}>
            +
          </button>
        </div>
      </header>

      ${this._searchOpen
        ? html`
            <div class="search">
              <input
                type="text"
                placeholder="모든 워크폴더에서 검색…"
                .value=${this._query}
                @input=${this._runSearch}
              />
            </div>
            <div class="results">
              ${this._searching
                ? html`<div class="hint">검색 중…</div>`
                : this._query.trim() && this._results.length === 0
                  ? html`<div class="hint">결과 없음</div>`
                  : this._results.map(
                      (r) => html`<div class="result" @click=${() => this._openResult(r)}>
                        <div class="file">${r.name}:${r.line}</div>
                        <div class="line">${r.text}</div>
                      </div>`
                    )}
            </div>
          `
        : ''}

      ${this.workspaces.length === 0
        ? html`<div class="empty">+ 를 누르거나 폴더를 끌어다 놓으세요</div>`
        : this.workspaces.map((w, i) => {
            const collapsed = this._collapsed.has(w.path)
            return html`
              <div class="root">
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
                    class="remove"
                    title="제거"
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
                  : html`<md-tree-item
                      .path=${w.path}
                      .name=${w.name}
                      .isDir=${true}
                      .expanded=${true}
                      .root=${true}
                    ></md-tree-item>`}
              </div>
            `
          })}
    `
  }
}

customElements.define('md-sidebar', MdSidebar)
