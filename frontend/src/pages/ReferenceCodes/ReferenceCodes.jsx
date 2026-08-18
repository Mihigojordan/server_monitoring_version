import { useState, useCallback, useEffect } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { useApp } from '../../context/AppContext'

function formatDt(raw) {
  if (!raw) return '—'
  const s = String(raw)
  if (s.length !== 14) return s
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`
}

function matchesSearch(cat, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  if ((cat.cdClsNm || '').toLowerCase().includes(needle)) return true
  return (cat.dtlList || []).some(d =>
    (d.cd || '').toLowerCase().includes(needle) || (d.cdNm || '').toLowerCase().includes(needle)
  )
}

export default function ReferenceCodes() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || '00'

  const [categories, setCategories] = useState([])
  const [resultDt,   setResultDt]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [loaded,     setLoaded]     = useState(false)
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await operatorApi.branchCodes(branchId)
      if (res?.resultCd === '000') {
        setCategories(res?.data?.clsList ?? [])
        setResultDt(res?.resultDt ?? null)
      } else if (res?.resultCd === '001') {
        setCategories([])
        setResultDt(res?.resultDt ?? null)
      } else {
        setCategories([])
        setError(`${res?.resultMsg || 'Failed to load reference codes'} (${res?.resultCd || 'unknown'})`)
      }
      setLoaded(true)
    } catch (err) {
      setError(err.message)
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { load() }, [load])

  const visibleCategories = categories.filter(c => matchesSearch(c, search))
  const totalCodes = categories.reduce((acc, c) => acc + (c.dtlList?.length || 0), 0)

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Reference Codes</span></div>
            <h1>RRA Reference Codes</h1>
          </div>
          <button className="btn btn--primary" onClick={load} disabled={loading} style={{ alignSelf: 'flex-start' }}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {loading ? 'Loading…' : 'Load from RRA'}
          </button>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi__label">Categories</div>
            <div className="kpi__value">{categories.length}</div>
            <span className="kpi__sub">from RRA code table</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Total Codes</div>
            <div className="kpi__value">{totalCodes}</div>
            <span className="kpi__sub">across all categories</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Last Loaded</div>
            <div className="kpi__value" style={{ fontSize: 16 }}>{formatDt(resultDt)}</div>
            <span className="kpi__sub">RRA server time</span>
          </div>
        </div>

        <div className="card">
          {!loaded && !loading && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-500)' }}>
              <div style={{ marginBottom: 12, fontSize: 14 }}>Click "Load from RRA" to fetch the reference code tables (tax types, countries, packaging units, etc.)</div>
              <button className="btn btn--primary" onClick={load}>Load Reference Codes</button>
            </div>
          )}

          {loading && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>Loading reference codes…</div>
          )}

          {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}

          {loaded && !loading && !error && categories.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No reference codes returned</div>
              <div style={{ fontSize: 13 }}>RRA did not return any code categories for this branch.</div>
            </div>
          )}

          {loaded && !loading && categories.length > 0 && (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ink-100)' }}>
                <input
                  className="form-input"
                  placeholder="Search by category or code (e.g. Tax Type, RW, B-18.00%)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ maxWidth: 420 }}
                />
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Cls</th>
                      <th>Category</th>
                      <th style={{ width: 100 }}>Codes</th>
                      <th style={{ width: 90 }}>Status</th>
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCategories.map(cat => (
                      <>
                        <tr key={cat.cdCls} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === cat.cdCls ? null : cat.cdCls)}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>{cat.cdCls}</td>
                          <td style={{ fontWeight: 600 }}>{cat.cdClsNm || '—'}</td>
                          <td style={{ fontSize: 13, color: 'var(--ink-500)' }}>{cat.dtlList?.length ?? 0}</td>
                          <td>
                            <span className={`tax-chip`} style={{ background: cat.useYn === 'Y' ? '#dcfce7' : '#fee2e2', color: cat.useYn === 'Y' ? 'var(--ok)' : '#b91c1c' }}>
                              {cat.useYn === 'Y' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <svg
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              width="14" height="14"
                              style={{ transition: 'transform .15s', transform: expanded === cat.cdCls ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--ink-400)' }}
                            >
                              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </td>
                        </tr>
                        {expanded === cat.cdCls && (
                          <tr key={`${cat.cdCls}-detail`}>
                            <td colSpan={5} style={{ background: 'var(--ink-50)', padding: '14px 20px' }}>
                              {(cat.dtlList || []).length === 0 ? (
                                <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>No codes in this category.</div>
                              ) : (
                                <table className="data" style={{ background: 'var(--surface)' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ width: 90 }}>Code</th>
                                      <th>Name</th>
                                      <th>Description</th>
                                      <th style={{ width: 90 }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cat.dtlList.map(d => (
                                      <tr key={d.cd}>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand-700)' }}>{d.cd}</td>
                                        <td>{d.cdNm || '—'}</td>
                                        <td style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{d.cdDesc || '—'}</td>
                                        <td>{d.useYn === 'Y' ? 'Active' : 'Inactive'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {visibleCategories.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
                  No categories match "{search}".
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
