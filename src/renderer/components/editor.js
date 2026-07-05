import { LitElement, html, css } from 'lit'
import EasyMDE from 'easymde'
import { getSettings, setSettings } from './settings.js'
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
// highlight.js for code-block syntax highlighting in the preview. Pinned to v10
// because EasyMDE calls the old `hljs.highlight(lang, code)` signature (removed
// in v11). We use the core build and register a common subset of languages to
// keep the bundle small (the full build pulls in ~190 languages). The theme CSS
// is pulled in as a string so it can be adopted into the shadow root (document-
// level styles don't reach the preview — see note above).
import hljs from 'highlight.js/lib/core'
import hljsThemeCss from 'highlight.js/styles/atom-one-dark.css?inline'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import kotlin from 'highlight.js/lib/languages/kotlin'
import swift from 'highlight.js/lib/languages/swift'
import bash from 'highlight.js/lib/languages/bash'
import powershell from 'highlight.js/lib/languages/powershell'
import sql from 'highlight.js/lib/languages/sql'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import xml from 'highlight.js/lib/languages/xml'
import cssLang from 'highlight.js/lib/languages/css'
import markdown from 'highlight.js/lib/languages/markdown'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import ini from 'highlight.js/lib/languages/ini'
import diff from 'highlight.js/lib/languages/diff'

const HLJS_LANGS = {
  javascript, typescript, python, java, c, cpp, csharp, go, rust, php, ruby,
  kotlin, swift, bash, powershell, sql, json, yaml, xml, css: cssLang, markdown,
  dockerfile, ini, diff,
}
for (const [name, def] of Object.entries(HLJS_LANGS)) hljs.registerLanguage(name, def)

