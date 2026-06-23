import { LitElement, html, css } from 'lit'
import {
  EditorState,
  Compartment,
  RangeSetBuilder,
  EditorSelection,
} from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  Decoration,
  WidgetType,
  ViewPlugin,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  syntaxHighlighting,
  HighlightStyle,
  syntaxTree,
} from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { tags as t } from '@lezer/highlight'

// Shared highlight style — keeps the raw markdown text but changes color & glyph
// shape (heading size, bold, italic, code font). Used in BOTH modes.
const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.6em', fontWeight: 'bold', color: '#e6c07b' },
  { tag: t.heading2, fontSize: '1.4em', fontWeight: 'bold', color: '#e6c07b' },
  { tag: t.heading3, fontSize: '1.2em', fontWeight: 'bold', color: '#e6c07b' },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: 'bold', color: '#e6c07b' },
  { tag: t.strong, fontWeight: 'bold', color: '#d19a66' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#c678dd' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.monospace], fontFamily: 'Consolas, monospace', color: '#98c379' },
  { tag: t.link, color: '#61afef', textDecoration: 'underline' },
  { tag: t.url, color: '#61afef' },
  { tag: t.quote, color: '#7f848e', fontStyle: 'italic' },
  { tag: t.list, color: '#56b6c2' },
])

// Inline formatting markers hidden on inactive lines. HeaderMark and Link are
// handled separately (header trailing space; links show only their text).
const HIDDEN_MARKS = new Set(['EmphasisMark', 'CodeMark', 'StrikethroughMark'])

// ---- Live Preview widgets ----

class CheckboxWidget extends WidgetType {
  constructor(checked, pos) {
    super()
    this.checked = checked
    this.pos = pos // position of the char inside [ ] to toggle
  }
  eq(o) {
    return o.checked === this.checked && o.pos === this.pos
  }
  toDOM(view) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = this.checked
    box.style.cursor = 'pointer'
    box.style.margin = '0 4px 0 0'
    box.onmousedown = (e) => e.stopPropagation()
    box.onchange = () => {
      view.dispatch({
        changes: { from: this.pos, to: this.pos + 1, insert: this.checked ? ' ' : 'x' },
      })
    }
    return box
  }
  ignoreEvent() {
    return false
  }
}

class ImageWidget extends WidgetType {
  constructor(src, alt) {
    super()
    this.src = src
    this.alt = alt
  }
  eq(o) {
    return o.src === this.src && o.alt === this.alt
  }
  toDOM() {
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.style.maxWidth = '100%'
    img.style.maxHeight = '320px'
    img.style.borderRadius = '4px'
    img.style.display = 'block'
    return img
  }
}

// Resolve an image/link href that may be relative to the open file's directory.
function resolveHref(href, basePath) {
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith('data:')) return href
  if (!basePath) return href
  const dir = basePath.replace(/[\\/][^\\/]*$/, '')
  const joined = (dir + '/' + href).replace(/\\/g, '/')
  return 'file:///' + joined.replace(/^\/+/, '')
}

