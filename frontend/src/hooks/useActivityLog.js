/**
 * useActivityLog — client-side activity logging stored in localStorage.
 *
 * Each log entry:
 * {
 *   id:        string   — unique ID
 *   ts:        number   — Unix ms timestamp
 *   action:    string   — e.g. "CREATE_USER", "DELETE_BRANCH"
 *   category:  string   — "Users" | "Branches" | "Tax" | "Tools" | "Auth" | "System"
 *   actor:     string   — always "InfraMonitor Admin" (admin session)
 *   summary:   string   — human-readable description
 *   status:    "ok" | "error"
 *   detail?:   string   — optional extra info / error message
 * }
 */

const STORAGE_KEY = 'vsdc_activity_log'
const MAX_ENTRIES = 500

function readLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeLog(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
}

export function logActivity({ action, category, summary, status = 'ok', detail = '' }) {
  const entries = readLog()
  const entry = {
    id:       `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts:       Date.now(),
    action,
    category,
    actor:    'InfraMonitor Admin',
    summary,
    status,
    detail,
  }
  writeLog([entry, ...entries])
  return entry
}

export function getLog() {
  return readLog()
}

export function clearLog() {
  localStorage.removeItem(STORAGE_KEY)
}