// Dark-theme + layout overrides layered on top of EasyMDE's light defaults.
const overridesCss = `
  .EasyMDEContainer {
    --md-code-bg: #23272e;
    --md-code-fg: #d4d4d4;
    --md-code-border: #3a3f4b;
    --md-code-radius: 4px;
    --md-code-pad-y: 10px;
  }
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
  .cm-s-easymde .cm-comment { color: #98c379; background: transparent; }
  .cm-s-easymde .mt-codeblock-line {
    background: var(--md-code-bg);
    color: var(--md-code-fg);
    border-left: 1px solid var(--md-code-border);
    border-right: 1px solid var(--md-code-border);
  }
  .cm-s-easymde .mt-codeblock-line .CodeMirror-line {
    padding-left: 10px;
    padding-right: 10px;
  }
  .cm-s-easymde .mt-codeblock-line .cm-comment {
    background: transparent !important;
  }
  .cm-s-easymde .mt-codeblock-start {
    border-top: 1px solid var(--md-code-border);
    border-top-left-radius: var(--md-code-radius);
    border-top-right-radius: var(--md-code-radius);
  }
  .cm-s-easymde .mt-codeblock-end {
    border-bottom: 1px solid var(--md-code-border);
    border-bottom-left-radius: var(--md-code-radius);
    border-bottom-right-radius: var(--md-code-radius);
  }
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
    background: var(--md-code-bg);
    color: var(--md-code-fg);
    border: 1px solid var(--md-code-border);
    padding: var(--md-code-pad-y);
    border-radius: var(--md-code-radius);
    overflow: auto;
  }
  :is(.editor-preview, .editor-preview-side) pre code {
    background: none; color: inherit; padding: 0; font-size: 1em;
  }
  :is(.editor-preview, .editor-preview-side) ol, ul { padding-inline-start: 20px; }
  :is(.editor-preview, .editor-preview-side) hr { border: none; border-top: 1px solid #3a3f4b; }
  :is(.editor-preview, .editor-preview-side) img { max-width: 100%; }
  /* Placeholder shown in place of an image that failed to load. */
  :is(.editor-preview, .editor-preview-side) .mt-img-broken {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 6px 12px;
    border: 1px dashed #b5544a;
    border-radius: 4px;
    background: #2a1e1e;
    color: #e0a39d;
    font-size: 0.9em;
    font-style: italic;
    white-space: pre-wrap;
    word-break: break-all;
  }
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
editorSheet.replaceSync(easymdeCss + '\n' + faCss + '\n' + hljsThemeCss + '\n' + overridesCss)

// Resolve an image/link href that may be relative to the open file's directory.
function resolveHref(href, basePath) {
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith('data:')) return href
  if (!basePath) return href
  const dir = basePath.replace(/[\\/][^\\/]*$/, '')
  const joined = (dir + '/' + href).replace(/\\/g, '/')
  return 'file:///' + joined.replace(/^\/+/, '')
}

// Turn a local image href (relative, absolute, or file://) into a URL the
// renderer is allowed to load: our privileged `mdfile://` scheme (registered in
// main). Remote (http/https/data) URLs are returned untouched.
function toImageUrl(href, basePath) {
  if (/^(https?|data|mdfile):/i.test(href)) return href
  let abs
  if (/^file:\/\//i.test(href)) abs = href.replace(/^file:\/\/\/?/i, '')
  else if (/^[a-zA-Z]:[\\/]/.test(href) || href.startsWith('/') || href.startsWith('\\')) abs = href
  else {
    if (!basePath) return href
    abs = basePath.replace(/[\\/][^\\/]*$/, '') + '/' + href
  }
  abs = abs.replace(/\\/g, '/').replace(/^\/+/, '')
  // Fixed "local" host keeps the drive letter (e.g. D:) in the path rather than
  // being parsed as the URL authority.
  return 'mdfile://local/' + encodeURI(abs)
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
    this._fenceStyled = new Set()
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
  // Also re-apply the persisted view mode: settings may finish loading from disk
  // after the editor was already built (in the default 'edit' view).
  _onSettings = () => {
    this._mde?.codemirror.refresh()
    this._refreshFenceLineClasses()
    this._applyViewMode()
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
    this._fenceStyled.clear()
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
      status: ['upload-image', 'lines', 'words', 'cursor'],
      sideBySideFullscreen: false,
      // Paste-from-clipboard and drag&drop image support: EasyMDE intercepts the
      // paste/drop events and hands each image file to our save function, which
      // stores it next to the document and returns a relative path to insert.
      uploadImage: true,
      imageMaxSize: 1024 * 1024 * 25,
      imageAccept: 'image/png, image/jpeg, image/gif, image/webp, image/bmp, image/svg+xml, image/avif',
      imageUploadFunction: (file, onSuccess, onError) => this._saveImageFile(file, onSuccess, onError),
      errorCallback: (msg) => console.warn('EasyMDE image:', msg), // don't alert()
      previewRender: (plainText) => this._renderPreview(plainText),
      // Full EasyMDE tool set, with a custom Save at the very front and the
      // upload-image button rewired to a native local-file picker.
      renderingConfig: {
        singleLineBreaks: true,
        codeSyntaxHighlighting: true,
        hljs,
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
        {
          name: 'preview',
          className: 'fa fa-eye no-disable',
          title: 'Toggle preview',
          action: (editor) => {
            EasyMDE.togglePreview(editor)
            this._recordViewMode()
          },
        },
        {
          name: 'side-by-side',
          className: 'fa fa-columns no-disable no-mobile',
          title: 'Toggle side-by-side',
          action: (editor) => {
            EasyMDE.toggleSideBySide(editor)
            this._recordViewMode()
          },
        },
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

    const cm = this._mde.codemirror
    const refreshFenceStyles = () => this._refreshFenceLineClasses()
    cm.on('change', refreshFenceStyles)
    cm.on('viewportChange', refreshFenceStyles)
    queueMicrotask(refreshFenceStyles)

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
    // Move the cursor to the drop location before EasyMDE inserts the image, so
    // dropped images land where the user dropped them (not at the top). Capture
    // phase runs before EasyMDE's own (bubble-phase) drop handler.
    host.addEventListener('drop', this._onEditorDrop, true)
    // Replace preview images that fail to load with a visible placeholder.
    // `error` doesn't bubble, but capture-phase reaches it from the host.
    host.addEventListener('error', this._onImgError, true)

    this._applyViewMode()
    if (this.gotoLine) this._scrollToLine(this.gotoLine)
  }

  // Remember the current view (persisted in settings) so it carries over to the
  // next document and across restarts. EasyMDE activates side-by-side on a
  // setTimeout(1ms), so read the settled state on a later tick.
  _recordViewMode() {
    setTimeout(() => {
      if (!this._mde) return
      const mode = this._mde.isSideBySideActive()
        ? 'sidebyside'
        : this._mde.isPreviewActive()
        ? 'preview'
        : 'edit'
      if (getSettings().viewMode !== mode) setSettings({ viewMode: mode })
    }, 20)
  }

  // Restore the persisted view on a freshly built editor (which starts in the
  // plain 'edit' view). Idempotent — the isActive guards prevent re-toggling.
  _applyViewMode() {
    if (!this._mde) return
    const mode = getSettings().viewMode
    if (mode === 'sidebyside' && !this._mde.isSideBySideActive()) {
      EasyMDE.toggleSideBySide(this._mde)
    } else if (mode === 'preview' && !this._mde.isPreviewActive()) {
      EasyMDE.togglePreview(this._mde)
    }
  }

  _collectFenceFlags(cm) {
    const lineCount = cm.lineCount()
    const flags = new Array(lineCount).fill(false)

    let inFence = false
    let fenceChar = ''
    let fenceLen = 0

    for (let i = 0; i < lineCount; i++) {
      const line = cm.getLine(i) || ''
      const trimmed = line.trimStart()

      const m = trimmed.match(/^([`~]{3,})(.*)$/)
      if (!m) {
        if (inFence) flags[i] = true
        continue
      }

      const marker = m[1]
      const ch = marker[0]
      const len = marker.length

      if (!inFence) {
        inFence = true
        fenceChar = ch
        fenceLen = len
        flags[i] = true
        continue
      }

      if (ch === fenceChar && len >= fenceLen) {
        flags[i] = true
        inFence = false
        fenceChar = ''
        fenceLen = 0
      } else {
        flags[i] = true
      }
    }

    return flags
  }

  _clearFenceLineClasses() {
    if (!this._mde || !this._fenceStyled.size) return
    const cm = this._mde.codemirror

    for (const lineNo of this._fenceStyled) {
      const h = cm.getLineHandle(lineNo)
      if (!h) continue
      cm.removeLineClass(h, 'wrap', 'mt-codeblock-line')
      cm.removeLineClass(h, 'wrap', 'mt-codeblock-start')
      cm.removeLineClass(h, 'wrap', 'mt-codeblock-end')
    }

    this._fenceStyled.clear()
  }

  _refreshFenceLineClasses() {
    if (!this._mde) return
    const cm = this._mde.codemirror
    const lineCount = cm.lineCount()
    const flags = this._collectFenceFlags(cm)

    cm.operation(() => {
      this._clearFenceLineClasses()

      for (let i = 0; i < lineCount; i++) {
        if (!flags[i]) continue
        const h = cm.getLineHandle(i)
        if (!h) continue

        const isStart = i === 0 || !flags[i - 1]
        const isEnd = i === lineCount - 1 || !flags[i + 1]

        cm.addLineClass(h, 'wrap', 'mt-codeblock-line')
        if (isStart) cm.addLineClass(h, 'wrap', 'mt-codeblock-start')
        if (isEnd) cm.addLineClass(h, 'wrap', 'mt-codeblock-end')
        this._fenceStyled.add(i)
      }
    })
  }

  // Render markdown for the preview, resolving relative image sources against
  // the open file's directory.
  _renderPreview(plainText) {
    const rawHtml = this._mde.markdown(plainText)
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html')
    doc.querySelectorAll('img[src]').forEach((img) => {
      img.setAttribute('src', toImageUrl(img.getAttribute('src'), this.path))
    })
    return doc.body.innerHTML
  }

  async _pickImage() {
    const picked = await window.api.pickImage()
    if (!picked) return
    const cm = this._mde.codemirror
    const name = picked.replace(/[\\/]+$/, '').split(/[\\/]/).pop()
    cm.replaceSelection(`![${name}](${this._referencePath(picked)})`)
    cm.focus()
  }

  // A markdown src that references an existing file in place: a relative path
  // when it shares the document's drive, otherwise an absolute file URL.
  _referencePath(absPath) {
    const asFileUrl = 'file:///' + absPath.replace(/\\/g, '/').replace(/^\/+/, '')
    if (!this.path) return encodeURI(asFileUrl)
    const fileDir = this.path.replace(/[\\/][^\\/]*$/, '')
    if (fileDir.slice(0, 2).toLowerCase() !== absPath.slice(0, 2).toLowerCase()) {
      return encodeURI(asFileUrl)
    }
    return encodeURI(relativePath(fileDir, absPath))
  }

  // Swap a broken preview image for a clear "not found" placeholder so a missing
  // file is obvious instead of just rendering nothing. Re-fires harmlessly on
  // each preview re-render (EasyMDE rebuilds the HTML, the image errors again).
  _onImgError = (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || img.classList.contains('mt-img-broken')) return
    const box = document.createElement('span')
    box.className = 'mt-img-broken'
    box.textContent = '⚠ Image not found' + (img.alt ? `: ${img.alt}` : '')
    box.title = img.getAttribute('src') || ''
    img.replaceWith(box)
  }

  // Before EasyMDE inserts a dropped image, place the cursor at the drop point.
  _onEditorDrop = (e) => {
    if (!this._mde || !e.dataTransfer?.files?.length) return
    const cm = this._mde.codemirror
    try {
      cm.setCursor(cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window'))
    } catch {
      /* coords outside the editor — leave the cursor where it is */
    }
  }

  // Called by imageUploadFunction for each pasted/dropped image.
  //  • A dropped file already on disk (Electron sets file.path) → reference it in
  //    place, no copy.
  //  • A pasted (in-memory) image → save it next to the document under assets/.
  async _saveImageFile(file, onSuccess, onError) {
    try {
      const isImage =
        /^image\//.test(file.type) ||
        /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i.test(file.name || file.path || '')
      if (!isImage) {
        onError('Not an image file.')
        return
      }

      // Dropped existing file → reference in place.
      if (file.path) {
        onSuccess(this._referencePath(file.path))
        return
      }

      // Pasted image → persist under the document's assets/ folder.
      if (!this.path) {
        onError('Cannot add image: the document has no folder yet.')
        return
      }
      const buf = new Uint8Array(await file.arrayBuffer())
      let name = (file.name || '').trim()
      if (!name || !/\.[a-z0-9]+$/i.test(name)) {
        const ext = (file.type.split('/')[1] || 'png').replace('svg+xml', 'svg').replace('jpeg', 'jpg')
        name = `image-${Date.now()}.${ext}`
      }
      const abs = await window.api.saveImage(this.path, buf, name)
      if (!abs) {
        onError('Failed to save image.')
        return
      }
      const fileDir = this.path.replace(/[\\/][^\\/]*$/, '')
      // encodeURI so spaces etc. in the generated path stay valid in markdown.
      onSuccess(encodeURI(relativePath(fileDir, abs)))
    } catch {
      onError('Failed to save image.')
    }
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
