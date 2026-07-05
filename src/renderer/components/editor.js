import { LitElement, html, css } from 'lit'
import Editor from '@toast-ui/editor'
// TUI Editor ships global-class CSS. We import it as raw strings (?inline) and
// adopt it into this component's shadow root so it stays scoped and offline
// (all icon assets in the CSS are inline data URIs — no external requests).
import tuiBaseCss from '@toast-ui/editor/dist/toastui-editor.css?inline'
import tuiDarkCss from '@toast-ui/editor/dist/theme/toastui-editor-dark.css?inline'
import { getSettings } from './settings.js'

// Build the TUI stylesheet once and share it across every editor instance.
const tuiSheet = new CSSStyleSheet()
tuiSheet.replaceSync(tuiBaseCss + '\n' + tuiDarkCss)

// Resolve an image/link href that may be relative to the open file's directory.
function resolveHref(href, basePath) {
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith('data:')) return href
  if (!basePath) return href
  const dir = basePath.replace(/[\\/][^\\/]*$/, '')
  const joined = (dir + '/' + href).replace(/\\/g, '/')
  return 'file:///' + joined.replace(/^\/+/, '')
}

export class MdEditor extends LitElement {
  static properties = {
    path: {},
    content: {},
    gotoLine: {},
    dirty: {},
  }

  constructor() {
    super()
    this.path = ''
    this.content = ''
    this.gotoLine = 0
    this.dirty = false
    this._editor = null
    this._saveBtn = null
    this._appliedTheme = null
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .host {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    /* Match the app's dark chrome and honour the user's font settings. */
    .toastui-editor-defaultUI {
      border: none;
      height: 100%;
    }
    .toastui-editor-contents,
    .toastui-editor-md-container,
    .toastui-editor-ww-container {
      font-family: var(--md-font-family, 'Segoe UI', system-ui, sans-serif);
    }
    .toastui-editor-contents {
      font-size: var(--md-font-size, 14px);
    }
    .toastui-editor-tabs {
      display: none;
    }
    /* Our own Save toolbar button (dirty state turns it amber). */
    #mt-save-btn {
      margin: auto;
      background: none;
      border: none;
      font-size: 21px;
    }
    #mt-save-btn.dirty {
      background: #e6c07b;
    }
  `

  connectedCallback() {
    super.connectedCallback()
    window.addEventListener('mdtree-settings', this._onSettings)
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('mdtree-settings', this._onSettings)
    this._editor?.destroy()
    this._editor = null
  }

  // Font changes flow through CSS custom properties automatically. A theme
  // change, however, is a TUI constructor option with no runtime setter, so we
  // rebuild the editor (preserving the current text + mode) when it changes.
  _onSettings = () => {
    if (this._editor && getSettings().editorTheme !== this._appliedTheme) {
      this._createEditor({ preserve: true })
    }
  }

  firstUpdated() {
    // Adopt the TUI stylesheet alongside Lit's own component styles.
    this.renderRoot.adoptedStyleSheets = [
      ...this.renderRoot.adoptedStyleSheets,
      tuiSheet,
    ]
    this._createEditor()
  }

  updated(changed) {
    // Switching tabs swaps both path and content — rebuild the editor.
    if (changed.has('path') && this._editor) {
      this._createEditor()
    } else if (changed.has('gotoLine') && this._editor && this.gotoLine) {
      this._scrollToLine(this.gotoLine)
    }
    if (changed.has('dirty')) {
      this._saveBtn?.classList.toggle('dirty', !!this.dirty)
    }
  }

  _createEditor({ preserve = false } = {}) {
    // When rebuilding for a theme change, keep the live text and current mode
    // rather than reverting to the (possibly stale) content prop.
    let initialValue = this.content || ''
    let editType = 'markdown'
    if (preserve && this._editor) {
      initialValue = this._editor.getMarkdown()
      editType = this._editor.isMarkdownMode() ? 'markdown' : 'wysiwyg'
    }
    if (this._editor) {
      this._editor.destroy()
      this._editor = null
    }
    const host = this.renderRoot.querySelector('.host')
    host.replaceChildren()

    const themeSetting = getSettings().editorTheme === 'light' ? 'light' : 'dark'
    this._appliedTheme = themeSetting

    // Custom Save button injected into the toolbar; Ctrl+S is handled globally
    // by the app, this mirrors it and reflects the dirty state.
    const saveBtn = document.createElement('button')
    saveBtn.id = 'mt-save-btn'
    saveBtn.type = 'button'
    saveBtn.className = 'mt-save-btn' + (this.dirty ? ' dirty' : '')
    saveBtn.textContent = '💾'
    saveBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('request-save'))
    })
    this._saveBtn = saveBtn

    this._editor = new Editor({
      el: host,
      height: '100%',
      theme: themeSetting,
      initialEditType: editType,
      // 'tab' keeps Markdown mode to just the editor (no side-by-side preview).
      previewStyle: 'tab',
      usageStatistics: false,
      initialValue,
      toolbarItems: [
        [{ name: 'save', el: saveBtn, tooltip: 'Save (Ctrl+S)' }],
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task', 'indent', 'outdent'],
        ['table', 'image', 'link'],
        ['code', 'codeblock'],
      ],
      useCommandShortcut: false,
      customHTMLRenderer: {
        // Resolve relative image sources against the open file's directory.
        image: (node, context) => {
          const { origin, entering } = context
          const result = origin()
          if (entering && result.attributes) {
            result.attributes.src = resolveHref(node.destination, this.path)
          }
          return result
        },
      },
    })

    this._editor.on('change', () => {
      this.dispatchEvent(
        new CustomEvent('doc-change', {
          detail: { content: this._editor.getMarkdown() },
        })
      )
    })

    // Open links from the rendered content: external URLs in the browser,
    // local .md files as new tabs.
    host.addEventListener('click', this._onContentClick, true)

    if (this.gotoLine) this._scrollToLine(this.gotoLine)
  }

  _onContentClick = (e) => {
    const a = e.target.closest?.('a[href]')
    if (!a) return
    const href = a.getAttribute('href')
    if (!href || href.startsWith('#')) return
    e.preventDefault()
    if (/^[a-z]+:\/\//i.test(href)) {
      window.api.openExternal(href)
    } else {
      const resolved = resolveHref(href, this.path).replace(/^file:\/\/\//, '')
      this.dispatchEvent(
        new CustomEvent('open-file', {
          detail: { path: resolved },
          bubbles: true,
          composed: true,
        })
      )
    }
  }

  // Best-effort jump to a source line. Only meaningful in markdown mode; in the
  // default WYSIWYG mode TUI has no line concept, so switch modes to honour it.
  _scrollToLine(n) {
    if (!this._editor || n < 1) return
    if (!this._editor.isMarkdownMode()) this._editor.changeMode('markdown', true)
    this._editor.setSelection([n, 1], [n, 1])
    this._editor.focus()
  }

  render() {
    return html`<div class="host"></div>`
  }
}

customElements.define('md-editor', MdEditor)
