import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { jsPDF } from 'jspdf'
import AppShell from '../../components/layout/AppShell'
import { getLog, clearLog } from '../../hooks/useActivityLog'

const STATUSES = ['ok', 'error']
const STATUS_META = {
  ok:    { bg: '#dcfce7', text: '#15803d', dot: '#22c55e', label: 'OK' },
  error: { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444', label: 'Error' },
}

const CATEGORY_META = {
  Users:     { bg: '#eef2ff', text: '#4338ca' },
  Resources: { bg: '#ecfeff', text: '#0e7490' },
  Alerts:    { bg: '#fdf4ff', text: '#a21caf' },
  Auth:      { bg: '#fee2e2', text: '#b91c1c' },
  System:    { bg: '#f1f5f9', text: '#475569' },
}
const CATEGORY_FALLBACK = { bg: '#fff7ed', text: '#c2410c' }
const categoryStyle = name => CATEGORY_META[name] || CATEGORY_FALLBACK

const EXPORT_FIELDS = ['action', 'category', 'actor', 'summary', 'status', 'detail']

const DATE_FILTERS = [
  { value: 'All', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

function matchesDateFilter(entry, filterDate) {
  if (filterDate === 'All') return true
  return entry.ts >= Date.now() - Number(filterDate) * 86400000
}

function matchesDateRange(entry, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true
  if (dateFrom && entry.ts < new Date(`${dateFrom}T00:00:00`).getTime()) return false
  if (dateTo && entry.ts > new Date(`${dateTo}T23:59:59.999`).getTime()) return false
  return true
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

// Real week-over-week trend from each log entry's ts — logged-this-week vs
// logged-the-week-before, not a fabricated number.
function trendFor(entries, matches) {
  const WEEK = 7 * 86400000
  const now = Date.now()
  const curr = entries.filter(e => matches(e) && e.ts >= now - WEEK && e.ts < now).length
  const prev = entries.filter(e => matches(e) && e.ts >= now - 2 * WEEK && e.ts < now - WEEK).length
  if (curr === 0 && prev === 0) return { dir: 'flat', label: 'No change this week' }
  if (prev === 0) return { dir: 'up', label: `+${curr} new this week` }
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return { dir: 'flat', label: 'No change vs last week' }
  return { dir: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : ''}${pct}% vs last week` }
}

function computeTrends(entries) {
  return {
    total: trendFor(entries, () => true),
    ok: trendFor(entries, e => e.status === 'ok'),
    error: trendFor(entries, e => e.status === 'error'),
    today: trendFor(entries, () => true),
  }
}

function sparkPoints(entries, matches, days = 14) {
  const DAY = 86400000
  const now = Date.now()
  const dayStart = now - (days - 1) * DAY
  const counts = []
  for (let i = 0; i < days; i++) {
    const cutoff = dayStart + i * DAY + DAY
    counts.push(entries.filter(e => matches(e) && e.ts < cutoff).length)
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

function computeSparks(entries) {
  return {
    total: sparkPoints(entries, () => true),
    ok: sparkPoints(entries, e => e.status === 'ok'),
    error: sparkPoints(entries, e => e.status === 'error'),
  }
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
  const header = ['time', ...EXPORT_FIELDS]
  const csv = [header.join(',')].concat(
    rows.map(r => [formatTime(r.ts), ...EXPORT_FIELDS.map(f => r[f])].map(escape).join(','))
  ).join('\r\n')
  downloadBlob(filename, csv, 'text/csv;charset=utf-8;')
}

function exportJson(filename, rows) {
  const data = rows.map(r => ({ time: formatTime(r.ts), ...Object.fromEntries(EXPORT_FIELDS.map(f => [f, r[f] || ''])) }))
  downloadBlob(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;')
}

function exportPdf(filename, rows) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 40
  let y = 50
  pdf.setFontSize(16)
  pdf.text('Activity Log', marginX, y)
  y += 24
  pdf.setFontSize(9)
  rows.forEach(r => {
    if (y > 780) { pdf.addPage(); y = 50 }
    pdf.setFont(undefined, 'bold')
    pdf.text(r.summary || r.action || '—', marginX, y)
    pdf.setFont(undefined, 'normal')
    pdf.text(`${r.category || '—'}  ·  ${r.actor || '—'}  ·  ${(r.status || '—').toUpperCase()}  ·  ${formatTime(r.ts)}`, marginX, y + 12)
    y += 28
  })
  pdf.save(filename)
}

export default function LogManagement() {
  const [entries, setEntries] = useState(() => getLog())

  const [view, setView] = useState('list') // list | detail
  const [detailId, setDetailId] = useState(null)

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterDate, setFilterDate] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState('table') // table | grid
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const reload = useCallback(() => setEntries(getLog()), [])

  useEffect(() => {
    function handler(e) { if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const categoryNames = useMemo(() => [...new Set(entries.map(e => e.category))].filter(Boolean).sort(), [entries])

  const counts = useMemo(() => {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    return {
      total: entries.length,
      ok: entries.filter(e => e.status === 'ok').length,
      error: entries.filter(e => e.status === 'error').length,
      today: entries.filter(e => e.ts >= dayStart.getTime()).length,
    }
  }, [entries])

  const trends = useMemo(() => computeTrends(entries), [entries])
  const sparks = useMemo(() => computeSparks(entries), [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(e => {
      if (filterCategory !== 'All' && e.category !== filterCategory) return false
      if (filterStatus !== 'All' && e.status !== filterStatus) return false
      if (!matchesDateFilter(e, filterDate)) return false
      if (!matchesDateRange(e, dateFrom, dateTo)) return false
      if (q && !`${e.summary} ${e.action} ${e.actor}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, search, filterCategory, filterStatus, filterDate, dateFrom, dateTo])

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

  const detail = detailId ? entries.find(e => e.id === detailId) : null

  function openView(e) {
    setDetailId(e.id)
    setView('detail')
  }

  function backToList() {
    setView('list')
    setDetailId(null)
  }

  function handleExport(format) {
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'json') exportJson(`activity-log-${stamp}.json`, filtered)
    else if (format === 'pdf') exportPdf(`activity-log-${stamp}.pdf`, filtered)
    else exportCsv(`activity-log-${stamp}.csv`, filtered)
    setShowExportMenu(false)
  }

  function handleClear() {
    clearLog()
    reload()
    setConfirmClear(false)
    if (view === 'detail') backToList()
  }

  return (
    <AppShell>
      <div className="page">
        {view === 'list' ? (
          <>
            <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
              <div>
                <div className="crumbs"><span>Home</span><span>›</span><span>Log Audit</span></div>
                <h1>Log Audit</h1>
              </div>
              <div className="page-head__actions">
                <button className="btn btn--danger" onClick={() => setConfirmClear(true)} disabled={entries.length === 0}>Clear Logs</button>
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
                <button className="btn" onClick={reload}>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>TOTAL LOGS</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{counts.total}</div>
                  <svg width="52" height="20" viewBox="0 0 80 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <polyline points={sparks.total} stroke="#4338ca" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.total} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Across {categoryNames.length} categories</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>SUCCESSFUL</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{counts.ok}</div>
                  <svg width="52" height="20" viewBox="0 0 80 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <polyline points={sparks.ok} stroke="#15803d" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.ok} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{counts.total ? Math.round((counts.ok / counts.total) * 100) : 0}% of total</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>ERRORS</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#b91c1c' }}>{counts.error}</div>
                  <svg width="52" height="20" viewBox="0 0 80 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <polyline points={sparks.error} stroke="#b91c1c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ marginTop: 2 }}><TrendChip trend={trends.error} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Needs attention</div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>TODAY</div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>{counts.today}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 8 }}>Logged since midnight</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 16px', marginBottom: 18, marginLeft: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 9, padding: '9px 12px', minWidth: 220, flex: 1, maxWidth: 280 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search summary, action, actor…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--ink-900)' }}
                />
              </div>
              <select className="form-input" style={{ width: 'auto' }} value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}>
                <option value="All">All categories</option>
                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
                <option value="All">All statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
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
              <div style={{ fontSize: 12, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{filtered.length} entries</div>
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

            {filtered.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No log entries found</div>
                <div style={{ fontSize: 13 }}>{entries.length === 0 ? 'Actions you take across the app will appear here.' : 'No entries match your filters.'}</div>
              </div>
            ) : viewMode === 'table' ? (
              <div className="card" style={{ marginLeft: 5 }}>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Summary</th>
                        <th>Category</th>
                        <th>Actor</th>
                        <th>Status</th>
                        <th>When</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map(e => {
                        const cs = categoryStyle(e.category)
                        const ss = STATUS_META[e.status] || STATUS_META.ok
                        return (
                          <tr key={e.id}>
                            <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => openView(e)}>{e.summary}</td>
                            <td><span style={{ background: cs.bg, color: cs.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{e.category || '—'}</span></td>
                            <td>{e.actor || '—'}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{ss.label}
                              </span>
                            </td>
                            <td>{timeAgo(e.ts)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <IconBtn title="View" onClick={() => openView(e)}><ViewIcon /></IconBtn>
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
                {pageItems.map(e => {
                  const cs = categoryStyle(e.category)
                  const ss = STATUS_META[e.status] || STATUS_META.ok
                  return (
                    <div key={e.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ background: cs.bg, color: cs.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{e.category || '—'}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{ss.label}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }} onClick={() => openView(e)}>{e.summary}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{e.actor || '—'} · {timeAgo(e.ts)}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, borderTop: '1px solid var(--ink-200)', paddingTop: 12 }}>
                        <IconBtn full title="View" onClick={() => openView(e)}><ViewIcon /></IconBtn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {filtered.length > 0 && (
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to Log Audit
            </div>
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{detail.summary}</h1>
                {(() => {
                  const ss = STATUS_META[detail.status] || STATUS_META.ok
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ss.bg, color: ss.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />{ss.label}
                    </span>
                  )
                })()}
                {(() => {
                  const cs = categoryStyle(detail.category)
                  return <span style={{ background: cs.bg, color: cs.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{detail.category || '—'}</span>
                })()}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>{detail.actor || '—'} · {formatTime(detail.ts)}</div>
            </div>

            <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>Action</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{detail.action || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>Date</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(detail.ts)}</span>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <span style={{ color: 'var(--ink-500)', fontSize: 13, display: 'block', marginBottom: 6 }}>Detail</span>
                <span style={{ fontSize: 13, color: 'var(--ink-800)' }}>{detail.detail || '—'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
            <div style={{ marginBottom: 12 }}>This log entry no longer exists.</div>
            <button className="btn btn--primary" onClick={backToList}>Back to Log Audit</button>
          </div>
        )}
      </div>

      {confirmClear && (
        <div className="modal-backdrop" onClick={() => setConfirmClear(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Clear all activity logs?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This action can't be undone. All {entries.length} log entries on this device will be permanently removed.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setConfirmClear(false)}>Cancel</button>
                <button className="btn btn--danger" onClick={handleClear}>Clear Logs</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
