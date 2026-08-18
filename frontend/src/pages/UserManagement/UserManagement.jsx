import { useState, useEffect, useRef, useMemo } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { logActivity } from '../../hooks/useActivityLog'

const STATUSES = ['Active', 'Inactive']
const STATUS_META = {
  Active:   { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Inactive: { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
}

const ROLE_META = {
  Administrator: { bg: '#eef2ff', text: '#4338ca' },
  Operator:      { bg: '#ecfeff', text: '#0e7490' },
  Viewer:        { bg: '#f1f5f9', text: '#475569' },
}
const ROLE_FALLBACK = { bg: '#fdf4ff', text: '#a21caf' }
const roleStyle = name => ROLE_META[name] || ROLE_FALLBACK

const EXPORT_FIELDS = ['name', 'email', 'role', 'department', 'phone', 'status']

const EMPTY_FORM = { name: '', email: '', role: '', department: '', phone: '', status: 'Active' }

const DATE_FILTERS = [
  { value: 'All', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

function matchesDateFilter(u, filterDate) {
  if (filterDate === 'All') return true
  const t = u.createdAt?.toDate?.().getTime()
  if (!t) return false
  return t >= Date.now() - Number(filterDate) * 86400000
}

function matchesDateRange(u, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true
  const t = u.createdAt?.toDate?.().getTime()
  if (!t) return false
  if (dateFrom && t < new Date(`${dateFrom}T00:00:00`).getTime()) return false
  if (dateTo && t > new Date(`${dateTo}T23:59:59.999`).getTime()) return false
  return true
}

function formatDate(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name || '').slice(0, 2).toUpperCase() || '??'
}

const AVATAR_COLORS = [
  { bg: '#e0ecff', color: '#1d4ed8' }, { bg: '#dcfce7', color: '#15803d' },
  { bg: '#fef3c7', color: '#b45309' }, { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#cffafe', color: '#0e7490' }, { bg: '#ffe4e6', color: '#be123c' },
]
function avatarColor(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
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

// Real week-over-week trend from each user's createdAt — added-this-week vs
// added-the-week-before, not a fabricated number.
function trendFor(users, matches) {
  const WEEK = 7 * 86400000
  const now = Date.now()
  const addedAt = u => u.createdAt?.toDate?.().getTime()
  const curr = users.filter(u => matches(u) && addedAt(u) >= now - WEEK && addedAt(u) < now).length
  const prev = users.filter(u => matches(u) && addedAt(u) >= now - 2 * WEEK && addedAt(u) < now - WEEK).length
  if (curr === 0 && prev === 0) return { dir: 'flat', label: 'No change this week' }
  if (prev === 0) return { dir: 'up', label: `+${curr} new this week` }
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return { dir: 'flat', label: 'No change vs last week' }
  return { dir: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : ''}${pct}% vs last week` }
}

function computeTrends(users) {
  return {
    total: trendFor(users, () => true),
    active: trendFor(users, u => u.status === 'Active'),
    inactive: trendFor(users, u => u.status === 'Inactive'),
    admins: trendFor(users, u => u.role === 'Administrator'),
  }
}

function sparkPoints(users, matches, days = 14) {
  const DAY = 86400000
  const now = Date.now()
  const dayStart = now - (days - 1) * DAY
  const addedAt = u => u.createdAt?.toDate?.().getTime()
  const counts = []
  for (let i = 0; i < days; i++) {
    const cutoff = dayStart + i * DAY + DAY
    counts.push(users.filter(u => matches(u) && addedAt(u) && addedAt(u) < cutoff).length)
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

function computeSparks(users) {
  return {
    total: sparkPoints(users, () => true),
    active: sparkPoints(users, u => u.status === 'Active'),
    inactive: sparkPoints(users, u => u.status === 'Inactive'),
    admins: sparkPoints(users, u => u.role === 'Administrator'),
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

const IMPORT_HEADER_ALIASES = {
  name: 'name', email: 'email', role: 'role', department: 'department', phone: 'phone', status: 'status',
}

function sanitizeRow(raw) {
  const row = { name: '', email: '', role: '', department: '', phone: '', status: 'Active' }
  EXPORT_FIELDS.forEach(f => { if (raw[f]) row[f] = String(raw[f]) })
  if (!STATUSES.includes(row.status)) row.status = 'Active'
  return row
}

function parseUserCsv(text) {
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

function parseUserJson(text) {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : [data]
  return list.map(sanitizeRow).filter(row => row.name)
}

function parseUserFile(filename, text) {
  return filename.toLowerCase().endsWith('.json') ? parseUserJson(text) : parseUserCsv(text)
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
  pdf.text('Users', marginX, y)
  y += 24
  pdf.setFontSize(9)
  rows.forEach(r => {
    if (y > 780) { pdf.addPage(); y = 50 }
    pdf.setFont(undefined, 'bold')
    pdf.text(r.name || '—', marginX, y)
    pdf.setFont(undefined, 'normal')
    pdf.text(`${r.email || '—'}  ·  ${r.role || '—'}  ·  ${r.department || '—'}  ·  ${r.status || '—'}`, marginX, y + 12)
    y += 28
  })
  pdf.save(filename)
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
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
  const [filterRole, setFilterRole] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterDate, setFilterDate] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState('table') // table | grid
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const [showRoles, setShowRoles] = useState(false)
  const [newRole, setNewRole] = useState('')
  const [roleSaving, setRoleSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)

  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState('upload')
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
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'userRoles'), orderBy('name'))
    const unsub = onSnapshot(q, snap => {
      setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'Active').length,
    inactive: users.filter(u => u.status === 'Inactive').length,
    admins: users.filter(u => u.role === 'Administrator').length,
  }), [users])

  const trends = useMemo(() => computeTrends(users), [users])
  const sparks = useMemo(() => computeSparks(users), [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      if (filterRole !== 'All' && u.role !== filterRole) return false
      if (filterStatus !== 'All' && u.status !== filterStatus) return false
      if (!matchesDateFilter(u, filterDate)) return false
      if (!matchesDateRange(u, dateFrom, dateTo)) return false
      if (q && !`${u.name} ${u.email} ${u.department}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, search, filterRole, filterStatus, filterDate, dateFrom, dateTo])

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

  const detail = detailId ? users.find(u => u.id === detailId) : null
  const roleNames = roles.length > 0 ? roles.map(r => r.name) : Object.keys(ROLE_META)

  function openAdd() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, role: roleNames[0] || '' })
    setFormErrors({})
    setShowForm(true)
  }

  function openEdit(u) {
    setEditingId(u.id)
    setForm({ ...EMPTY_FORM, ...u })
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  function openView(u) {
    setDetailId(u.id)
    setView('detail')
  }

  function backToList() {
    setView('list')
    setDetailId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.name.trim()) errors.name = true
    if (!form.email.trim()) errors.email = true
    if (!form.role.trim()) errors.role = true
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, name: form.name.trim(), email: form.email.trim() }
      if (editingId) {
        await updateDoc(doc(db, 'users', editingId), payload)
        logActivity({ action: 'UPDATE_USER', category: 'Users', summary: `Updated user: ${payload.name}` })
      } else {
        await addDoc(collection(db, 'users'), { ...payload, createdAt: serverTimestamp() })
        logActivity({ action: 'CREATE_USER', category: 'Users', summary: `Added user: ${payload.name}` })
      }
      closeForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'users', deleteTarget.id))
      logActivity({ action: 'DELETE_USER', category: 'Users', summary: `Deleted user: ${deleteTarget.name}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleAddRole(e) {
    e.preventDefault()
    const name = newRole.trim()
    if (!name) return
    if (roles.some(r => r.name.toLowerCase() === name.toLowerCase())) { setNewRole(''); return }
    setRoleSaving(true)
    try {
      await addDoc(collection(db, 'userRoles'), { name, createdAt: serverTimestamp() })
      logActivity({ action: 'CREATE_ROLE', category: 'Users', summary: `Added role: ${name}` })
      setNewRole('')
    } catch (err) {
      setError(err.message)
    } finally {
      setRoleSaving(false)
    }
  }

  async function handleDeleteRole(role, count) {
    if (count > 0) return
    try {
      await deleteDoc(doc(db, 'userRoles', role.id))
      logActivity({ action: 'DELETE_ROLE', category: 'Users', summary: `Deleted role: ${role.name}` })
    } catch (err) {
      setError(err.message)
    }
  }

  function handleExport(format) {
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'json') exportJson(`users-${stamp}.json`, filtered)
    else if (format === 'pdf') exportPdf(`users-${stamp}.pdf`, filtered)
    else exportCsv(`users-${stamp}.csv`, filtered)
    logActivity({ action: 'EXPORT_USERS', category: 'Users', summary: `Exported ${filtered.length} users to ${format.toUpperCase()}` })
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
        setImportRows(parseUserFile(file.name, String(reader.result || '')))
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
        await addDoc(collection(db, 'users'), { ...row, createdAt: serverTimestamp() })
      }
      logActivity({ action: 'IMPORT_USERS', category: 'Users', summary: `Imported ${importRows.length} users from ${importFileName}` })
      setImportStep('done')
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const rolesWithCount = roles.map(r => ({ ...r, count: users.filter(u => u.role === r.name).length }))

  return (
    <AppShell>
      <div className="page">
        {view === 'list' ? (
          <>
            <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
              <div>
                <div className="crumbs"><span>Home</span><span>›</span><span>User Management</span></div>
                <h1>User Management</h1>
              </div>
              <div className="page-head__actions">
                <button className="btn" onClick={() => setShowRoles(s => !s)}>Manage Roles</button>
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
                <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={openAdd}>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  Add User
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>TOTAL USERS</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2"><circle cx="9" cy="8" r="4" /><path d="M3 21a6 6 0 0 1 12 0M16 3.13a4 4 0 0 1 0 7.75M21 21a6 6 0 0 0-3.5-5.45" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{counts.total}</div>
                  <Spark points={sparks.total} color="#4338ca" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.total} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Across {roles.length} roles</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>ACTIVE</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{counts.active}</div>
                  <Spark points={sparks.active} color="#15803d" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.active} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{counts.total ? Math.round((counts.active / counts.total) * 100) : 0}% of total</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>INACTIVE</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2"><circle cx="9" cy="8" r="4" /><path d="M3 21a6 6 0 0 1 12 0" /><line x1="17" y1="8" x2="22" y2="13" /><line x1="22" y1="8" x2="17" y2="13" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#b91c1c' }}>{counts.inactive}</div>
                  <Spark points={sparks.inactive} color="#b91c1c" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.inactive} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>May need review</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>ADMINISTRATORS</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7z" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>{counts.admins}</div>
                  <Spark points={sparks.admins} color="#7c3aed" />
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.admins} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Full access accounts</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 16px', marginBottom: 18, marginLeft: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 9, padding: '9px 12px', minWidth: 220, flex: 1, maxWidth: 280 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search name, email, department…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--ink-900)' }}
                />
              </div>
              <select className="form-input" style={{ width: 'auto' }} value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1) }}>
                <option value="All">All roles</option>
                {roleNames.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
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
                  <button type="button" className="btn btn--sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}>Clear</button>
                )}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{filtered.length} users</div>
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

            {showRoles && (
              <div className="card" style={{ marginBottom: 20, maxWidth: 480, marginLeft: 5 }}>
                <div className="card__head"><h3>Manage Roles</h3></div>
                <div className="card__body">
                  <form onSubmit={handleAddRole} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <input className="form-input" value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="New role name" />
                    <button type="submit" className="btn btn--primary" disabled={roleSaving} style={{ flexShrink: 0 }}>
                      {roleSaving ? 'Adding…' : 'Add'}
                    </button>
                  </form>
                  {rolesWithCount.length === 0 ? (
                    <div style={{ color: 'var(--ink-500)', fontSize: 13 }}>No roles yet — using built-in defaults until you add some.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rolesWithCount.map(r => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--ink-200)', borderRadius: 8, padding: '8px 12px' }}>
                          <span style={{ fontSize: 13.5 }}>{r.name} <span style={{ color: 'var(--ink-500)', fontSize: 12 }}>· {r.count} users</span></span>
                          <button className="btn btn--danger btn--sm" disabled={r.count > 0} onClick={() => handleDeleteRole(r, r.count)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

            {loading ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading users…</div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No users found</div>
                <div style={{ fontSize: 13 }}>{users.length === 0 ? 'Click "Add User" to register your first one.' : 'No users match your filters.'}</div>
              </div>
            ) : viewMode === 'table' ? (
              <div className="card" style={{ marginLeft: 5 }}>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>Date Added</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(u => {
                        const rs = roleStyle(u.role)
                        const ss = STATUS_META[u.status] || STATUS_META.Active
                        const ac = avatarColor(u.email || u.id)
                        return (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openView(u)}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: ac.bg, color: ac.color, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initialsOf(u.name)}</div>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><span style={{ background: rs.bg, color: rs.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{u.role || '—'}</span></td>
                            <td>{u.department || '—'}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{u.status}
                              </span>
                            </td>
                            <td>{formatDate(u.createdAt)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <IconBtn title="View" onClick={() => openView(u)}><ViewIcon /></IconBtn>
                                <IconBtn title="Edit" onClick={() => openEdit(u)}><EditIcon /></IconBtn>
                                <IconBtn title="Delete" danger onClick={() => setDeleteTarget(u)}><DeleteIcon /></IconBtn>
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
                {pageItems.map(u => {
                  const rs = roleStyle(u.role)
                  const ss = STATUS_META[u.status] || STATUS_META.Active
                  const ac = avatarColor(u.email || u.id)
                  return (
                    <div key={u.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ background: rs.bg, color: rs.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{u.role || '—'}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{u.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openView(u)}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: ac.bg, color: ac.color, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initialsOf(u.name)}</div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{u.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{u.department || '—'}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, borderTop: '1px solid var(--ink-200)', paddingTop: 12 }}>
                        <IconBtn full title="View" onClick={() => openView(u)}><ViewIcon /></IconBtn>
                        <IconBtn full title="Edit" onClick={() => openEdit(u)}><EditIcon /></IconBtn>
                        <IconBtn full title="Delete" danger onClick={() => setDeleteTarget(u)}><DeleteIcon /></IconBtn>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to User Management
            </div>
            <div className="card" style={{ padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {(() => {
                  const ac = avatarColor(detail.email || detail.id)
                  return <div style={{ width: 48, height: 48, borderRadius: 12, background: ac.bg, color: ac.color, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initialsOf(detail.name)}</div>
                })()}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{detail.name}</h1>
                    {(() => {
                      const ss = STATUS_META[detail.status] || STATUS_META.Active
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{detail.status}
                        </span>
                      )
                    })()}
                    {(() => {
                      const rs = roleStyle(detail.role)
                      return <span style={{ background: rs.bg, color: rs.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{detail.role || '—'}</span>
                    })()}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{detail.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => openEdit(detail)}>Edit</button>
                <button className="btn btn--danger" onClick={() => setDeleteTarget(detail)}>Delete</button>
              </div>
            </div>

            <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>Department</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{detail.department || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>Phone</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{detail.phone || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>Date Added</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(detail.createdAt)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
            <div style={{ marginBottom: 12 }}>This user no longer exists.</div>
            <button className="btn btn--primary" onClick={backToList}>Back to User Management</button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal__head">
              <h3>{editingId ? `Edit User: ${form.name}` : 'Add User'}</h3>
              <button className="modal__close" onClick={closeForm} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="modal__body">
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      className="form-input"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Diane Mukamana"
                      style={formErrors.name ? { borderColor: '#dc2626' } : undefined}
                    />
                    {formErrors.name && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Name is required</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      className="form-input" type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="e.g. diane@company.com"
                      style={formErrors.email ? { borderColor: '#dc2626' } : undefined}
                    />
                    {formErrors.email && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Email is required</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-input"
                      value={form.role}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                      style={formErrors.role ? { borderColor: '#dc2626' } : undefined}
                    >
                      <option value="">Select role…</option>
                      {roleNames.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {formErrors.role && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Role is required</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      className="form-input"
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                      placeholder="e.g. Network Operations"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="e.g. 0788123456"
                    />
                  </div>
                </div>

                {error && <div className="settings-error" style={{ marginBottom: 14 }}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn" onClick={closeForm}>Cancel</button>
                  <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add User'}
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
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete "{deleteTarget.name}"?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This action can't be undone. The user account will be permanently removed.</div>
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
              <h3>Import Users</h3>
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
                    <div style={{ marginTop: 4 }}>CSV columns: name, email, role, department, phone, status — or a JSON array of users</div>
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
                    Detected {importRows.length} user{importRows.length === 1 ? '' : 's'} in <strong>{importFileName}</strong>:
                  </div>
                  <div style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden', marginBottom: 18, maxHeight: 240, overflowY: 'auto' }}>
                    {importRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--ink-100)', fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{row.name}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{row.role || '—'}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{row.email || '—'}</span>
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
                      {importing ? 'Importing…' : `Import ${importRows.length} User${importRows.length === 1 ? '' : 's'}`}
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
                  <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>{importRows.length} user{importRows.length === 1 ? '' : 's'} were added.</div>
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