// Builds the Live Preview extension bound to a host editor element (for the open
// file path + dispatching open-file events on link clicks).
function livePreviewExt(host) {
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.build(view)
      }
      update(u) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) {
          this.decorations = this.build(u.view)
        }
      }
      build(view) {
        const builder = new RangeSetBuilder()
        const doc = view.state.doc
        const activeLines = new Set()
        for (const r of view.state.selection.ranges) {
          activeLines.add(doc.lineAt(r.head).number)
        }
        for (const { from, to } of view.visibleRanges) {
          syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
              const lineActive = activeLines.has(doc.lineAt(node.from).number)

              // Task list checkbox — always interactive.
              if (node.name === 'TaskMarker') {
                const txt = doc.sliceString(node.from, node.to) // e.g. "[ ]" or "[x]"
                const checked = /x/i.test(txt)
                builder.add(
                  node.from,
                  node.to,
                  Decoration.replace({
                    widget: new CheckboxWidget(checked, node.from + 1),
                  })
                )
                return false
              }

              // Inline image — render only on inactive lines.
              if (node.name === 'Image' && !lineActive) {
                const raw = doc.sliceString(node.from, node.to)
                const m = raw.match(/!\[([^\]]*)\]\(([^)\s]+)/)
                if (m) {
                  builder.add(
                    node.from,
                    node.to,
                    Decoration.replace({
                      widget: new ImageWidget(resolveHref(m[2], host.path), m[1]),
                    })
                  )
                  return false
                }
              }

              // Link — show only the link text (hide the [ and ](url) parts),
              // styled and clickable, on inactive lines.
              if (node.name === 'Link' && !lineActive) {
                const raw = doc.sliceString(node.from, node.to)
                const close = raw.indexOf(']')
                if (close > 1) {
                  builder.add(node.from, node.from + 1, Decoration.replace({}))
                  builder.add(
                    node.from + 1,
                    node.from + close,
                    Decoration.mark({ class: 'cm-mdlink' })
                  )
                  builder.add(node.from + close, node.to, Decoration.replace({}))
                  return false
                }
              }

              // Heading marker — hide the #'s and the single trailing space.
              if (node.name === 'HeaderMark' && !lineActive) {
                let end = node.to
                if (doc.sliceString(end, end + 1) === ' ') end += 1
                builder.add(node.from, end, Decoration.replace({}))
                return
              }

              // Other inline formatting markers.
              if (HIDDEN_MARKS.has(node.name) && !lineActive) {
                builder.add(node.from, node.to, Decoration.replace({}))
              }
            },
          })
        }
        return builder.finish()
      }
    },
    { decorations: (v) => v.decorations }
  )

  // Click a link in Live Preview to open it (external URL or local .md file).
  const clickLinks = EditorView.domEventHandlers({
    mousedown(e, view) {
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos == null) return false
      const url = linkUrlAt(view, pos)
      if (!url) return false
      e.preventDefault()
      if (/^[a-z]+:\/\//i.test(url)) {
        window.api.openExternal(url)
      } else {
        const resolved = resolveHref(url, host.path).replace(/^file:\/\/\//, '')
        host.dispatchEvent(
          new CustomEvent('open-file', {
            detail: { path: resolved },
            bubbles: true,
            composed: true,
          })
        )
      }
      return true
    },
  })

  return [plugin, clickLinks]
}

function linkUrlAt(view, pos) {
  let node = syntaxTree(view.state).resolveInner(pos, 0)
  while (node) {
    if (node.name === 'Link' || node.name === 'Image') {
      const raw = view.state.doc.sliceString(node.from, node.to)
      const m = raw.match(/\]\(([^)\s]+)/)
      return m ? m[1] : null
    }
    node = node.parent
  }
  return null
}

// ---- formatting commands (toolbar) ----
function wrapInline(view, mark) {
  const tr = view.state.changeByRange((range) => ({
    changes: [
      { from: range.from, insert: mark },
      { from: range.to, insert: mark },
    ],
    range: EditorSelection.range(range.from + mark.length, range.to + mark.length),
  }))
  view.dispatch(tr)
  view.focus()
}

function setLinePrefix(view, prefix) {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  view.dispatch({ changes: { from: line.from, insert: prefix } })
  view.focus()
}

function insertLink(view) {
  const r = view.state.selection.main
  const text = view.state.sliceDoc(r.from, r.to) || '텍스트'
  view.dispatch({
    changes: { from: r.from, to: r.to, insert: `[${text}](url)` },
  })
  view.focus()
}

export class MdEditor extends LitElement {
  static properties = {
    path: {},
    content: {},
    gotoLine: {},
    dirty: {},
    mode: { state: true }, // 'source' | 'live'
    wrap: { state: true }, // line wrapping on/off
  }

