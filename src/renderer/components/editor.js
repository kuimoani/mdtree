import { LitElement, html, css } from 'lit'
import EasyMDE from 'easymde'
// EasyMDE (CodeMirror 5) uses global-class CSS and Font Awesome 4 for its
// toolbar icons. This component lives inside md-app's shadow DOM, so document-
// level stylesheets can't reach it — instead we pull the CSS in as strings
// (?inline) and adopt them into THIS component's own shadow root. Font Awesome
// is ALSO imported normally so its @font-face registers at the document level
// (shadow-root @font-face is ignored by the browser, but a document-level font
// family is still usable inside shadow trees).
import easymdeCss from 'easymde/dist/easymde.min.css?inline'
import faCss from 'font-awesome/css/font-awesome.min.css?inline'
import 'font-awesome/css/font-awesome.min.css'

// Dark-theme + layout overrides layered on top of EasyMDE's light defaults.
const overridesCss = `
  .EasyMDEContainer { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; }
  .EasyMDEContainer .CodeMirror {
    flex: 1; min-height: 0; height: auto; border: none;
    background: #1e1e1e; color: #d4d4d4;
    font-family: var(--md-font-family, 'Segoe UI', system-ui, sans-serif);
    font-size: var(--md-font-size, 14px);
  }
  .CodeMirror-cursor { border-left-color: #d4d4d4; }
  .CodeMirror-selected { background: #264f78 !important; }
  .CodeMirror-focused .CodeMirror-selected { background: #264f78 !important; }
  .cm-s-easymde .cm-header { color: #e6c07b; }
  /* Match the source-view heading sizes to the preview (em-based off the base
     font size), overriding EasyMDE's viewport-relative calc() defaults. */
  .cm-s-easymde .cm-header-1 { font-size: 1.6em; line-height: 1.3; }
  .cm-s-easymde .cm-header-2 { font-size: 1.4em; line-height: 1.3; }
  .cm-s-easymde .cm-header-3 { font-size: 1.2em; line-height: 1.3; }
  .cm-s-easymde .cm-header-4,
  .cm-s-easymde .cm-header-5,
  .cm-s-easymde .cm-header-6 { font-size: 1.05em; line-height: 1.3; }
  .cm-s-easymde .cm-quote { color: #7f848e; }
  .cm-s-easymde .cm-link { color: #61afef; }
  .cm-s-easymde .cm-url { color: #56b6c2; }
  .cm-s-easymde .cm-comment { color: #98c379; background: #23272e; }
  .editor-toolbar { background: #252526; border: none; border-bottom: 1px solid #333; opacity: 1; }
  .editor-toolbar button { color: #cccccc; border: 1px solid transparent; }
  .editor-toolbar button:hover { background: #2a2d2e; border-color: #3a3a3a; }
  .editor-toolbar button.active { background: #094771; border-color: #094771; color: #fff; }
  .editor-toolbar i.separator { border-left: 1px solid #3a3a3a; border-right: none; }
  .editor-toolbar button.mt-save.mt-dirty { color: #e6c07b; }
  /* Preview: mirror the editor's font size + colour palette so toggling between
     source and preview looks consistent. Sizes are em-based off --md-font-size
     so they scale with the user's font setting, exactly like the editor. */
  :is(.editor-preview, .editor-preview-side) {
    padding: 10px;
    background: #1e1e1e; color: #d4d4d4;
    font-family: var(--md-font-family, 'Segoe UI', system-ui, sans-serif);
    font-size: var(--md-font-size, 14px);
    border:none;
  }
  :is(.editor-preview, .editor-preview-side) :is(h1, h2, h3, h4, h5, h6) {
    color: #e6c07b; font-weight: 700; line-height: 1.3; margin: auto;
  }
  :is(.editor-preview, .editor-preview-side) h1 { font-size: 1.6em; }
  :is(.editor-preview, .editor-preview-side) h2 { font-size: 1.4em; }
  :is(.editor-preview, .editor-preview-side) h3 { font-size: 1.2em; }
  :is(.editor-preview, .editor-preview-side) :is(h4, h5, h6) { font-size: 1.05em; }
  :is(.editor-preview, .editor-preview-side) a { color: #61afef; }
  :is(.editor-preview, .editor-preview-side) blockquote {
    color: #7f848e; border-left: 3px solid #3a3f4b; margin: 0.5em 0; padding: 0 0 0 12px;
  }
  :is(.editor-preview, .editor-preview-side) code {
    background: #23272e; color: #98c379; padding: 1px 5px; border-radius: 3px;
    font-family: 'Consolas', monospace; font-size: 0.95em;
  }
  :is(.editor-preview, .editor-preview-side) pre {
    background: #23272e; color: #d4d4d4; padding: 10px; border-radius: 4px; overflow: auto;
  }
  :is(.editor-preview, .editor-preview-side) pre code {
    background: none; color: inherit; padding: 0; font-size: 1em;
  }
  :is(.editor-preview, .editor-preview-side) hr { border: none; border-top: 1px solid #3a3f4b; }
  :is(.editor-preview, .editor-preview-side) img { max-width: 100%; }
  :is(.editor-preview, .editor-preview-side) table { border-collapse: collapse; }
  :is(.editor-preview, .editor-preview-side) :is(td, th) { border: 1px solid #3a3f4b; padding: 4px 10px; }
  :is(.editor-preview, .editor-preview-side) th { background: #2a2f3a; }
  .editor-preview-side { border-left: 1px solid #333; width:auto; }
  .editor-statusbar { color: #808080; }
  /* Side-by-side (non-fullscreen): EasyMDE's default flex-wrap layout leaves
     both panes at content height with no internal scroll. Lay it out as a grid
     — toolbar / [editor | preview] / statusbar — so the middle row is bounded
     (minmax(0,1fr)) and each pane scrolls independently. */
  .EasyMDEContainer.sided--no-fullscreen {
    display: grid !important;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas: "toolbar toolbar" "editor preview" "status status";
  }
  .EasyMDEContainer.sided--no-fullscreen .editor-toolbar { grid-area: toolbar; }
  .EasyMDEContainer.sided--no-fullscreen .CodeMirror-sided {
    grid-area: editor; width: auto !important; height: 100%; min-height: 0;
  }
  .EasyMDEContainer.sided--no-fullscreen .editor-preview-active-side {
    grid-area: preview; height: 100%; min-height: 0; overflow: auto;
  }
  .EasyMDEContainer.sided--no-fullscreen .editor-statusbar { grid-area: status; }
`

