// Registers all custom elements.
import { initSettings } from './components/settings.js'
import './components/app.js'
import './components/sidebar.js'
import './components/tree-item.js'
import './components/tabs.js'
import './components/editor.js'

// Load persisted settings (font, folder visibility) before/while the UI mounts.
initSettings()

// Render the app emoji to a PNG and use it as the window/taskbar icon.
export const APP_EMOJI = '🪾'
function emojiToPng(emoji, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.font = `${Math.floor(size * 0.8)}px "Segoe UI Emoji", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04)
  return c.toDataURL('image/png')
}
window.api?.setIcon?.(emojiToPng(APP_EMOJI))
