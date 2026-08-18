import { useState, useCallback, useEffect } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'

function formatDate(raw) {
  if (!raw) return '—'
  const s = String(raw)
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s
}

export default function Notices() {
  const [notices,    setNotices]    = useState([])
  const [meta,       setMeta]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [newCount,   setNewCount]   = useState(null)
  const [expanded,   setExpanded]   = useState(null)
  const [loaded,     setLoaded]     = useState(false)

  const load = useCallback(async (page = 1) => {
    setLoading(true); setError(null)
    try {
      const res = await operatorApi.notices(page)
      setNotices(res?.notices?.data ?? [])
      setMeta(res?.notices?.meta ?? null)
      if (!loaded) {
        setNewCount(res?.noticeCount ?? 0)
        setLoaded(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false) }
  }, [loaded])

  useEffect(() => { load(1) }, [])

  async function handleSync() {
    setLoaded(false)
    setNewCount(null)
    await load(1)
  }

  const total       = meta?.total ?? notices.length
  const currentPage = meta?.currentPage ?? 1
  const totalPages  = meta ? (meta.lastPage ?? Math.ceil(meta.total / 10)) : 1

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Notices</span></div>
            <h1>RRA Notices</h1>
          </div>
          <button className="btn btn--primary" onClick={handleSync} disabled={loading} style={{ alignSelf: 'flex-start' }}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {loading ? 'Syncing…' : 'Sync from RRA'}
          </button>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi__label">Total Notices</div>
            <div className="kpi__value">{total}</div>
            <span className="kpi__sub">stored locally</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">New on Last Sync</div>
            <div className="kpi__value">{newCount ?? '—'}</div>
            <span className="kpi__sub">{newCount === null ? 'sync to update' : 'from RRA'}</span>
          </div>
        </div>

        <div className="card">
          {!loaded && !loading && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-500)' }}>
              <div style={{ marginBottom: 12, fontSize: 14 }}>Click "Sync from RRA" to load notices</div>
              <button className="btn btn--primary" onClick={() => load(1)}>Load Notices</button>
            </div>
          )}

          {loading && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>Syncing notices…</div>
          )}

          {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}

          {loaded && !loading && notices.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No notices</div>
              <div style={{ fontSize: 13 }}>RRA has not published any notices for your branch.</div>
            </div>
          )}

          {loaded && !loading && notices.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>#</th>
                    <th>Title</th>
                    <th>Issued by</th>
                    <th>Date</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {notices.map(n => (
                    <>
                      <tr key={n.noticeNo} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === n.noticeNo ? null : n.noticeNo)}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>{n.noticeNo}</td>
                        <td style={{ fontWeight: 600 }}>{n.title || '—'}</td>
                        <td style={{ fontSize: 13, color: 'var(--ink-500)' }}>{n.registrarName || '—'}</td>
                        <td style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{formatDate(n.registeredAt)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <svg
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            width="14" height="14"
                            style={{ transition: 'transform .15s', transform: expanded === n.noticeNo ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--ink-400)' }}
                          >
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </td>
                      </tr>
                      {expanded === n.noticeNo && (
                        <tr key={`${n.noticeNo}-detail`}>
                          <td colSpan={5} style={{ background: 'var(--ink-50)', padding: '14px 20px' }}>
                            <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-800)', whiteSpace: 'pre-wrap', marginBottom: n.detailUrl ? 10 : 0 }}>
                              {n.content || 'No content.'}
                            </div>
                            {n.detailUrl && (
                              <a href={n.detailUrl} target="_blank" rel="noreferrer"
                                style={{ fontSize: 12.5, color: 'var(--brand-600)', textDecoration: 'underline' }}
                                onClick={e => e.stopPropagation()}>
                                View full notice ↗
                              </a>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loaded && !loading && totalPages > 1 && (
            <div className="pagination">
              <span>Showing {((currentPage - 1) * 10) + 1}–{Math.min(currentPage * 10, total)} of {total}</span>
              <div className="pages">
                <button onClick={() => load(currentPage - 1)} disabled={currentPage <= 1}>‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={p === currentPage ? 'is-active' : ''} onClick={() => load(p)}>{p}</button>
                ))}
                <button onClick={() => load(currentPage + 1)} disabled={currentPage >= totalPages}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