// One shared stylesheet (EasyMDE + Font Awesome class rules + overrides) adopted
// into each editor instance's shadow root.
const editorSheet = new CSSStyleSheet()
editorSheet.replaceSync(easymdeCss + '\n' + faCss + '\n' + overridesCss)

// Resolve an image/link href that may be relative to the open file's directory.
function resolveHref(href, basePath) {
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith('data:')) return href
  if (!basePath) return href
  const dir = basePath.replace(/[\\/][^\\/]*$/, '')
  const joined = (dir + '/' + href).replace(/\\/g, '/')
  return 'file:///' + joined.replace(/^\/+/, '')
}

// Relative path from one absolute dir to an absolute target (both may use \ or /).
function relativePath(fromDir, toPath) {
  const f = fromDir.replace(/\\/g, '/').split('/').filter(Boolean)
  const t = toPath.replace(/\\/g, '/').split('/').filter(Boolean)
  let i = 0
  while (i < f.length && i < t.length && f[i].toLowerCase() === t[i].toLowerCase()) i++
  const parts = f.slice(i).map(() => '..').concat(t.slice(i))
  return parts.length ? parts.join('/') : '.'
}

export class MdEditor extends LitElement {
  static properties = {
    path: {},
    content: {},
    gotoLine: {},
    dirty: {},
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .host {
      flex: 1;
      min-height: 0;
      display: flex;
    }
  `

  constructor() {
    super()
    this.path = ''
    this.content = ''
    this.gotoLine = 0
    this.dirty = false
    this._mde = null
    this._saveBtn = null
    this._editorPath = null
  }

  connectedCallback() {
    super.connectedCallback()
    window.addEventListener('mdtree-settings', this._onSettings)
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('mdtree-settings', this._onSettings)
    this._destroyEditor()
  }

  // Font settings change the CSS custom properties; CodeMirror needs a remeasure.
  _onSettings = () => {
    this._mde?.codemirror.refresh()
  }

  firstUpdated() {
    // Adopt the EasyMDE/Font Awesome stylesheet alongside Lit's own styles.
    this.renderRoot.adoptedStyleSheets = [
      ...this.renderRoot.adoptedStyleSheets,
      editorSheet,
    ]
    this._createEditor()
  }

  updated(changed) {
    // Switching tabs swaps path + content — rebuild only when the path actually
    // changes (guards against the initial firstUpdated/updated double-fire).
    if (changed.has('path') && this._mde && this.path !== this._editorPath) {
      this._createEditor()
    } else if (changed.has('gotoLine') && this._mde && this.gotoLine) {
      this._scrollToLine(this.gotoLine)
    }
    if (changed.has('dirty')) {
      this._saveBtn?.classList.toggle('mt-dirty', !!this.dirty)
    }
  }

  _destroyEditor() {
    if (this._mde) {
      try {
        this._mde.toTextArea()
      } catch {
        /* element may already be detached */
      }
      this._mde = null
      this._saveBtn = null
    }
  }

  _createEditor() {
    this._destroyEditor()
    this._editorPath = this.path
    const host = this.renderRoot.querySelector('.host')
    host.replaceChildren()
    const textarea = document.createElement('textarea')
    host.appendChild(textarea)

    this._mde = new EasyMDE({
      element: textarea,
      initialValue: this.content || '',
      autofocus: false,
      spellChecker: false,
      autoDownloadFontAwesome: false, // we bundle Font Awesome ourselves
      status: ['lines', 'words', 'cursor'],
      sideBySideFullscreen: false,
      previewRender: (plainText) => this._renderPreview(plainText),
      // Full EasyMDE tool set, with a custom Save at the very front and the
      // upload-image button rewired to a native local-file picker.
      renderingConfig: {
        singleLineBreaks: true,
        codeSyntaxHighlighting: true,
        hljs: window.hljs
      },
      tabSize: 4,
      toolbar: [
        {
          name: 'save',
          className: 'fa fa-save mt-save',
          title: 'Save (Ctrl+S)',
          action: () => this.dispatchEvent(new CustomEvent('request-save')),
        },
        '|',
        'bold', 'italic', 'strikethrough', 'heading',
        // 'heading-smaller', 'heading-bigger', 'heading-1', 'heading-2', 'heading-3',
        '|',
        'code', 'quote', 'unordered-list', 'ordered-list', 'check-list', 'clean-block',
        '|',
        'link', 'image',
        {
          name: 'upload-image',
          className: 'fa fa-upload',
          title: 'Insert local image',
          action: () => this._pickImage(),
        },
        'table', 'horizontal-rule',
        '|',
        'preview', 'side-by-side', // 'fullscreen',
        '|',
        {
          name: 'guide',
          className: 'fa fa-question-circle',
          title: 'Markdown guide',
          action: () => window.api.openExternal('https://www.markdownguide.org/basic-syntax/'),
        },
        '|',
        'undo', 'redo',
      ],
    })

    this._saveBtn = host.querySelector('.editor-toolbar .mt-save')
    if (this.dirty) this._saveBtn?.classList.add('mt-dirty')

    this._mde.codemirror.on('change', () => {
      this.dispatchEvent(
        new CustomEvent('doc-change', { detail: { content: this._mde.value() } })
      )
    })

    // Open links from the rendered preview: external URLs in the browser,
    // local .md files as new tabs.
    host.addEventListener('click', this._onContentClick, true)

    if (this.gotoLine) this._scrollToLine(this.gotoLine)
  }

  // Render markdown for the preview, resolving relative image sources against
  // the open file's directory.
  _renderPreview(plainText) {
    const rawHtml = this._mde.markdown(plainText)
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html')
    doc.querySelectorAll('img[src]').forEach((img) => {
      img.setAttribute('src', resolveHref(img.getAttribute('src'), this.path))
    })
    return doc.body.innerHTML
  }

  async _pickImage() {
    const picked = await window.api.pickImage()
    if (!picked) return
    const cm = this._mde.codemirror
    const name = picked.replace(/[\\/]+$/, '').split(/[\\/]/).pop()
    let insert
    if (this.path) {
      const fileDir = this.path.replace(/[\\/][^\\/]*$/, '')
      // Different Windows drive → fall back to an absolute file URL.
      insert =
        fileDir.slice(0, 2).toLowerCase() !== picked.slice(0, 2).toLowerCase()
          ? 'file:///' + picked.replace(/\\/g, '/').replace(/^\/+/, '')
          : relativePath(fileDir, picked)
    } else {
      insert = 'file:///' + picked.replace(/\\/g, '/').replace(/^\/+/, '')
    }
    cm.replaceSelection(`![${name}](${insert})`)
    cm.focus()
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

  // Jump to a source line (sidebar search result). EasyMDE is always a source
  // editor, so this is exact.
  _scrollToLine(n) {
    const cm = this._mde?.codemirror
    if (!cm || n < 1) return
    const line = Math.min(n - 1, cm.lineCount() - 1)
    cm.setCursor({ line, ch: 0 })
    cm.scrollIntoView({ line, ch: 0 }, 120)
    cm.focus()
  }

  render() {
    return html`<div class="host"></div>`
  }
}

customElements.define('md-editor', MdEditor)
