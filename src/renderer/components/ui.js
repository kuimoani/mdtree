// Plain DOM helpers (appended to document.body, not shadow DOM) for modal prompts,
// confirms, and right-click context menus. Electron disables window.prompt/confirm,
// so we roll our own dark-themed versions returning promises.

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
          <button class="cancel">취소</button>
          <button class="primary ok">확인</button>
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

export function confirmDanger(message, okLabel = '삭제') {
  ensureStyles()
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'mt-overlay'
    overlay.innerHTML = `
      <div class="mt-dialog">
        <p class="mt-msg"></p>
        <div class="mt-buttons">
          <button class="cancel">취소</button>
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

// Settings dialog. Resolves to { fontFamily, fontSize } or null on cancel.
export function openSettingsDialog(current) {
  ensureStyles()
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'mt-overlay'
    overlay.innerHTML = `
      <div class="mt-dialog" style="min-width:360px">
        <h3>설정</h3>
        <label class="mt-field">기본 폰트
          <input type="text" class="ff" placeholder="예: Consolas, 'Malgun Gothic'" />
        </label>
        <label class="mt-field">폰트 크기 (px)
          <input type="number" class="fs" min="8" max="48" step="1" />
        </label>
        <div class="mt-buttons">
          <button class="cancel">취소</button>
          <button class="primary ok">저장</button>
        </div>
      </div>`
    const ff = overlay.querySelector('.ff')
    const fs = overlay.querySelector('.fs')
    ff.value = current.fontFamily || ''
    fs.value = current.fontSize || 14
    const close = (val) => {
      overlay.remove()
      resolve(val)
    }
    overlay.querySelector('.cancel').onclick = () => close(null)
    overlay.querySelector('.ok').onclick = () =>
      close({ fontFamily: ff.value.trim(), fontSize: Number(fs.value) || 14 })
    overlay.onclick = (e) => {
      if (e.target === overlay) close(null)
    }
    document.body.appendChild(overlay)
    ff.focus()
  })
}

// About dialog. github links open externally.
export function showAbout(version) {
  ensureStyles()
  const overlay = document.createElement('div')
  overlay.className = 'mt-overlay'
  overlay.innerHTML = `
    <div class="mt-dialog" style="min-width:360px">
      <h3>MDTree 정보</h3>
      <p class="mt-msg" style="line-height:1.6">
        <b>MDTree</b> — 가벼운 멀티루트 마크다운 노트 앱<br/>
        버전 ${version || '0.1.0'}<br/>
        제작: kuimoani<br/>
        GitHub: <a href="#" class="gh">github.com/kuimoani/mdtree</a>
      </p>
      <div class="mt-buttons">
        <button class="primary ok">닫기</button>
      </div>
    </div>`
  const close = () => overlay.remove()
  overlay.querySelector('.ok').onclick = close
  overlay.onclick = (e) => {
    if (e.target === overlay) close()
  }
  overlay.querySelector('.gh').onclick = (e) => {
    e.preventDefault()
    window.api.openExternal('https://github.com/kuimoani/mdtree')
  }
  document.body.appendChild(overlay)
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
