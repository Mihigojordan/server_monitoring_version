import { useState, useEffect, useRef, useMemo } from 'react'
import {
  collection, query, orderBy, onSnapshot, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { logActivity } from '../../hooks/useActivityLog'

const EXPORT_FIELDS = ['name', 'category', 'model', 'serial', 'ip', 'status', 'cpu', 'ram', 'disk', 'yearAcquired', 'location', 'notes']

const STATUSES = ['Online', 'Degraded', 'Offline']

const STATUS_META = {
  Online:   { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Degraded: { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
  Offline:  { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
}

// Server, Storage and ESXi Host live in Server/Storage Management, and Blade
// Switch now lives in Network Management — this page is the home for
// whatever doesn't have a dedicated module yet (currently nothing).
const CATEGORIES = []

const CATEGORY_META = {
  'Blade Switch': { bg: '#fff7ed', text: '#c2410c' },
}
const CATEGORY_FALLBACK = { bg: '#f1f5f9', text: '#475569' }
const categoryStyle = name => CATEGORY_META[name] || CATEGORY_FALLBACK

const EMPTY_FORM = {
  name: '', category: '', status: 'Online',
  cpu: '', ram: '', disk: '',
  ip: '', serial: '', yearAcquired: '', model: '',
  location: '', notes: '',
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

// Real week-over-week trend from each resource's createdAt — added-this-week vs
// added-the-week-before, not a fabricated number.
function trendFor(resources, matches) {
  const WEEK = 7 * 86400000
  const now = Date.now()
  const addedAt = r => r.createdAt?.toDate?.().getTime()
  const curr = resources.filter(r => matches(r) && addedAt(r) >= now - WEEK && addedAt(r) < now).length
  const prev = resources.filter(r => matches(r) && addedAt(r) >= now - 2 * WEEK && addedAt(r) < now - WEEK).length
  if (curr === 0 && prev === 0) return { dir: 'flat', label: 'No change this week' }
  if (prev === 0) return { dir: 'up', label: `+${curr} new this week` }
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return { dir: 'flat', label: 'No change vs last week' }
  return { dir: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : ''}${pct}% vs last week` }
}

function computeTrends(resources) {
  return {
    total: trendFor(resources, () => true),
    online: trendFor(resources, r => r.status === 'Online'),
    degraded: trendFor(resources, r => r.status === 'Degraded'),
    offline: trendFor(resources, r => r.status === 'Offline'),
  }
}

// Cumulative count per day over the last 14 days, built from each resource's
// real createdAt — an honest growth curve, not synthetic sample data. (Doesn't
// account for deletions, since we only see resources that still exist.)
function sparkPoints(resources, matches, days = 14) {
  const DAY = 86400000
  const now = Date.now()
  const dayStart = now - (days - 1) * DAY
  const addedAt = r => r.createdAt?.toDate?.().getTime()
  const counts = []
  for (let i = 0; i < days; i++) {
    const cutoff = dayStart + i * DAY + DAY
    counts.push(resources.filter(r => matches(r) && addedAt(r) && addedAt(r) < cutoff).length)
  }
  const w = 80, h = 32, pad = 4
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const range = Math.max(max - min, 1)
  return counts
    .map((c, i) => {
      const x = (i / (days - 1)) * w
      const y = h - pad - ((c - min) / range) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function computeSparks(resources) {
  return {
    total: sparkPoints(resources, () => true),
    online: sparkPoints(resources, r => r.status === 'Online'),
    degraded: sparkPoints(resources, r => r.status === 'Degraded'),
    offline: sparkPoints(resources, r => r.status === 'Offline'),
  }
}

const DATE_FILTERS = [
  { value: 'All', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

function matchesDateFilter(resource, filterDate) {
  if (filterDate === 'All') return true
  const addedAt = resource.createdAt?.toDate?.().getTime()
  if (!addedAt) return false
  return addedAt >= Date.now() - Number(filterDate) * 86400000
}

function matchesDateRange(resource, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true
  const addedAt = resource.createdAt?.toDate?.().getTime()
  if (!addedAt) return false
  if (dateFrom && addedAt < new Date(`${dateFrom}T00:00:00`).getTime()) return false
  if (dateTo && addedAt > new Date(`${dateTo}T23:59:59.999`).getTime()) return false
  return true
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

const IMPORT_HEADER_ALIASES = {
  name: 'name', category: 'category', location: 'location',
  ip: 'ip', 'ip address': 'ip', status: 'status',
  model: 'model', 'model / make': 'model', make: 'model',
  serial: 'serial', 'serial number': 'serial',
  cpu: 'cpu', ram: 'ram', disk: 'disk',
  yearacquired: 'yearAcquired', 'year of acquisition': 'yearAcquired', 'year acquired': 'yearAcquired',
  notes: 'notes',
}

function sanitizeRow(raw) {
  const row = { name: '', category: '', location: '', ip: '', status: 'Online' }
  EXPORT_FIELDS.forEach(f => { if (raw[f]) row[f] = String(raw[f]) })
  if (!STATUSES.includes(row.status)) row.status = 'Online'
  return row
}

function parseResourceCsv(text) {
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
  }).filter(row => row.name)
}

function parseResourceJson(text) {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : [data]
  return list.map(sanitizeRow).filter(row => row.name)
}

function parseResourceFile(filename, text) {
  return filename.toLowerCase().endsWith('.json') ? parseResourceJson(text) : parseResourceCsv(text)
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
  pdf.text('Resources', marginX, y)
  y += 24
  pdf.setFontSize(9)
  rows.forEach(r => {
    if (y > 780) { pdf.addPage(); y = 50 }
    pdf.setFont(undefined, 'bold')
    pdf.text(r.name || '—', marginX, y)
    pdf.setFont(undefined, 'normal')
    pdf.text(`${r.category || '—'}  ·  ${r.model || '—'}  ·  ${r.ip || '—'}  ·  ${r.status || '—'}`, marginX, y + 12)
    y += 28
  })
  pdf.save(filename)
}

function Spark({ points, color }) {
  return (
    <svg width="52" height="20" viewBox="0 0 80 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <polyline points={points} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ResourceManagement() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [view, setView] = useState('list') // list | form | detail
  const [editingId, setEditingId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterDate, setFilterDate] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState('table') // table | grid
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showClearAll, setShowClearAll] = useState(false)
  const [clearing, setClearing] = useState(false)

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
    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setResources(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [])

  const counts = useMemo(() => {
    const total = resources.length
    const online = resources.filter(r => r.status === 'Online').length
    const degraded = resources.filter(r => r.status === 'Degraded').length
    const offline = resources.filter(r => r.status === 'Offline').length
    return { total, online, degraded, offline, onlinePct: total ? Math.round((online / total) * 100) : 0 }
  }, [resources])

  const trends = useMemo(() => computeTrends(resources), [resources])
  const sparks = useMemo(() => computeSparks(resources), [resources])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return resources.filter(r => {
      if (filterStatus !== 'All' && r.status !== filterStatus) return false
      if (!matchesDateFilter(r, filterDate)) return false
      if (!matchesDateRange(r, dateFrom, dateTo)) return false
      if (q && !`${r.name} ${r.ip} ${r.model} ${r.serial}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [resources, search, filterStatus, filterDate, dateFrom, dateTo])

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

  const detail = detailId ? resources.find(r => r.id === detailId) : null

  function openAdd() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, category: CATEGORIES[0] })
    setFormErrors({})
    setView('form')
  }

  function openEdit(r) {
    setEditingId(r.id)
    setForm({ ...EMPTY_FORM, ...r })
    setFormErrors({})
    setView('form')
  }

  function openView(r) {
    setDetailId(r.id)
    setView('detail')
  }

  function backToList() {
    setView('list')
    setEditingId(null)
    setDetailId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.name.trim()) errors.name = true
    if (!form.category.trim()) errors.category = true
    if (!form.ip.trim()) errors.ip = true
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, name: form.name.trim() }
      if (editingId) {
        await updateDoc(doc(db, 'resources', editingId), payload)
        logActivity({ action: 'UPDATE_RESOURCE', category: 'Resources', summary: `Updated resource: ${payload.name}` })
      } else {
        await addDoc(collection(db, 'resources'), { ...payload, createdAt: serverTimestamp() })
        logActivity({ action: 'CREATE_RESOURCE', category: 'Resources', summary: `Added resource: ${payload.name}` })
      }
      backToList()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'resources', deleteTarget.id))
      logActivity({ action: 'DELETE_RESOURCE', category: 'Resources', summary: `Deleted resource: ${deleteTarget.name}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteTarget(null)
    }
  }

  async function confirmClearAll() {
    setClearing(true)
    setError(null)
    try {
      for (const collName of ['resources', 'resourceCategories']) {
        const snap = await getDocs(collection(db, collName))
        const docs = snap.docs
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db)
          docs.slice(i, i + 400).forEach(d => batch.delete(d.ref))
          await batch.commit()
        }
      }
      logActivity({ action: 'CLEAR_RESOURCES', category: 'Resources', summary: 'Cleared all resource inventory data' })
      setShowClearAll(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setClearing(false)
    }
  }

  function handleExport(format) {
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'json') exportJson(`resources-${stamp}.json`, filtered)
    else if (format === 'pdf') exportPdf(`resources-${stamp}.pdf`, filtered)
    else exportCsv(`resources-${stamp}.csv`, filtered)
    logActivity({ action: 'EXPORT_RESOURCES', category: 'Resources', summary: `Exported ${filtered.length} resources to ${format.toUpperCase()}` })
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
        setImportRows(parseResourceFile(file.name, String(reader.result || '')))
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
        await addDoc(collection(db, 'resources'), { ...EMPTY_FORM, ...row, createdAt: serverTimestamp() })
      }
      logActivity({ action: 'IMPORT_RESOURCES', category: 'Resources', summary: `Imported ${importRows.length} resources from ${importFileName}` })
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
                <div className="crumbs"><span>Home</span><span>›</span><span>Resources Management</span></div>
                <h1>Resources Management</h1>
              </div>
              <div className="page-head__actions">
                <button className="btn btn--danger" onClick={() => setShowClearAll(true)} disabled={resources.length === 0}>
                  Clear All Data
                </button>
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
                  Add Resource
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>TOTAL RESOURCES</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2"><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="14" width="18" height="7" rx="1.5" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{counts.total}</div>
                  <Spark points={sparks.total} color="#4338ca" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.total} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Across {CATEGORIES.length} equipment types</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>ONLINE</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{counts.online}</div>
                  <Spark points={sparks.online} color="#15803d" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.online} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{counts.onlinePct}% of total</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>DEGRADED</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2"><path d="M12 2 2 20h20L12 2Z" /><path d="M12 9v5" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>{counts.degraded}</div>
                  <Spark points={sparks.degraded} color="#b45309" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.degraded} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Needs attention soon</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>OFFLINE</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#b91c1c' }}>{counts.offline}</div>
                  <Spark points={sparks.offline} color="#b91c1c" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.offline} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Immediate action needed</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 16px', marginBottom: 18, marginLeft: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 9, padding: '9px 12px', minWidth: 220, flex: 1, maxWidth: 280 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search name, IP, model, serial…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--ink-900)' }}
                />
              </div>
              <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
                <option value="All">All statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
                  <button
                    type="button" className="btn btn--sm"
                    onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{filtered.length} resources</div>
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
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading resources…</div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No resources found</div>
                <div style={{ fontSize: 13 }}>{resources.length === 0 ? 'Click "Add Resource" to register your first one.' : 'No resources match your filters.'}</div>
              </div>
            ) : viewMode === 'table' ? (
              <div className="card" style={{ marginLeft: 5 }}>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Model / Make</th>
                        <th>IP Address</th>
                        <th>Status</th>
                        <th>Year Acquired</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(r => {
                        const cs = categoryStyle(r.category)
                        const ss = STATUS_META[r.status] || STATUS_META.Online
                        return (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => openView(r)}>{r.name}</td>
                            <td><span style={{ background: cs.bg, color: cs.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{r.category || '—'}</span></td>
                            <td>{r.model || '—'}</td>
                            <td className="mono">{r.ip || '—'}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{r.status}
                              </span>
                            </td>
                            <td>{r.yearAcquired || '—'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <IconBtn title="View" onClick={() => openView(r)}><ViewIcon /></IconBtn>
                                <IconBtn title="Edit" onClick={() => openEdit(r)}><EditIcon /></IconBtn>
                                <IconBtn title="Delete" danger onClick={() => setDeleteTarget(r)}><DeleteIcon /></IconBtn>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
                {pageItems.map(r => {
                  const cs = categoryStyle(r.category)
                  const ss = STATUS_META[r.status] || STATUS_META.Online
                  return (
                    <div key={r.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ background: cs.bg, color: cs.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{r.category || '—'}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{r.status}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }} onClick={() => openView(r)}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{r.model || '—'}</div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ink-500)' }}>{r.ip || '—'}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, borderTop: '1px solid var(--ink-200)', paddingTop: 12 }}>
                        <IconBtn full title="View" onClick={() => openView(r)}><ViewIcon /></IconBtn>
                        <IconBtn full title="Edit" onClick={() => openEdit(r)}><EditIcon /></IconBtn>
                        <IconBtn full title="Delete" danger onClick={() => setDeleteTarget(r)}><DeleteIcon /></IconBtn>
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
        ) : view === 'form' ? (
          <div>
            <div onClick={backToList} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-500)', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to Resources Management
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px' }}>{editingId ? `Edit Resource: ${form.name}` : 'Add Resource'}</h1>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Basic Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label">Resource Name *</label>
                    <input
                      className="form-input"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. ESXi Host 1"
                      style={formErrors.name ? { borderColor: '#dc2626' } : undefined}
                    />
                    {formErrors.name && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Name is required</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      className="form-input"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      style={formErrors.category ? { borderColor: '#dc2626' } : undefined}
                    >
                      <option value="">Select category…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {formErrors.category && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Category is required</div>}
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Availability Status</label>
                    <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Resources (Specifications)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label">CPU</label>
                    <input
                      className="form-input"
                      value={form.cpu}
                      onChange={e => setForm(f => ({ ...f, cpu: e.target.value }))}
                      placeholder="e.g. 2x Intel Xeon Gold 6248, 40 cores"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">RAM</label>
                    <input
                      className="form-input"
                      value={form.ram}
                      onChange={e => setForm(f => ({ ...f, ram: e.target.value }))}
                      placeholder="e.g. 256 GB"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Disk</label>
                    <input
                      className="form-input"
                      value={form.disk}
                      onChange={e => setForm(f => ({ ...f, disk: e.target.value }))}
                      placeholder="e.g. 20 TB usable (RAID 10)"
                    />
                  </div>
                </div>
              </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Identification</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label">Model / Make</label>
                    <input
                      className="form-input"
                      value={form.model}
                      onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                      placeholder="e.g. Dell PowerEdge R650"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Serial Number</label>
                    <input
                      className="form-input"
                      value={form.serial}
                      onChange={e => setForm(f => ({ ...f, serial: e.target.value }))}
                      placeholder="e.g. SN-SE10001"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year of Acquisition</label>
                    <input
                      className="form-input"
                      type="number"
                      value={form.yearAcquired}
                      onChange={e => setForm(f => ({ ...f, yearAcquired: e.target.value }))}
                      placeholder="e.g. 2023"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IP Address *</label>
                    <input
                      className="form-input"
                      value={form.ip}
                      onChange={e => setForm(f => ({ ...f, ip: e.target.value }))}
                      placeholder="e.g. 10.10.1.24"
                      style={formErrors.ip ? { borderColor: '#dc2626' } : undefined}
                    />
                    {formErrors.ip && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>IP address is required</div>}
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Location &amp; Notes</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Location</label>
                    <input
                      className="form-input"
                      value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Server Room · Rack 2"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-input form-input--textarea"
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Any additional context…"
                    />
                  </div>
                </div>
              </div>
                </div>
              </div>

              {error && <div className="settings-error" style={{ margin: '18px 0 0' }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn" onClick={backToList}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Resource'}
                </button>
              </div>
            </form>
          </div>
        ) : detail ? (
          <div>
            <div onClick={backToList} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-500)', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to Resources Management
            </div>
            <div className="card" style={{ padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{detail.name}</h1>
                  {(() => {
                    const ss = STATUS_META[detail.status] || STATUS_META.Online
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{detail.status}
                      </span>
                    )
                  })()}
                  {(() => {
                    const cs = categoryStyle(detail.category)
                    return <span style={{ background: cs.bg, color: cs.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{detail.category || '—'}</span>
                  })()}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{detail.model || '—'} · {detail.ip || '—'}{detail.location ? ` · ${detail.location}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => openEdit(detail)}>Edit</button>
                <button className="btn btn--danger" onClick={() => setDeleteTarget(detail)}>Delete</button>
              </div>
            </div>

            <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
              {[
                ['Model / Make', detail.model], ['Serial Number', detail.serial], ['Year of Acquisition', detail.yearAcquired],
                ['CPU', detail.cpu], ['RAM', detail.ram], ['Disk', detail.disk],
                ['IP Address', detail.ip], ['Location', detail.location],
                ['Date Added', formatDate(detail.createdAt)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                  <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{value || '—'}</span>
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13, display: 'block', marginBottom: 6 }}>Notes</span>
                <span style={{ fontSize: 13, color: 'var(--ink-800)' }}>{detail.notes || '—'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
            <div style={{ marginBottom: 12 }}>This resource no longer exists.</div>
            <button className="btn btn--primary" onClick={backToList}>Back to Resources Management</button>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete {deleteTarget.name}?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This action can't be undone. The resource will be permanently removed from your inventory.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn--danger" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClearAll && (
        <div className="modal-backdrop" onClick={() => !clearing && setShowClearAll(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Clear all resource data?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>
                This permanently deletes all {resources.length} resource record{resources.length === 1 ? '' : 's'} from your inventory. This action can't be undone.
              </div>
              {error && <div className="settings-error" style={{ marginBottom: 14 }}>{error}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" disabled={clearing} onClick={() => setShowClearAll(false)}>Cancel</button>
                <button className="btn btn--danger" disabled={clearing} onClick={confirmClearAll}>
                  {clearing ? 'Clearing…' : 'Clear All Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-backdrop" onClick={closeImport}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal__head" style={{ background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)', borderRadius: '14px 14px 0 0', paddingBottom: 16 }}>
              <h3>Import Resources</h3>
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
                    <div style={{ marginTop: 4 }}>CSV columns: name, category, model, serial, ip, status, cpu, ram, disk, yearAcquired, location — or a JSON array of resources</div>
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
                    Detected {importRows.length} resource{importRows.length === 1 ? '' : 's'} in <strong>{importFileName}</strong>:
                  </div>
                  <div style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden', marginBottom: 18, maxHeight: 240, overflowY: 'auto' }}>
                    {importRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--ink-100)', fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{row.name}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{row.category || '—'}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{row.ip || '—'}</span>
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
                      {importing ? 'Importing…' : `Import ${importRows.length} Resource${importRows.length === 1 ? '' : 's'}`}
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
                  <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>{importRows.length} resource{importRows.length === 1 ? '' : 's'} were added to your inventory.</div>
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
