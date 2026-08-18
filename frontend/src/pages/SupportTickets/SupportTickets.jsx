import { useState, useEffect, useRef, useMemo } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { logActivity } from '../../hooks/useActivityLog'

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']
const CATEGORIES = ['Technical', 'Billing', 'Access Request', 'Bug Report', 'Feature Request', 'Other']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const STATUS_META = {
  Open:          { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  'In Progress': { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
  Resolved:      { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Closed:        { bg: 'var(--ink-100)', text: 'var(--ink-500)', dot: 'var(--ink-400)' },
}

const PRIORITY_META = {
  Low:      { bg: 'var(--ink-100)', text: 'var(--ink-500)' },
  Medium:   { bg: '#dbeafe', text: '#1d4ed8' },
  High:     { bg: '#fef3c7', text: '#b45309' },
  Critical: { bg: '#fee2e2', text: '#b91c1c' },
}

// Legacy tickets predate the status/category/priority workflow — normalize
// them into the current enum rather than dropping or guessing their history.
function normalizeStatus(status) {
  if (STATUSES.includes(status)) return status
  return 'Open'
}
function normalizeCategory(category) {
  return CATEGORIES.includes(category) ? category : 'Other'
}
function normalizePriority(priority) {
  return PRIORITIES.includes(priority) ? priority : 'Medium'
}

const DATE_FILTERS = [
  { value: 'All', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

function matchesDateFilter(t, filterDate) {
  if (filterDate === 'All') return true
  const ts = t.createdAt?.toDate?.().getTime()
  if (!ts) return false
  return ts >= Date.now() - Number(filterDate) * 86400000
}

function matchesDateRange(t, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true
  const ts = t.createdAt?.toDate?.().getTime()
  if (!ts) return false
  if (dateFrom && ts < new Date(`${dateFrom}T00:00:00`).getTime()) return false
  if (dateTo && ts > new Date(`${dateTo}T23:59:59.999`).getTime()) return false
  return true
}

function formatDate(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatDateTime(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
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

const IMPORT_FIELDS = ['subject', 'message', 'category', 'priority', 'status', 'createdBy', 'assignee']
const IMPORT_HEADER_ALIASES = {
  subject: 'subject', message: 'message', description: 'message',
  category: 'category', priority: 'priority', status: 'status',
  createdby: 'createdBy', 'created by': 'createdBy', submitter: 'createdBy', 'submitted by': 'createdBy',
  assignee: 'assignee',
}

function sanitizeImportRow(raw) {
  const row = { subject: '', message: '', category: 'Other', priority: 'Medium', status: 'Open', createdBy: '', assignee: '' }
  IMPORT_FIELDS.forEach(f => { if (raw[f]) row[f] = String(raw[f]) })
  row.category = normalizeCategory(row.category)
  row.priority = normalizePriority(row.priority)
  row.status = normalizeStatus(row.status)
  return row
}

function parseTicketCsv(text) {
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
    return sanitizeImportRow(raw)
  }).filter(row => row.subject)
}

function parseTicketJson(text) {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : [data]
  return list.map(sanitizeImportRow).filter(row => row.subject)
}

function parseTicketFile(filename, text) {
  return filename.toLowerCase().endsWith('.json') ? parseTicketJson(text) : parseTicketCsv(text)
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

const EXPORT_FIELDS = ['subject', 'category', 'priority', 'status', 'createdBy', 'assignee']

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
  pdf.text('Support Tickets', marginX, y)
  y += 24
  pdf.setFontSize(9)
  rows.forEach(r => {
    if (y > 780) { pdf.addPage(); y = 50 }
    pdf.setFont(undefined, 'bold')
    pdf.text(r.subject || '—', marginX, y)
    pdf.setFont(undefined, 'normal')
    pdf.text(`${r.category || '—'}  ·  ${r.priority || '—'}  ·  ${r.status || '—'}  ·  ${r.createdBy || '—'}`, marginX, y + 12)
    y += 28
  })
  pdf.save(filename)
}

export default function SupportTickets() {
  const [rawTickets, setRawTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterPriority, setFilterPriority] = useState('All')
  const [filterDate, setFilterDate] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef(null)

  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState('upload')
  const [importFileName, setImportFileName] = useState('')
  const [importRows, setImportRows] = useState([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    function handler(e) { if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setRawTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [])

  const tickets = useMemo(() => rawTickets.map(t => ({
    ...t,
    status: normalizeStatus(t.status),
    category: normalizeCategory(t.category),
    priority: normalizePriority(t.priority),
  })), [rawTickets])

  const counts = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
  }), [tickets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter(t => {
      if (filterStatus !== 'All' && t.status !== filterStatus) return false
      if (filterCategory !== 'All' && t.category !== filterCategory) return false
      if (filterPriority !== 'All' && t.priority !== filterPriority) return false
      if (!matchesDateFilter(t, filterDate)) return false
      if (!matchesDateRange(t, dateFrom, dateTo)) return false
      if (q && !`${t.subject} ${t.createdBy} ${t.message}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [tickets, search, filterStatus, filterCategory, filterPriority, filterDate, dateFrom, dateTo])

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

  function openEdit(t) {
    setEditForm({ id: t.id, status: t.status, category: t.category, priority: t.priority, assignee: t.assignee || '' })
    setShowEdit(true)
  }

  function closeEdit() {
    setShowEdit(false)
    setEditForm(null)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editForm) return
    setSaving(true)
    setError(null)
    try {
      const resolving = editForm.status === 'Resolved' || editForm.status === 'Closed'
      await updateDoc(doc(db, 'supportTickets', editForm.id), {
        status: editForm.status,
        category: editForm.category,
        priority: editForm.priority,
        assignee: editForm.assignee.trim(),
        resolvedAt: resolving ? serverTimestamp() : null,
      })
      logActivity({ action: 'UPDATE_SUPPORT_TICKET', category: 'Support', summary: `Updated ticket status to ${editForm.status}` })
      if (viewTarget?.id === editForm.id) setViewTarget(null)
      closeEdit()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'supportTickets', deleteTarget.id))
      logActivity({ action: 'DELETE_SUPPORT_TICKET', category: 'Support', summary: `Deleted ticket: ${deleteTarget.subject}` })
      if (viewTarget?.id === deleteTarget.id) setViewTarget(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteTarget(null)
    }
  }

  function handleExport(format) {
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'json') exportJson(`support-tickets-${stamp}.json`, filtered)
    else if (format === 'pdf') exportPdf(`support-tickets-${stamp}.pdf`, filtered)
    else exportCsv(`support-tickets-${stamp}.csv`, filtered)
    logActivity({ action: 'EXPORT_SUPPORT_TICKETS', category: 'Support', summary: `Exported ${filtered.length} support tickets to ${format.toUpperCase()}` })
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
        setImportRows(parseTicketFile(file.name, String(reader.result || '')))
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
        const resolving = row.status === 'Resolved' || row.status === 'Closed'
        await addDoc(collection(db, 'supportTickets'), {
          ...row,
          createdAt: serverTimestamp(),
          resolvedAt: resolving ? serverTimestamp() : null,
        })
      }
      logActivity({ action: 'IMPORT_SUPPORT_TICKETS', category: 'Support', summary: `Imported ${importRows.length} support tickets from ${importFileName}` })
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
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Support Tickets</span></div>
            <h1>Support Tickets</h1>
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
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 18 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>TOTAL TICKETS</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{counts.total}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>OPEN</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: '#1d4ed8' }}>{counts.open}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>IN PROGRESS</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: '#b45309' }}>{counts.inProgress}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>RESOLVED / CLOSED</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: '#15803d' }}>{counts.resolved}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', marginBottom: 18, marginLeft: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 9, padding: '9px 12px', minWidth: 220, flex: 1, maxWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search subject, submitter, message…"
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--ink-900)' }}
            />
          </div>
          <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="All">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}>
            <option value="All">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1) }}>
            <option value="All">All priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
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
          <div style={{ fontSize: 12, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{filtered.length} tickets</div>
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
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading support tickets…</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No support tickets found</div>
            <div style={{ fontSize: 13 }}>{tickets.length === 0 ? 'Tickets submitted from Help Center will show up here.' : 'No tickets match your filters.'}</div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="card" style={{ marginLeft: 5 }}>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Submitted By</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(t => {
                    const ss = STATUS_META[t.status]
                    const ps = PRIORITY_META[t.priority]
                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600, cursor: 'pointer', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => setViewTarget(t)}>{t.subject}</td>
                        <td>{t.category}</td>
                        <td><span style={{ background: ps.bg, color: ps.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{t.priority}</span></td>
                        <td>{t.createdBy || '—'}</td>
                        <td>{formatDate(t.createdAt)}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{t.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <IconBtn title="View" onClick={() => setViewTarget(t)}><ViewIcon /></IconBtn>
                            <IconBtn title="Edit" onClick={() => openEdit(t)}><EditIcon /></IconBtn>
                            <IconBtn title="Delete" danger onClick={() => setDeleteTarget(t)}><DeleteIcon /></IconBtn>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginLeft: 5 }}>
            {pageItems.map(t => {
              const ss = STATUS_META[t.status]
              const ps = PRIORITY_META[t.priority]
              return (
                <div key={t.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ background: ps.bg, color: ps.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{t.priority}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{t.status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }} onClick={() => setViewTarget(t)}>{t.subject}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{t.category} · {t.createdBy || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{formatDate(t.createdAt)}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, borderTop: '1px solid var(--ink-200)', paddingTop: 12 }}>
                    <IconBtn full title="View" onClick={() => setViewTarget(t)}><ViewIcon /></IconBtn>
                    <IconBtn full title="Edit" onClick={() => openEdit(t)}><EditIcon /></IconBtn>
                    <IconBtn full title="Delete" danger onClick={() => setDeleteTarget(t)}><DeleteIcon /></IconBtn>
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
      </div>

      {showEdit && editForm && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal__head">
              <h3>Update Ticket</h3>
              <button className="modal__close" onClick={closeEdit} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="modal__body">
              <form onSubmit={handleSaveEdit}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <input
                    className="form-input"
                    value={editForm.assignee}
                    onChange={e => setEditForm(f => ({ ...f, assignee: e.target.value }))}
                    placeholder="e.g. Platform Engineering"
                  />
                </div>

                {error && <div className="settings-error" style={{ marginTop: 14 }}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <button type="button" className="btn" onClick={closeEdit}>Cancel</button>
                  <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {viewTarget && (
        <div className="modal-backdrop" onClick={() => setViewTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal__head">
              <h3>{viewTarget.subject}</h3>
              <button className="modal__close" onClick={() => setViewTarget(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="modal__body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', fontSize: 13, marginBottom: 18 }}>
                <div><div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Status</div><div style={{ fontWeight: 700 }}>{viewTarget.status}</div></div>
                <div><div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Category</div><div style={{ fontWeight: 700 }}>{normalizeCategory(viewTarget.category)}</div></div>
                <div><div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Priority</div><div style={{ fontWeight: 700 }}>{normalizePriority(viewTarget.priority)}</div></div>
                <div><div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Assignee</div><div style={{ fontWeight: 700 }}>{viewTarget.assignee || '—'}</div></div>
                <div><div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Submitted By</div><div style={{ fontWeight: 700 }}>{viewTarget.createdBy || '—'}</div></div>
                <div><div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Submitted</div><div style={{ fontWeight: 700 }}>{formatDateTime(viewTarget.createdAt)}</div></div>
                {viewTarget.resolvedAt && (
                  <div><div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Resolved</div><div style={{ fontWeight: 700 }}>{formatDateTime(viewTarget.resolvedAt)}</div></div>
                )}
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 4 }}>Message</div>
                <div style={{ fontSize: 13, color: 'var(--ink-800)', whiteSpace: 'pre-wrap' }}>{viewTarget.message}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => openEdit(viewTarget)}>Edit</button>
                <button className="btn btn--danger" onClick={() => setDeleteTarget(viewTarget)}>Delete</button>
              </div>
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
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete this ticket?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>"{deleteTarget.subject}" will be permanently removed. This action can't be undone.</div>
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
              <h3>Import Support Tickets</h3>
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
                    <div style={{ marginTop: 4 }}>CSV columns: subject, message, category, priority, status, createdBy, assignee — or a JSON array</div>
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
                    Detected {importRows.length} ticket{importRows.length === 1 ? '' : 's'} in <strong>{importFileName}</strong>:
                  </div>
                  <div style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden', marginBottom: 18, maxHeight: 240, overflowY: 'auto' }}>
                    {importRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--ink-100)', fontSize: 13 }}>
                        <span style={{ fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.subject}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{row.category}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{row.priority}</span>
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
                      {importing ? 'Importing…' : `Import ${importRows.length} Ticket${importRows.length === 1 ? '' : 's'}`}
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
                  <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>{importRows.length} ticket{importRows.length === 1 ? '' : 's'} were added.</div>
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
