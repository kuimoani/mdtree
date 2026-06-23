// Registers all custom elements.
import { initSettings } from './components/settings.js'
import './components/app.js'
import './components/sidebar.js'
import './components/tree-item.js'
import './components/tabs.js'
import './components/editor.js'

// Load persisted settings (font, folder visibility) before/while the UI mounts.
initSettings()
