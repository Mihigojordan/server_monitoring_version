import { useState, useEffect, useRef, useMemo } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { useApp } from '../../context/AppContext'
import { logActivity } from '../../hooks/useActivityLog'

const SEVERITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'warning',  label: 'Warning' },
  { value: 'info',     label: 'Info' },
]

const SEV_COLOR = { critical: '#DC2626', warning: '#D97706', info: '#2563EB' }
const EXPORT_FIELDS = ['title', 'device', 'severity', 'message']

const EMPTY_FORM = { title: '', device: '', severity: 'warning', message: '' }

const DATE_FILTERS = [
  { value: 'All', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

function matchesDateFilter(alert, filterDate) {
  if (filterDate === 'All') return true
  const t = alert.createdAt?.toDate?.().getTime()
  if (!t) return false
  return t >= Date.now() - Number(filterDate) * 86400000
}

function matchesDateRange(alert, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true
  const t = alert.createdAt?.toDate?.().getTime()
  if (!t) return false
  if (dateFrom && t < new Date(`${dateFrom}T00:00:00`).getTime()) return false
  if (dateTo && t > new Date(`${dateTo}T23:59:59.999`).getTime()) return false
  return true
}

function SevIcon({ severity, color }) {
  if (severity === 'info') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" /><line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
    </svg>
  )
}

function badgeStyle(color, size = 38) {
  return {
    width: size, height: size, borderRadius: 10,
    background: `color-mix(in srgb, ${color} 16%, transparent)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }
}

function timeAgo(ts) {
  if (!ts?.toDate) return 'just now'
  const ms = Date.now() - ts.toDate().getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const days = Math.floor(hr / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatDate(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function IconBtn({ title, danger, onClick, children, full }) {
  return (
    <button
      type="button" title={title} onClick={onClick}
      style={{
        width: full ? '100%' : 30, height: 30, flex: full ? 1 : 'none',
        border: `1px solid ${danger ? '#fecaca' : 'var(--ink-200)'}`,
        background: 'var(--surface)', borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: danger ? '#dc2626' : 'var(--ink-700)',
      }}
    >
      {children}
    </button>
  )
}

function ViewIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" /></svg>
}
function EditIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
}
function DeleteIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
}
function AckIcon({ acked }) {
  return acked
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 3v6h6" /></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
}

function FileTypeIcon({ filename }) {
  const isJson = filename.toLowerCase().endsWith('.json')
  const color = isJson ? '#a21caf' : '#15803d'
  const bg = isJson ? '#fdf4ff' : '#dcfce7'
  return (
    <span style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {isJson ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M8 3H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2" /><path d="M16 3h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
      )}
    </span>
  )
}

const TREND_STYLE = {
  up:   { bg: '#dcfce7', color: '#15803d', arrow: '▲' },
  down: { bg: '#fee2e2', color: '#b91c1c', arrow: '▼' },
  flat: { bg: 'var(--ink-100)', color: 'var(--ink-500)', arrow: '–' },
}

function TrendChip({ trend }) {
  const s = TREND_STYLE[trend.dir]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color }}>
      {s.arrow} {trend.label}
    </span>
  )
}

// Real week-over-week trend from each alert's createdAt — created-this-week vs
// created-the-week-before, not a fabricated number.
function trendFor(alerts, matches) {
  const WEEK = 7 * 86400000
  const now = Date.now()
  const addedAt = a => a.createdAt?.toDate?.().getTime()
  const curr = alerts.filter(a => matches(a) && addedAt(a) >= now - WEEK && addedAt(a) < now).length
  const prev = alerts.filter(a => matches(a) && addedAt(a) >= now - 2 * WEEK && addedAt(a) < now - WEEK).length
  if (curr === 0 && prev === 0) return { dir: 'flat', label: 'No change this week' }
  if (prev === 0) return { dir: 'up', label: `+${curr} new this week` }
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return { dir: 'flat', label: 'No change vs last week' }
  return { dir: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : ''}${pct}% vs last week` }
}

function computeTrends(alerts) {
  return {
    total: trendFor(alerts, () => true),
    critical: trendFor(alerts, a => a.severity === 'critical'),
    warning: trendFor(alerts, a => a.severity === 'warning'),
    info: trendFor(alerts, a => a.severity === 'info'),
  }
}

// Cumulative count per day over the last 14 days, built from each alert's real
// createdAt — an honest growth curve, not synthetic sample data.
function sparkPoints(alerts, matches, days = 14) {
  const DAY = 86400000
  const now = Date.now()
  const dayStart = now - (days - 1) * DAY
  const addedAt = a => a.createdAt?.toDate?.().getTime()
  const counts = []
  for (let i = 0; i < days; i++) {
    const cutoff = dayStart + i * DAY + DAY
    counts.push(alerts.filter(a => matches(a) && addedAt(a) && addedAt(a) < cutoff).length)
  }
  const w = 80, h = 32, pad = 4
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const range = Math.max(max - min, 1)
  return counts.map((c, i) => {
    const x = (i / (days - 1)) * w
    const y = h - pad - ((c - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function computeSparks(alerts) {
  return {
    total: sparkPoints(alerts, () => true),
    critical: sparkPoints(alerts, a => a.severity === 'critical'),
    warning: sparkPoints(alerts, a => a.severity === 'warning'),
    info: sparkPoints(alerts, a => a.severity === 'info'),
  }
}

function Spark({ points, color }) {
  return (
    <svg width="52" height="20" viewBox="0 0 80 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <polyline points={points} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { cells.push(cur); cur = '' }
    else cur += ch
  }
  cells.push(cur)
  return cells.map(c => c.trim())
}

const IMPORT_HEADER_ALIASES = { title: 'title', device: 'device', severity: 'severity', message: 'message' }

function sanitizeRow(raw) {
  const row = { title: '', device: '', severity: 'warning', message: '' }
  EXPORT_FIELDS.forEach(f => { if (raw[f]) row[f] = String(raw[f]) })
  if (!SEVERITIES.some(s => s.value === row.severity.toLowerCase())) row.severity = 'warning'
  else row.severity = row.severity.toLowerCase()
  return row
}

function parseAlertCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []
  const header = parseCsvLine(lines[0]).map(h => h.toLowerCase())
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line)
    const raw = {}
    header.forEach((h, i) => {
      const field = IMPORT_HEADER_ALIASES[h]
      if (field) raw[field] = cells[i]
    })
    return sanitizeRow(raw)
  }).filter(row => row.title)
}

function parseAlertJson(text) {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : [data]
  return list.map(sanitizeRow).filter(row => row.title)
}

function parseAlertFile(filename, text) {
  return filename.toLowerCase().endsWith('.json') ? parseAlertJson(text) : parseAlertCsv(text)
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(filename, rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [EXPORT_FIELDS.join(',')].concat(rows.map(r => EXPORT_FIELDS.map(h => escape(r[h])).join(','))).join('\r\n')
  downloadBlob(filename, csv, 'text/csv;charset=utf-8;')
}

function exportJson(filename, rows) {
  const data = rows.map(r => Object.fromEntries(EXPORT_FIELDS.map(f => [f, r[f] || ''])))
  downloadBlob(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;')
}

function exportPdf(filename, rows) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 40
  let y = 50
  pdf.setFontSize(16)
  pdf.text('Alerts', marginX, y)
  y += 24
  pdf.setFontSize(9)
  rows.forEach(r => {
    if (y > 780) { pdf.addPage(); y = 50 }
    pdf.setFont(undefined, 'bold')
    pdf.text(r.title || '—', marginX, y)
    pdf.setFont(undefined, 'normal')
    pdf.text(`${(r.severity || '—').toUpperCase()}  ·  ${r.device || '—'}  ·  ${r.ack ? 'Acknowledged' : 'Unacknowledged'}`, marginX, y + 12)
    y += 28
  })
  pdf.save(filename)
}

export default function AlertsCenter() {
  const { user } = useApp()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [view, setView] = useState('list') // list | detail
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('All')
  const [filterAck, setFilterAck] = useState('All')
  const [filterDate, setFilterDate] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState('table') // table | grid
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const [deleteTarget, setDeleteTarget] = useState(null)

  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState('upload') // upload | preview | done
  const [importFileName, setImportFileName] = useState('')
  const [importRows, setImportRows] = useState([])
  const [importing, setImporting] = useState(false)

  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef(null)

  useEffect(() => {
    function handler(e) { if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [])

  const counts = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical' && !a.ack).length,
    warning: alerts.filter(a => a.severity === 'warning' && !a.ack).length,
    info: alerts.filter(a => a.severity === 'info' && !a.ack).length,
  }), [alerts])

  const trends = useMemo(() => computeTrends(alerts), [alerts])
  const sparks = useMemo(() => computeSparks(alerts), [alerts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return alerts.filter(a => {
      if (filterSeverity !== 'All' && a.severity !== filterSeverity) return false
      if (filterAck === 'Acknowledged' && !a.ack) return false
      if (filterAck === 'Unacknowledged' && a.ack) return false
      if (!matchesDateFilter(a, filterDate)) return false
      if (!matchesDateRange(a, dateFrom, dateTo)) return false
      if (q && !`${a.title} ${a.device}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [alerts, search, filterSeverity, filterAck, filterDate, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length)
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const pageNumbers = useMemo(() => {
    const nums = []
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) nums.push(p)
      else if (nums[nums.length - 1] !== '…') nums.push('…')
    }
    return nums
  }, [totalPages, currentPage])

  const detail = detailId ? alerts.find(a => a.id === detailId) : null

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowForm(true)
  }

  function openEdit(a) {
    setEditingId(a.id)
    setForm({ title: a.title, device: a.device, severity: a.severity, message: a.message || '' })
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  function openView(a) {
    setDetailId(a.id)
    setView('detail')
  }

  function backToList() {
    setView('list')
    setDetailId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.title.trim()) errors.title = true
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError(null)
    try {
      const payload = { title: form.title.trim(), device: form.device.trim() || '—', severity: form.severity, message: form.message.trim() }
      if (editingId) {
        await updateDoc(doc(db, 'alerts', editingId), payload)
        logActivity({ action: 'UPDATE_ALERT', category: 'Alerts', summary: `Updated alert: ${payload.title}` })
      } else {
        await addDoc(collection(db, 'alerts'), { ...payload, ack: false, createdAt: serverTimestamp(), createdBy: user?.name || 'Operator' })
        logActivity({ action: 'CREATE_ALERT', category: 'Alerts', summary: `Created ${payload.severity} alert: ${payload.title}` })
      }
      closeForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleAck(alert) {
    try {
      await updateDoc(doc(db, 'alerts', alert.id), { ack: !alert.ack })
      logActivity({
        action: alert.ack ? 'UNACK_ALERT' : 'ACK_ALERT',
        category: 'Alerts',
        summary: `${alert.ack ? 'Reopened' : 'Acknowledged'} alert: ${alert.title}`,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'alerts', deleteTarget.id))
      logActivity({ action: 'DELETE_ALERT', category: 'Alerts', summary: `Deleted alert: ${deleteTarget.title}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteTarget(null)
    }
  }

  function handleExport(format) {
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'json') exportJson(`alerts-${stamp}.json`, filtered)
    else if (format === 'pdf') exportPdf(`alerts-${stamp}.pdf`, filtered)
    else exportCsv(`alerts-${stamp}.csv`, filtered)
    logActivity({ action: 'EXPORT_ALERTS', category: 'Alerts', summary: `Exported ${filtered.length} alerts to ${format.toUpperCase()}` })
    setShowExportMenu(false)
  }

  function openImport() {
    setImportStep('upload')
    setImportFileName('')
    setImportRows([])
    setShowImport(true)
  }

  function closeImport() {
    setShowImport(false)
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setImportRows(parseAlertFile(file.name, String(reader.result || '')))
      } catch {
        setError('Could not read that file — check it\'s a valid CSV or JSON export.')
        setImportRows([])
      }
    }
    reader.readAsText(file)
  }

  async function confirmImport() {
    setImporting(true)
    setError(null)
    try {
      for (const row of importRows) {
        await addDoc(collection(db, 'alerts'), { ...row, ack: false, createdAt: serverTimestamp(), createdBy: user?.name || 'Operator' })
      }
      logActivity({ action: 'IMPORT_ALERTS', category: 'Alerts', summary: `Imported ${importRows.length} alerts from ${importFileName}` })
      setImportStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <AppShell>
      <div className="page">
        {view === 'list' ? (
          <>
            <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
              <div>
                <div className="crumbs"><span>Home</span><span>›</span><span>Alerts Center</span></div>
                <h1>Alerts Center</h1>
              </div>
              <div className="page-head__actions">
                <button className="btn" onClick={openImport}>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15V3m0 0 4 4m-4-4L8 7" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
                  Import
                </button>
                <div className="profile-menu" ref={exportMenuRef}>
                  <button className="btn" onClick={() => setShowExportMenu(s => !s)} disabled={filtered.length === 0}>
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
                    Export
                  </button>
                  {showExportMenu && (
                    <div className="profile-dropdown">
                      <button className="profile-dropdown__item" onClick={() => handleExport('csv')}>Export as CSV</button>
                      <button className="profile-dropdown__item" onClick={() => handleExport('json')}>Export as JSON</button>
                      <button className="profile-dropdown__item" onClick={() => handleExport('pdf')}>Export as PDF</button>
                    </div>
                  )}
                </div>
                <button
                  className="btn btn--primary"
                  style={{ background: '#2563EB', borderColor: '#2563EB' }}
                  onClick={openAdd}
                >
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  Create Alert
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>TOTAL ALERTS</div>
                  <span style={badgeStyle('#4338ca', 22)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{counts.total}</div>
                  <Spark points={sparks.total} color="#4338ca" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.total} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>All severities combined</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>UNACK. CRITICAL</div>
                  <span style={badgeStyle(SEV_COLOR.critical, 22)}><SevIcon severity="critical" color={SEV_COLOR.critical} /></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: SEV_COLOR.critical }}>{counts.critical}</div>
                  <Spark points={sparks.critical} color={SEV_COLOR.critical} />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.critical} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Immediate action needed</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>UNACK. WARNING</div>
                  <span style={badgeStyle(SEV_COLOR.warning, 22)}><SevIcon severity="warning" color={SEV_COLOR.warning} /></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: SEV_COLOR.warning }}>{counts.warning}</div>
                  <Spark points={sparks.warning} color={SEV_COLOR.warning} />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.warning} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Needs attention soon</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>NEW INFO</div>
                  <span style={badgeStyle(SEV_COLOR.info, 22)}><SevIcon severity="info" color={SEV_COLOR.info} /></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: SEV_COLOR.info }}>{counts.info}</div>
                  <Spark points={sparks.info} color={SEV_COLOR.info} />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.info} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Informational only</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 16px', marginBottom: 18, marginLeft: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 9, padding: '9px 12px', minWidth: 220, flex: 1, maxWidth: 280 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search title, device…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--ink-900)' }}
                />
              </div>
              <select className="form-input" style={{ width: 'auto' }} value={filterSeverity} onChange={e => { setFilterSeverity(e.target.value); setPage(1) }}>
                <option value="All">All severities</option>
                {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={filterAck} onChange={e => { setFilterAck(e.target.value); setPage(1) }}>
                <option value="All">All</option>
                <option value="Unacknowledged">Unacknowledged</option>
                <option value="Acknowledged">Acknowledged</option>
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(1) }}>
                {DATE_FILTERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="date" className="form-input" style={{ width: 'auto', padding: '9px 10px' }}
                  value={dateFrom} max={dateTo || undefined}
                  onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                  title="From date"
                />
                <span style={{ color: 'var(--ink-400)', fontSize: 12 }}>–</span>
                <input
                  type="date" className="form-input" style={{ width: 'auto', padding: '9px 10px' }}
                  value={dateTo} min={dateFrom || undefined}
                  onChange={e => { setDateTo(e.target.value); setPage(1) }}
                  title="To date"
                />
                {(dateFrom || dateTo) && (
                  <button type="button" className="btn btn--sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}>Clear</button>
                )}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{filtered.length} alerts</div>
              <div style={{ display: 'flex', background: 'var(--ink-100)', borderRadius: 8, padding: 3, gap: 2 }}>
                <button
                  type="button" title="Table view" onClick={() => setViewMode('table')}
                  style={{ width: 30, height: 26, border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: viewMode === 'table' ? 'var(--surface)' : 'transparent', color: viewMode === 'table' ? 'var(--ink-900)' : 'var(--ink-500)', boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></svg>
                </button>
                <button
                  type="button" title="Grid view" onClick={() => setViewMode('grid')}
                  style={{ width: 30, height: 26, border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: viewMode === 'grid' ? 'var(--surface)' : 'transparent', color: viewMode === 'grid' ? 'var(--ink-900)' : 'var(--ink-500)', boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>
                </button>
              </div>
            </div>

            {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

            {loading ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading alerts…</div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No alerts found</div>
                <div style={{ fontSize: 13 }}>{alerts.length === 0 ? 'Click "Create Alert" to add your first one.' : 'No alerts match your filters.'}</div>
              </div>
            ) : viewMode === 'table' ? (
              <div className="card" style={{ marginLeft: 5 }}>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Device</th>
                        <th>Severity</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(a => {
                        const color = SEV_COLOR[a.severity] || SEV_COLOR.info
                        return (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => openView(a)}>{a.title}</td>
                            <td>{a.device || '—'}</td>
                            <td>
                              <span style={{ fontSize: 11, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '4px 10px', borderRadius: 20 }}>
                                {(a.severity || '').toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, fontWeight: 600, color: a.ack ? '#15803d' : 'var(--ink-500)', background: a.ack ? '#dcfce7' : 'var(--ink-100)', padding: '4px 10px', borderRadius: 20 }}>
                                {a.ack ? 'Acknowledged' : 'Unacknowledged'}
                              </span>
                            </td>
                            <td>{timeAgo(a.createdAt)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <IconBtn title="View" onClick={() => openView(a)}><ViewIcon /></IconBtn>
                                <IconBtn title={a.ack ? 'Reopen' : 'Acknowledge'} onClick={() => toggleAck(a)}><AckIcon acked={a.ack} /></IconBtn>
                                <IconBtn title="Edit" onClick={() => openEdit(a)}><EditIcon /></IconBtn>
                                <IconBtn title="Delete" danger onClick={() => setDeleteTarget(a)}><DeleteIcon /></IconBtn>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16, marginLeft: 5 }}>
                {pageItems.map(a => {
                  const color = SEV_COLOR[a.severity] || SEV_COLOR.info
                  return (
                    <div key={a.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '4px 10px', borderRadius: 20 }}>
                          {(a.severity || '').toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: a.ack ? '#15803d' : 'var(--ink-500)', background: a.ack ? '#dcfce7' : 'var(--ink-100)', padding: '4px 10px', borderRadius: 20 }}>
                          {a.ack ? 'Acknowledged' : 'Unacknowledged'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }} onClick={() => openView(a)}>{a.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{a.device || '—'} · {timeAgo(a.createdAt)}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, borderTop: '1px solid var(--ink-200)', paddingTop: 12 }}>
                        <IconBtn full title="View" onClick={() => openView(a)}><ViewIcon /></IconBtn>
                        <IconBtn full title={a.ack ? 'Reopen' : 'Acknowledge'} onClick={() => toggleAck(a)}><AckIcon acked={a.ack} /></IconBtn>
                        <IconBtn full title="Edit" onClick={() => openEdit(a)}><EditIcon /></IconBtn>
                        <IconBtn full title="Delete" danger onClick={() => setDeleteTarget(a)}><DeleteIcon /></IconBtn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, marginLeft: 5, flexWrap: 'wrap', gap: 12, background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-500)' }}>
                  Showing {rangeStart}–{rangeEnd} of {filtered.length}
                  <select className="form-input" style={{ width: 'auto', padding: '6px 8px', fontSize: 12 }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
                    <option value={5}>5 / page</option>
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="btn btn--sm" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                  {pageNumbers.map((p, i) => p === '…' ? (
                    <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--ink-500)' }}>…</span>
                  ) : (
                    <button
                      key={p} className="btn btn--sm"
                      style={p === currentPage ? { background: '#2563EB', borderColor: '#2563EB', color: '#fff' } : undefined}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button className="btn btn--sm" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
                </div>
              </div>
            )}
          </>
        ) : detail ? (
          <div>
            <div onClick={backToList} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-500)', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to Alerts Center
            </div>
            <div className="card" style={{ padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{detail.title}</h1>
                  {(() => {
                    const color = SEV_COLOR[detail.severity] || SEV_COLOR.info
                    return (
                      <span style={{ fontSize: 12, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 16%, transparent)`, padding: '4px 10px', borderRadius: 20 }}>
                        {(detail.severity || '').toUpperCase()}
                      </span>
                    )
                  })()}
                  <span style={{ fontSize: 12, fontWeight: 600, color: detail.ack ? '#15803d' : 'var(--ink-500)', background: detail.ack ? '#dcfce7' : 'var(--ink-100)', padding: '4px 10px', borderRadius: 20 }}>
                    {detail.ack ? 'Acknowledged' : 'Unacknowledged'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{detail.device || '—'} · {timeAgo(detail.createdAt)}{detail.createdBy ? ` · by ${detail.createdBy}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => toggleAck(detail)}>{detail.ack ? 'Reopen' : 'Acknowledge'}</button>
                <button className="btn" onClick={() => openEdit(detail)}>Edit</button>
                <button className="btn btn--danger" onClick={() => setDeleteTarget(detail)}>Delete</button>
              </div>
            </div>

            <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>Device</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{detail.device || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>Date Added</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(detail.createdAt)}</span>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13, display: 'block', marginBottom: 6 }}>Message</span>
                <span style={{ fontSize: 13, color: 'var(--ink-800)' }}>{detail.message || '—'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
            <div style={{ marginBottom: 12 }}>This alert no longer exists.</div>
            <button className="btn btn--primary" onClick={backToList}>Back to Alerts Center</button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal__head">
              <h3>{editingId ? `Edit Alert: ${form.title}` : 'Create Alert'}</h3>
              <button className="modal__close" onClick={closeForm} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="modal__body">
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Title *</label>
                    <input
                      className="form-input"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. ESXi-Host-03 CPU sustained above 90%"
                      style={formErrors.title ? { borderColor: '#dc2626' } : undefined}
                    />
                    {formErrors.title && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Title is required</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Device</label>
                    <input
                      className="form-input"
                      value={form.device}
                      onChange={e => setForm(f => ({ ...f, device: e.target.value }))}
                      placeholder="e.g. ESXi-Host-03"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Severity</label>
                    <select
                      className="form-input"
                      value={form.severity}
                      onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                    >
                      {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Message (optional)</label>
                  <input
                    className="form-input"
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Additional details"
                  />
                </div>

                {error && <div className="settings-error" style={{ marginBottom: 14 }}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn" onClick={closeForm}>Cancel</button>
                  <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Alert'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete "{deleteTarget.title}"?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This action can't be undone. The alert will be permanently removed.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn--danger" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-backdrop" onClick={closeImport}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal__head" style={{ background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)', borderRadius: '14px 14px 0 0', paddingBottom: 16 }}>
              <h3>Import Alerts</h3>
              <button className="modal__close" onClick={closeImport} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="modal__body">
              {importStep === 'upload' && (
                <div>
                  <label style={{ display: 'block', border: '2px dashed var(--ink-300)', borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', color: 'var(--ink-500)', fontSize: 13 }}>
                    <input type="file" accept=".csv,.json" onChange={handleFileChosen} style={{ display: 'none' }} />
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth="1.6" style={{ margin: '0 auto 10px', display: 'block' }}><path d="M12 15V3m0 0 4 4m-4-4L8 7" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></svg>
                    <div style={{ fontWeight: 600, color: 'var(--ink-700)' }}>Click to choose a CSV or JSON file</div>
                    <div style={{ marginTop: 4 }}>CSV columns: title, device, severity, message — or a JSON array of alerts</div>
                  </label>
                  {importFileName && (
                    <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-700)', background: 'var(--ink-50)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileTypeIcon filename={importFileName} />
                      <span>Selected: <strong>{importFileName}</strong> — {importRows.length} row{importRows.length === 1 ? '' : 's'} detected</span>
                    </div>
                  )}
                  {error && <div className="settings-error" style={{ marginTop: 14 }}>{error}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                    <button className="btn" onClick={closeImport}>Cancel</button>
                    <button
                      className="btn btn--primary"
                      style={{ background: '#2563EB', borderColor: '#2563EB' }}
                      disabled={importRows.length === 0}
                      onClick={() => setImportStep('preview')}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'preview' && (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 12 }}>
                    Detected {importRows.length} alert{importRows.length === 1 ? '' : 's'} in <strong>{importFileName}</strong>:
                  </div>
                  <div style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden', marginBottom: 18, maxHeight: 240, overflowY: 'auto' }}>
                    {importRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--ink-100)', fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{row.title}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{row.severity || '—'}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{row.device || '—'}</span>
                      </div>
                    ))}
                  </div>
                  {error && <div className="settings-error" style={{ marginBottom: 14 }}>{error}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button className="btn" onClick={() => setImportStep('upload')}>Back</button>
                    <button
                      className="btn btn--primary"
                      style={{ background: '#2563EB', borderColor: '#2563EB' }}
                      disabled={importing}
                      onClick={confirmImport}
                    >
                      {importing ? 'Importing…' : `Import ${importRows.length} Alert${importRows.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'done' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Import complete</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>{importRows.length} alert{importRows.length === 1 ? '' : 's'} were added.</div>
                  <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={closeImport}>Done</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
