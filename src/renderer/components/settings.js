// App-wide settings (font, folder visibility). Loaded once from disk, cached,
// and broadcast on the 'mdtree-settings' window event when changed. Font is
// applied as CSS custom properties on :root, which pierce shadow DOM.

const DEFAULTS = { showAllFolders: false, fontFamily: '', fontSize: 14 }
const FALLBACK_FONT = "'Segoe UI', system-ui, sans-serif"

let _settings = { ...DEFAULTS }

export function getSettings() {
  return _settings
}

export async function initSettings() {
  try {
    _settings = { ...DEFAULTS, ...(await window.api.loadSettings()) }
  } catch {
    _settings = { ...DEFAULTS }
  }
  applyFont()
  emit()
}

export function setSettings(patch) {
  _settings = { ..._settings, ...patch }
  window.api.saveSettings(_settings)
  applyFont()
  emit()
}

function applyFont() {
  const s = document.documentElement.style
  s.setProperty('--md-font-family', _settings.fontFamily?.trim() || FALLBACK_FONT)
  s.setProperty('--md-font-size', (_settings.fontSize || 14) + 'px')
}

function emit() {
  window.dispatchEvent(new CustomEvent('mdtree-settings', { detail: _settings }))
}
