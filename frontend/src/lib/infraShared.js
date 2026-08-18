// Shared status/severity vocabulary and formatters used across infrastructure
// modules (Server Management, Storage Management, ...) so their color coding
// and date formatting stay identical instead of drifting between copies.

export const STATUSES = ['Online', 'Offline', 'Warning', 'Maintenance', 'Critical']

export const STATUS_META = {
  Online:      { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Offline:     { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
  Warning:     { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
  Maintenance: { bg: '#e0f2fe', text: '#0369a1', dot: '#38bdf8' },
  Critical:    { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
}
export const statusMeta = s => STATUS_META[s] || STATUS_META.Offline

export const ISSUE_SEVERITIES = ['Low', 'Medium', 'High', 'Critical']
export const ISSUE_SEVERITY_META = {
  Low:      { bg: '#f1f5f9', text: '#475569' },
  Medium:   { bg: '#fef3c7', text: '#b45309' },
  High:     { bg: '#ffedd5', text: '#c2410c' },
  Critical: { bg: '#fee2e2', text: '#b91c1c' },
}
export const issueSeverityMeta = s => ISSUE_SEVERITY_META[s] || ISSUE_SEVERITY_META.Low

export const ISSUE_STATUSES = ['Open', 'Investigating', 'In Progress', 'Resolved', 'Ignored']
export const ISSUE_STATUS_META = {
  Open:          { bg: '#fee2e2', text: '#b91c1c' },
  Investigating: { bg: '#fef3c7', text: '#b45309' },
  'In Progress': { bg: '#e0f2fe', text: '#0369a1' },
  Resolved:      { bg: '#dcfce7', text: '#15803d' },
  Ignored:       { bg: '#f1f5f9', text: '#475569' },
}
export const issueStatusMeta = s => ISSUE_STATUS_META[s] || ISSUE_STATUS_META.Open

export const BACKUP_STATUSES = ['Success', 'Failed', 'Running']
export const BACKUP_STATUS_META = {
  Success: { bg: '#dcfce7', text: '#15803d' },
  Failed:  { bg: '#fee2e2', text: '#b91c1c' },
  Running: { bg: '#e0f2fe', text: '#0369a1' },
}
export const backupStatusMeta = s => BACKUP_STATUS_META[s] || BACKUP_STATUS_META.Running

export const PERIODS = [
  { value: '1h', label: 'Last 1 hour', ms: 3600000 },
  { value: '6h', label: 'Last 6 hours', ms: 6 * 3600000 },
  { value: '24h', label: 'Last 24 hours', ms: 24 * 3600000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 86400000 },
  { value: '30d', label: 'Last 30 days', ms: 30 * 86400000 },
]

export function pct(used, total) {
  const u = Number(used) || 0
  const t = Number(total) || 0
  return t ? Math.round((u / t) * 100) : 0
}

export function fmtDate(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function timeAgo(ts) {
  const t = ts?.toDate?.().getTime()
  if (!t) return '—'
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function genId(prefix) {
  return `${prefix}-` + Math.random().toString(36).slice(2, 8).toUpperCase()
}
