import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

// Persists session state (open tabs + work folders) as JSON under userData.
const stateFile = join(app.getPath('userData'), 'session.json')

const defaultState = {
  workspaces: [], // array of absolute root folder paths
  tabs: [], // array of { path, active }
}

export async function loadState() {
  try {
    const raw = await readFile(stateFile, 'utf8')
    return { ...defaultState, ...JSON.parse(raw) }
  } catch {
    return { ...defaultState }
  }
}

export async function saveState(state) {
  await mkdir(dirname(stateFile), { recursive: true })
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8')
}

// ---- app settings (fonts, folder visibility) ----
const settingsFile = join(app.getPath('userData'), 'settings.json')

const defaultSettings = {
  showAllFolders: false, // false = only show folders that contain .md files
  fontFamily: '',
  fontSize: 14,
}

export async function loadSettings() {
  try {
    const raw = await readFile(settingsFile, 'utf8')
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}

export async function saveSettings(settings) {
  await mkdir(dirname(settingsFile), { recursive: true })
  await writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
}
