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