  constructor() {
    super()
    this.path = ''
    this.content = ''
    this.gotoLine = 0
    this.dirty = false
    this.mode = 'live'
    this.wrap = true
    this._view = null
    this._previewCompartment = new Compartment()
    this._wrapCompartment = new Compartment()
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      background: #252526;
      border-bottom: 1px solid #333;
    }
    .toolbar .group { display: flex; gap: 2px; }
    .toolbar .spacer { flex: 1; }
    .toolbar button {
      background: none;
      border: 1px solid transparent;
      color: #cccccc;
      font-size: 13px;
      min-width: 28px;
      height: 26px;
      padding: 0 6px;
      border-radius: 4px;
      cursor: pointer;
    }
    .toolbar button:hover { background: #2a2d2e; }
    .toolbar .mode button.active {
      background: #0e639c;
      color: #fff;
    }
    .toolbar .mode button { font-size: 14px; }
    .host {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .cm-editor { height: 100%; }
    /* Always show the vertical scrollbar; horizontal appears only when line
       wrapping is off (content overflows). */
    .cm-scroller {
      overflow-y: scroll;
      overflow-x: auto;
      font-family: var(--md-font-family, 'Segoe UI', system-ui, sans-serif) !important;
      font-size: var(--md-font-size, 14px) !important;
    }
    .toolbar button.save.dirty {
      color: #e6c07b;
    }
    .cm-mdlink {
      color: #61afef;
      text-decoration: underline;
      cursor: pointer;
    }
  `

  connectedCallback() {
    super.connectedCallback()
    window.addEventListener('mdtree-settings', this._onSettings)
  }
  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('mdtree-settings', this._onSettings)
  }
  // Font family/size change via CSS vars — tell CodeMirror to remeasure geometry.
  _onSettings = () => {
    this._view?.requestMeasure()
  }

  firstUpdated() {
    this._createView()
  }

  updated(changed) {
    if (changed.has('path') && this._view) {
      this._createView()
    } else if (changed.has('gotoLine') && this._view && this.gotoLine) {
      this._scrollToLine(this.gotoLine)
    }
  }

  _previewExtension() {
    return this.mode === 'live' ? livePreviewExt(this) : []
  }

  _createView() {
    if (this._view) this._view.destroy()
    const host = this.renderRoot.querySelector('.host')
    const state = EditorState.create({
      doc: this.content,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage, extensions: GFM }),
        syntaxHighlighting(mdHighlight),
        oneDark,
        this._wrapCompartment.of(this.wrap ? EditorView.lineWrapping : []),
        this._previewCompartment.of(this._previewExtension()),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            this.dispatchEvent(
              new CustomEvent('doc-change', {
                detail: { content: u.state.doc.toString() },
              })
            )
          }
        }),
      ],
    })
    // Pass the shadow root so CodeMirror injects its styles inside this component.
    this._view = new EditorView({ state, parent: host, root: this.renderRoot })
    if (this.gotoLine) this._scrollToLine(this.gotoLine)
  }

  _scrollToLine(n) {
    const doc = this._view.state.doc
    if (n < 1 || n > doc.lines) return
    const line = doc.line(n)
    this._view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    })
    this._view.focus()
  }

  _setMode(mode) {
    if (this.mode === mode) return
    this.mode = mode
    this._view?.dispatch({
      effects: this._previewCompartment.reconfigure(this._previewExtension()),
    })
  }

  _toggleWrap() {
    this.wrap = !this.wrap
    this._view?.dispatch({
      effects: this._wrapCompartment.reconfigure(this.wrap ? EditorView.lineWrapping : []),
    })
  }

  _cmd(fn) {
    if (this._view) fn(this._view)
  }

  render() {
    return html`
      <div class="toolbar">
        <div class="group">
          <button
            class="save ${this.dirty ? 'dirty' : ''}"
            title="저장 (Ctrl+S)"
            @click=${() => this.dispatchEvent(new CustomEvent('request-save'))}
          >
            💾
          </button>
        </div>
        <div class="group">
          <button title="제목 (H1)" @click=${() => this._cmd((v) => setLinePrefix(v, '# '))}>H1</button>
          <button title="제목 (H2)" @click=${() => this._cmd((v) => setLinePrefix(v, '## '))}>H2</button>
          <button title="굵게" @click=${() => this._cmd((v) => wrapInline(v, '**'))}><b>B</b></button>
          <button title="기울임" @click=${() => this._cmd((v) => wrapInline(v, '*'))}><i>I</i></button>
          <button title="취소선" @click=${() => this._cmd((v) => wrapInline(v, '~~'))}><s>S</s></button>
          <button title="인라인 코드" @click=${() => this._cmd((v) => wrapInline(v, '\`'))}>&lt;/&gt;</button>
          <button title="목록" @click=${() => this._cmd((v) => setLinePrefix(v, '- '))}>•</button>
          <button title="체크박스" @click=${() => this._cmd((v) => setLinePrefix(v, '- [ ] '))}>☑</button>
          <button title="인용" @click=${() => this._cmd((v) => setLinePrefix(v, '> '))}>❝</button>
          <button title="링크" @click=${() => this._cmd((v) => insertLink(v))}>🔗</button>
        </div>
        <div class="spacer"></div>
        <div class="group mode">
          <button
            class=${this.wrap ? 'active' : ''}
            title=${this.wrap ? '줄바꿈 끄기 (가로 스크롤)' : '줄바꿈 켜기'}
            @click=${() => this._toggleWrap()}
          >
            ↩
          </button>
          <button
            class=${this.mode === 'source' ? 'active' : ''}
            title="소스 모드"
            @click=${() => this._setMode('source')}
          >
            &lt;/&gt;
          </button>
          <button
            class=${this.mode === 'live' ? 'active' : ''}
            title="Live Preview"
            @click=${() => this._setMode('live')}
          >
            👁
          </button>
        </div>
      </div>
      <div class="host"></div>
    `
  }
}

customElements.define('md-editor', MdEditor)
