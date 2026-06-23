import { LitElement, html, css } from 'lit'

// Horizontal tab strip for open files. Shows a ● dirty marker on unsaved tabs.
export class MdTabs extends LitElement {
  static properties = {
    tabs: {},
    activeIndex: {},
  }

  constructor() {
    super()
    this.tabs = []
    this.activeIndex = -1
  }

  static styles = css`
    :host {
      display: flex;
      background: #252526;
      border-bottom: 1px solid #333;
      min-height: 35px;
      overflow-x: auto;
    }
    .tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 10px;
      height: 35px;
      font-size: 13px;
      color: #969696;
      background: #2d2d2d;
      border-right: 1px solid #252526;
      cursor: pointer;
      white-space: nowrap;
    }
    .tab.active {
      background: #1e1e1e;
      color: #ffffff;
    }
    .dot { color: #d4d4d4; font-size: 10px; }
    .close {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      border-radius: 3px;
    }
    .close:hover { background: #444; color: #fff; }
  `

  render() {
    return html`${this.tabs.map(
      (t, i) => html`
        <div
          class="tab ${i === this.activeIndex ? 'active' : ''}"
          @click=${() =>
            this.dispatchEvent(new CustomEvent('select-tab', { detail: { index: i } }))}
        >
          <span>${t.name}</span>
          ${t.dirty ? html`<span class="dot">●</span>` : ''}
          <button
            class="close"
            title="닫기"
            @click=${(e) => {
              e.stopPropagation()
              this.dispatchEvent(new CustomEvent('close-tab', { detail: { index: i } }))
            }}
          >
            ×
          </button>
        </div>
      `
    )}`
  }
}

customElements.define('md-tabs', MdTabs)
