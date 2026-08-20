import { useState, useCallback, useMemo } from 'react'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { today, monthStart } from '../Reports/ReportLayout'
import { exportToCSV, exportToExcel, exportToPdf } from '../../utils/exportUtils'

// ── Icons ──────────────────────────────────────────────────────────────────
const IcoServer   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="7" rx="1.5"/><rect x="2" y="14" width="20" height="7" rx="1.5"/><line x1="6" y1="6.5" x2="6.01" y2="6.5" strokeLinecap="round"/><line x1="6" y1="17.5" x2="6.01" y2="17.5" strokeLinecap="round"/></svg>
const IcoStorage  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12a9 3 0 0 0 18 0" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoNetwork  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2 2 7l10 5 10-5-10-5Z" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoAlert    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round"/></svg>
const IcoPdf      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoExcel    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoCsv      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M9 13h.01M12 13h.01M15 13h.01M9 17h6" strokeLinecap="round" strokeLinejoin="round"/></svg>

function fmtDate(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return isNaN(d) ? '—' : d.toLocaleString()
}

function inRange(ts, from, to) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null
  if (!d || isNaN(d)) return false
  const key = d.toISOString().slice(0, 10)
  return key >= from && key <= to
}

async function fetchCollection(name) {
  const snap = await getDocs(query(collection(db, name), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

const REPORT_TYPES = [
  {
    id: 'servers', label: 'Server Report', icon: <IcoServer />,
    desc: 'Inventory and live health of every registered server.',
    dateLabel: 'Registered Between',
    searchFields: ['name', 'ip', 'hostname', 'provider', 'environment', 'status'],
    columns: [
      { key: 'name', label: 'Server' },
      { key: 'ip', label: 'IP Address' },
      { key: 'provider', label: 'Provider' },
      { key: 'environment', label: 'Environment' },
      { key: 'status', label: 'Status' },
      { key: 'cpuUsage', label: 'CPU %' },
      { key: 'ram', label: 'RAM (Used/Total GB)', get: r => `${r.ramUsedGb ?? 0} / ${r.ramTotalGb ?? 0}` },
      { key: 'storage', label: 'Storage (Used/Total GB)', get: r => `${r.storageUsedGb ?? 0} / ${r.storageTotalGb ?? 0}` },
      { key: 'uptimeDays', label: 'Uptime (Days)' },
      { key: 'createdAt', label: 'Registered At', get: r => fmtDate(r.createdAt) },
    ],
    fetchRows: async (from, to) => {
      const rows = await fetchCollection('servers')
      return rows.filter(r => inRange(r.createdAt, from, to))
    },
  },
  {
    id: 'storage', label: 'Storage Report', icon: <IcoStorage />,
    desc: 'Capacity and status of every managed storage device.',
    dateLabel: 'Registered Between',
    searchFields: ['name', 'type', 'provider', 'ip', 'status'],
    columns: [
      { key: 'name', label: 'Device' },
      { key: 'type', label: 'Type' },
      { key: 'provider', label: 'Provider' },
      { key: 'ip', label: 'IP Address' },
      { key: 'capacity', label: 'Capacity (Used/Total GB)', get: r => `${r.capacityUsedGb ?? 0} / ${r.capacityTotalGb ?? 0}` },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Registered At', get: r => fmtDate(r.createdAt) },
    ],
    fetchRows: async (from, to) => {
      const rows = await fetchCollection('storageDevices')
      return rows.filter(r => inRange(r.createdAt, from, to))
    },
  },
  {
    id: 'network', label: 'Network Report', icon: <IcoNetwork />,
    desc: 'Inventory and status of switches, routers, and network gear.',
    dateLabel: 'Registered Between',
    searchFields: ['name', 'type', 'manufacturer', 'model', 'ip', 'status'],
    columns: [
      { key: 'name', label: 'Device' },
      { key: 'type', label: 'Type' },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'model', label: 'Model' },
      { key: 'ip', label: 'IP Address' },
      { key: 'portCount', label: 'Ports' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Registered At', get: r => fmtDate(r.createdAt) },
    ],
    fetchRows: async (from, to) => {
      const rows = await fetchCollection('networkDevices')
      return rows.filter(r => inRange(r.createdAt, from, to))
    },
  },
  {
    id: 'alerts', label: 'Alerts Report', icon: <IcoAlert />,
    desc: 'System alerts raised across all devices in a chosen date range.',
    dateLabel: 'Raised Between',
    searchFields: ['title', 'device', 'severity', 'message'],
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'device', label: 'Device' },
      { key: 'severity', label: 'Severity' },
      { key: 'message', label: 'Message' },
      { key: 'ack', label: 'Acknowledged', get: r => (r.ack ? 'Yes' : 'No') },
      { key: 'createdAt', label: 'Raised At', get: r => fmtDate(r.createdAt) },
    ],
    fetchRows: async (from, to) => {
      const rows = await fetchCollection('alerts')
      return rows.filter(r => inRange(r.createdAt, from, to))
    },
  },
]

export default function ReportManagement() {
  const [activeId, setActiveId] = useState(REPORT_TYPES[0].id)
  const active = REPORT_TYPES.find(t => t.id === activeId)

  const [from, setFrom] = useState(monthStart())
  const [to, setTo]     = useState(today())
  const [keyword, setKeyword] = useState('')

  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [loaded, setLoaded]   = useState(false)

  const loadRows = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await active.fetchRows(from, to)
      setRows(Array.isArray(data) ? data : [])
      setLoaded(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [active, from, to])

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      active.searchFields.some(f => String(row[f] ?? '').toLowerCase().includes(q))
    )
  }, [rows, keyword, active])

  function selectReport(id) {
    setActiveId(id)
    setRows([]); setLoaded(false); setError(null); setKeyword('')
  }

  function handleDownloadPdf() {
    exportToPdf(filteredRows, active.columns, `${activeId}-report-${today()}.pdf`, active.label)
  }

  function handleDownloadExcel() {
    exportToExcel(filteredRows, active.columns, `${activeId}-report-${today()}.xlsx`, active.label)
  }

  function handleDownloadCsv() {
    exportToCSV(filteredRows, active.columns, `${activeId}-report-${today()}.csv`)
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs">
              <span>Workspace</span>
              <span style={{ margin: '0 8px', opacity: 0.5 }}>/</span>
              <span style={{ color: 'var(--ink-800)', fontWeight: 600 }}>Report Management</span>
            </div>
            <h1>Report Management</h1>
          </div>
        </div>

        {/* ── Segmented control ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ background: 'var(--ink-100)', padding: 4, borderRadius: 12, display: 'inline-flex', gap: 2, border: '1px solid var(--ink-200)' }}>
            {REPORT_TYPES.map(t => (
              <button key={t.id}
                className="btn btn--ghost"
                onClick={() => selectReport(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 20px',
                  fontSize: 13.5, fontWeight: 600, borderRadius: 9,
                  background: activeId === t.id ? '#fff' : 'transparent',
                  color: activeId === t.id ? 'var(--brand-700)' : 'var(--ink-500)',
                  boxShadow: activeId === t.id ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Report card ── */}
        <div className="card" style={{ border: 'none', boxShadow: 'var(--shadow-lg)', borderRadius: 16, overflow: 'hidden' }}>
          <div className="card__head" style={{ padding: '20px 24px', background: 'transparent', borderBottom: '1px solid var(--ink-100)' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>{active.label}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-500)' }}>{active.desc}</p>
            </div>
          </div>

          <div className="card__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={from} max={today()} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" value={to} max={today()} onChange={e => setTo(e.target.value)} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 10 }}>{active.dateLabel}</div>

              <button className="btn btn--primary" style={{ height: 40, borderRadius: 8 }} onClick={loadRows} disabled={loading}>
                {loading ? 'Loading...' : 'Load Report Data'}
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn" style={{ height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDownloadPdf} disabled={!loaded || filteredRows.length === 0}>
                  <IcoPdf /> Download PDF
                </button>
                <button className="btn" style={{ height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDownloadExcel} disabled={!loaded || filteredRows.length === 0}>
                  <IcoExcel /> Download Excel
                </button>
                <button className="btn" style={{ height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDownloadCsv} disabled={!loaded || filteredRows.length === 0}>
                  <IcoCsv /> Download CSV
                </button>
              </div>
            </div>

            {loaded && (
              <div className="field" style={{ background: '#fff', border: '1px solid var(--ink-200)', borderRadius: 10, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, height: 42, maxWidth: 340 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/></svg>
                <input
                  style={{ border: 0, outline: 0, fontSize: 13, width: '100%' }}
                  placeholder="Filter by keyword..."
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />
              </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 10, color: '#be123c', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ overflowX: 'auto', border: '1px solid var(--ink-100)', borderRadius: 12 }}>
              <table className="data">
                <thead>
                  <tr>
                    {active.columns.map(c => <th key={c.key}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {!loaded ? (
                    <tr><td colSpan={active.columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-400)' }}>Click "Load Report Data" to preview this report.</td></tr>
                  ) : filteredRows.length === 0 ? (
                    <tr><td colSpan={active.columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-400)' }}>No records found for the selected criteria.</td></tr>
                  ) : filteredRows.slice(0, 200).map((row, i) => (
                    <tr key={row.id ?? i}>
                      {active.columns.map(c => <td key={c.key}>{(c.get ? c.get(row) : row[c.key]) ?? '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loaded && filteredRows.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                {filteredRows.length > 200
                  ? `Showing first 200 of ${filteredRows.length} matching records in preview. Downloaded files include all ${filteredRows.length}.`
                  : `${filteredRows.length} matching record${filteredRows.length === 1 ? '' : 's'}${keyword.trim() ? ` (filtered from ${rows.length})` : ''}.`}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
