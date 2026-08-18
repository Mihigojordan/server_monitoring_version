import { useState, useEffect, useCallback } from 'react'
import AdminShell from '../../components/layout/AdminShell'
import { getLog, clearLog } from '../../hooks/useActivityLog'

const CATEGORIES = ['All', 'Users', 'Branches', 'Tax', 'Tools', 'Auth', 'System']
const STATUSES   = ['All', 'ok', 'error']

function timeAgo(ts) {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60)   return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  return new Date(ts).toLocaleDateString()
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-RW', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

const CATEGORY_COLORS = {
  Users:    { bg: 'var(--brand-100)',  color: 'var(--brand-700)' },
  Branches: { bg: '#dcfce7',           color: 'var(--ok)' },
  Tax:      { bg: '#fef3c7',           color: '#b45309' },
  Tools:    { bg: '#ede9fe',           color: '#6d28d9' },
  Auth:     { bg: '#fee2e2',           color: 'var(--err)' },
  System:   { bg: 'var(--ink-100)',    color: 'var(--ink-600)' },
}

export default function AdminActivityLog() {
  const [entries,  setEntries]  = useState([])
  const [category, setCategory] = useState('All')
  const [status,   setStatus]   = useState('All')
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)

  const reload = useCallback(() => setEntries(getLog()), [])

  useEffect(() => { reload() }, [reload])

  function handleClear() {
    if (!window.confirm('Clear all activity logs? This cannot be undone.')) return
    clearLog()
    reload()
  }

  function exportCSV() {
    const rows = [
      ['Time', 'Category', 'Action', 'Actor', 'Summary', 'Status', 'Detail'],
      ...filtered.map(e => [
        formatTime(e.ts), e.category, e.action, e.actor,
        `"${e.summary.replace(/"/g, '""')}"`,
        e.status,
        `"${(e.detail || '').replace(/"/g, '""')}"`,
      ]),
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `infra-activity-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = entries.filter(e => {
    if (category !== 'All' && e.category !== category) return false
    if (status   !== 'All' && e.status   !== status)   return false
    if (search) {
      const s = search.toLowerCase()
      if (
        !e.summary.toLowerCase().includes(s) &&
        !e.action.toLowerCase().includes(s)  &&
        !(e.detail || '').toLowerCase().includes(s)
      ) return false
    }
    return true
  })

  const errorCount = entries.filter(e => e.status === 'error').length

  return (
    <AdminShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Admin</span><span>›</span><span>Activity Log</span></div>
            <h1>Activity Log</h1>
          </div>
          <div className="page-head__actions">
            <button className="btn" onClick={exportCSV} disabled={filtered.length === 0}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export CSV
            </button>
            <button className="btn btn--danger" onClick={handleClear} disabled={entries.length === 0}>
              Clear All
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="kpi">
            <div className="kpi__label">Total Events</div>
            <div className="kpi__value">{entries.length}</div>
            <span className="kpi__delta kpi__delta--up">all time</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Errors</div>
            <div className="kpi__value">{errorCount}</div>
            <span className={`kpi__delta kpi__delta--${errorCount > 0 ? 'down' : 'up'}`}>
              {errorCount > 0 ? 'needs review' : 'none'}
            </span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Today</div>
            <div className="kpi__value">
              {entries.filter(e => new Date(e.ts).toDateString() === new Date().toDateString()).length}
            </div>
            <span className="kpi__delta kpi__delta--up">events</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Showing</div>
            <div className="kpi__value">{filtered.length}</div>
            <span className="kpi__sub">of {entries.length}</span>
          </div>
        </div>

        {/* Log table */}
        <div className="card">
          <div className="filterbar">
            <div className="tab-bar">
              {CATEGORIES.map(c => (
                <button key={c} className={category === c ? 'is-active' : ''} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
            <div className="tab-bar" style={{ marginLeft: 8 }}>
              {STATUSES.map(s => (
                <button key={s} className={status === s ? 'is-active' : ''} onClick={() => setStatus(s)}>
                  {s === 'All' ? 'All status' : s === 'ok' ? '✓ OK' : '✕ Error'}
                </button>
              ))}
            </div>
            <div className="field">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/>
              </svg>
              <input
                placeholder="Search actions, summaries…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn--sm btn--ghost" onClick={reload} style={{ marginLeft: 'auto' }}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
          </div>

          <div className="table-wrap">
            {filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ink-500)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: .3, marginBottom: 12 }}>
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontSize: 14, fontWeight: 600 }}>No log entries</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Actions performed in the admin console will appear here.</div>
              </div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 160 }}>Time</th>
                    <th style={{ width: 100 }}>Category</th>
                    <th style={{ width: 180 }}>Action</th>
                    <th>Summary</th>
                    <th style={{ width: 80 }}>Status</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const catStyle = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.System
                    const isOpen   = expanded === e.id
                    return (
                      <>
                        <tr
                          key={e.id}
                          style={{ cursor: e.detail ? 'pointer' : 'default' }}
                          onClick={() => e.detail && setExpanded(isOpen ? null : e.id)}
                        >
                          <td style={{ fontSize: 12, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>
                            <div>{formatTime(e.ts)}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>{timeAgo(e.ts)}</div>
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 5,
                              fontSize: 11.5, fontWeight: 700,
                              background: catStyle.bg, color: catStyle.color,
                            }}>
                              {e.category}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-700)' }}>
                              {e.action}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--ink-800)' }}>{e.summary}</td>
                          <td>
                            {e.status === 'ok'
                              ? <span className="chip chip--ok">OK</span>
                              : <span className="chip chip--err">Error</span>
                            }
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--ink-400)' }}>
                            {e.detail && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </td>
                        </tr>
                        {isOpen && e.detail && (
                          <tr key={`${e.id}-detail`}>
                            <td colSpan={6} style={{ padding: '0 16px 12px', background: 'var(--ink-50)' }}>
                              <pre style={{
                                margin: 0, padding: '10px 14px', borderRadius: 7,
                                background: 'var(--ink-100)', fontSize: 12,
                                fontFamily: 'var(--font-mono)', color: 'var(--ink-700)',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                              }}>
                                {e.detail}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
