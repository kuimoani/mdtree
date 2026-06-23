// Plain DOM helpers (appended to document.body, not shadow DOM) for modal prompts,
// confirms, and right-click context menus. Electron disables window.prompt/confirm,
// so we roll our own dark-themed versions returning promises.
import { APP_ICON_SVG } from './icon.js'

// Broadcast that the contents of one or more directories changed, so the tree
// nodes for those directories reload. Uses a window event bus because tree nodes
// live in nested shadow roots that a normal querySelector can't reach.
export function notifyFsChange(dirs) {
  window.dispatchEvent(new CustomEvent('mdtree-fs', { detail: { dirs } }))
}

const STYLE_ID = 'mdtree-ui-styles'
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    .mt-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    .mt-dialog {
      background: #252526; color: #d4d4d4; border: 1px solid #444;
      border-radius: 6px; padding: 16px; min-width: 320px;
      box-shadow: 0 8px 30px rgba(0,0,0,.5);
    }
    .mt-dialog h3 { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
    .mt-dialog input {
      width: 100%; box-sizing: border-box; background: #1e1e1e; color: #d4d4d4;
      border: 1px solid #555; border-radius: 4px; padding: 6px 8px; font-size: 13px;
      outline: none;
    }
    .mt-dialog input:focus { border-color: #0e639c; }
    .mt-msg { font-size: 13px; margin: 0 0 12px; }
    .mt-msg a { color: #4daafc; cursor: pointer; }
    .mt-field {
      display: block; font-size: 12px; color: #aaa; margin: 10px 0;
    }
    .mt-field input {
      display: block; width: 100%; box-sizing: border-box; margin-top: 4px;
      background: #1e1e1e; color: #d4d4d4; border: 1px solid #555;
      border-radius: 4px; padding: 6px 8px; font-size: 13px; outline: none;
    }
    .mt-field input:focus { border-color: #0e639c; }
    .mt-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #d4d4d4; margin: 10px 0; }
    .mt-dialog.settings { min-width: 540px; padding: 0; overflow: hidden; }
    .mt-settings { display: grid; grid-template-columns: 150px 1fr; min-height: 280px; }
    .mt-nav { background: #1e1e1e; border-right: 1px solid #3a3a3a; padding: 12px 0; }
    .mt-nav .nav-item { padding: 8px 16px; font-size: 13px; color: #bbb; cursor: pointer; }
    .mt-nav .nav-item:hover { background: #2a2d2e; color: #fff; }
    .mt-nav .nav-item.active { background: #094771; color: #fff; }
    .mt-panel { padding: 16px 20px; }
    .mt-panel h3 { margin: 0 0 12px; }
    .mt-panel .pane { display: none; }
    .mt-panel .pane.show { display: block; }
    .mt-dialog.settings .mt-buttons { padding: 0 20px 16px; margin-top: 0; }
    .mt-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .mt-buttons button {
      padding: 5px 14px; border-radius: 4px; font-size: 13px; cursor: pointer;
      border: 1px solid #555; background: #333; color: #ccc;
    }
    .mt-buttons button.primary { background: #0e639c; border-color: #0e639c; color: #fff; }
    .mt-buttons button.danger { background: #a1260d; border-color: #a1260d; color: #fff; }
    .mt-menu {
      position: fixed; z-index: 1001; background: #252526; border: 1px solid #454545;
      border-radius: 5px; padding: 4px 0; min-width: 160px; box-shadow: 0 4px 16px rgba(0,0,0,.5);
      font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px;
    }
    .mt-menu .item { padding: 5px 14px; color: #cccccc; cursor: pointer; white-space: nowrap; }
    .mt-menu .item:hover { background: #094771; color: #fff; }
    .mt-menu .item.danger:hover { background: #a1260d; }
    .mt-menu .sep { height: 1px; background: #3a3a3a; margin: 4px 0; }
  `
  document.head.appendChild(s)
}

export function promptText(title, initial = '') {
  ensureStyles()
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'mt-overlay'
    overlay.innerHTML = `
      <div class="mt-dialog">
        <h3></h3>
        <input type="text" />
        <div class="mt-buttons">
          <button class="cancel">Cancel</button>
          <button class="primary ok">OK</button>
        </div>
      </div>`
    overlay.querySelector('h3').textContent = title
    const input = overlay.querySelector('input')
    input.value = initial
    const close = (val) => {
      overlay.remove()
      resolve(val)
    }
    overlay.querySelector('.cancel').onclick = () => close(null)
    overlay.querySelector('.ok').onclick = () => close(input.value.trim() || null)
    overlay.onclick = (e) => {
      if (e.target === overlay) close(null)
    }
    input.onkeydown = (e) => {
      if (e.key === 'Enter') close(input.value.trim() || null)
      if (e.key === 'Escape') close(null)
    }
    document.body.appendChild(overlay)
    input.focus()
    // Select filename without extension for convenient renames.
    const dot = initial.lastIndexOf('.')
    input.setSelectionRange(0, dot > 0 ? dot : initial.length)
  })
}

export function confirmDanger(message, okLabel = 'Delete') {
  ensureStyles()
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'mt-overlay'
    overlay.innerHTML = `
      <div class="mt-dialog">
        <p class="mt-msg"></p>
        <div class="mt-buttons">
          <button class="cancel">Cancel</button>
          <button class="danger ok"></button>
        </div>
      </div>`
    overlay.querySelector('.mt-msg').textContent = message
    overlay.querySelector('.ok').textContent = okLabel
    const close = (val) => {
      overlay.remove()
      resolve(val)
    }
    overlay.querySelector('.cancel').onclick = () => close(false)
    overlay.querySelector('.ok').onclick = () => close(true)
    overlay.onclick = (e) => {
      if (e.target === overlay) close(false)
    }
    document.body.appendChild(overlay)
  })
}

// Two-pane settings dialog (General / Font / About). Resolves to the updated
// settings object, or null on cancel. `initialTab` optionally selects a pane.
export function openSettingsDialog(current, version, initialTab = 'general') {
  ensureStyles()
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'mt-overlay'
    overlay.innerHTML = `
      <div class="mt-dialog settings">
        <div class="mt-settings">
          <nav class="mt-nav">
            <div class="nav-item" data-tab="general">General</div>
            <div class="nav-item" data-tab="font">Font</div>
            <div class="nav-item" data-tab="about">About</div>
          </nav>
          <section class="mt-panel">
            <div class="pane" data-pane="general">
              <h3>General</h3>
              <label class="mt-check">
                <input type="checkbox" class="ln" /> Show line numbers
              </label>
            </div>
            <div class="pane" data-pane="font">
              <h3>Font</h3>
              <label class="mt-field">Font family
                <input type="text" class="ff" placeholder="e.g. Consolas, 'Courier New'" />
              </label>
              <label class="mt-field">Font size (px)
                <input type="number" class="fs" min="8" max="48" step="1" />
              </label>
            </div>
            <div class="pane" data-pane="about">
              <div style="text-align:center;margin:2px 0 10px"><span style="display:inline-block;width:64px;height:64px">${APP_ICON_SVG}</span></div>
              <h3 style="text-align:center">About MDTree</h3>
              <p class="mt-msg" style="line-height:1.6;text-align:center">
                <b>MDTree</b> — a lightweight multi-root Markdown note app<br/>
                Version ${version || '0.1.0'}<br/>
                Author: kuimoani<br/>
                GitHub: <a href="#" class="gh">github.com/kuimoani/mdtree</a>
              </p>
            </div>
          </section>
        </div>
        <div class="mt-buttons">
          <button class="cancel">Cancel</button>
          <button class="primary ok">Save</button>
        </div>
      </div>`

    const ln = overlay.querySelector('.ln')
    const ff = overlay.querySelector('.ff')
    const fs = overlay.querySelector('.fs')
    ln.checked = current.showLineNumbers !== false
    ff.value = current.fontFamily || ''
    fs.value = current.fontSize || 14

    const selectTab = (tab) => {
      overlay.querySelectorAll('.nav-item').forEach((n) =>
        n.classList.toggle('active', n.dataset.tab === tab)
      )
      overlay.querySelectorAll('.pane').forEach((p) =>
        p.classList.toggle('show', p.dataset.pane === tab)
      )
    }
    overlay.querySelectorAll('.nav-item').forEach((n) => {
      n.onclick = () => selectTab(n.dataset.tab)
    })
    selectTab(initialTab)

    const close = (val) => {
      overlay.remove()
      resolve(val)
    }
    overlay.querySelector('.cancel').onclick = () => close(null)
    overlay.querySelector('.ok').onclick = () =>
      close({
        showLineNumbers: ln.checked,
        fontFamily: ff.value.trim(),
        fontSize: Number(fs.value) || 14,
      })
    overlay.onclick = (e) => {
      if (e.target === overlay) close(null)
    }
    overlay.querySelector('.gh').onclick = (e) => {
      e.preventDefault()
      window.api.openExternal('https://github.com/kuimoani/mdtree')
    }
    document.body.appendChild(overlay)
  })
}

export function showContextMenu(x, y, items) {
  ensureStyles()
  // Remove any existing menu first.
  document.querySelector('.mt-menu')?.remove()
  const menu = document.createElement('div')
  menu.className = 'mt-menu'

  const close = () => {
    menu.remove()
    document.removeEventListener('mousedown', onDocDown, true)
    window.removeEventListener('blur', close)
  }
  // Only dismiss on a click OUTSIDE the menu. Listening on mousedown but
  // ignoring in-menu targets lets the item's own click handler still fire
  // (mousedown precedes click, so a blanket mousedown-dismiss ate the click).
  const onDocDown = (e) => {
    if (!menu.contains(e.target)) close()
  }

  for (const it of items) {
    if (it.sep) {
      const sep = document.createElement('div')
      sep.className = 'sep'
      menu.appendChild(sep)
      continue
    }
    const el = document.createElement('div')
    el.className = 'item' + (it.danger ? ' danger' : '')
    el.textContent = it.label
    el.addEventListener('click', () => {
      close()
      it.action?.()
    })
    menu.appendChild(el)
  }
  menu.style.left = x + 'px'
  menu.style.top = y + 'px'
  document.body.appendChild(menu)
  // Keep menu inside the viewport.
  const r = menu.getBoundingClientRect()
  if (r.right > window.innerWidth) menu.style.left = window.innerWidth - r.width - 4 + 'px'
  if (r.bottom > window.innerHeight) menu.style.top = window.innerHeight - r.height - 4 + 'px'
  setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0)
  window.addEventListener('blur', close)
}
