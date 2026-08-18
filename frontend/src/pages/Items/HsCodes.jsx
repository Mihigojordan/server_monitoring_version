import { useState, useEffect, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'

const TAX_LABEL  = { A: 'A Exempt', B: 'B 18%', C: 'C Zero', D: 'D Non-VAT' }
const TAX_COLORS = { A: 'tax-A',    B: 'tax-B',  C: 'tax-C',  D: 'tax-D' }

const IcoRefresh = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
const IcoSearch  = () => <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/></svg>

export default function HsCodes() {
  const [codesSearch,  setCodesSearch]  = useState('')
  const [codesInput,   setCodesInput]   = useState('')
  const [codesTax,     setCodesTax]     = useState('')
  const [codesList,    setCodesList]    = useState([])
  const [codesMeta,    setCodesMeta]    = useState(null)
  const [codesLoading, setCodesLoading] = useState(false)
  const [syncStatus,   setSyncStatus]   = useState('idle')
  const [syncCount,    setSyncCount]    = useState(null)

  const loadCodes = useCallback(async (p = 1) => {
    setCodesLoading(true)
    try {
      const res = await operatorApi.searchClassificationCodes(
        codesSearch.trim(),
        { page: p, perPage: 20, taxType: codesTax }
      )
      const data = res?.data ?? res ?? []
      setCodesList(Array.isArray(data) ? data : [])
      setCodesMeta(res?.meta ?? null)
    } catch { setCodesList([]) }
    finally { setCodesLoading(false) }
  }, [codesSearch, codesTax])

  useEffect(() => { loadCodes(1) }, [loadCodes])

  async function handleSyncCodes() {
    setSyncStatus('loading')
    try {
      const count = await operatorApi.syncClassificationCodes()
      setSyncCount(count)
      setSyncStatus('done')
      loadCodes(1)
    } catch {
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 3000)
    }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Items Management</span><span>›</span><span>HS Code</span></div>
            <h1>HS Classification Codes</h1>
          </div>
        </div>

        <div className="card">
          {/* toolbar */}
          <div className="filterbar">
            <div className="field" style={{ flex: 1 }}>
              <IcoSearch />
              <input
                placeholder="Search by code or name (e.g. 5020230101 or Mineral Water)…"
                value={codesInput}
                onChange={e => setCodesInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setCodesSearch(codesInput) }}
              />
              {codesInput && codesInput !== codesSearch && (
                <button className="btn btn--sm btn--primary" style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                  onClick={() => setCodesSearch(codesInput)}>Go</button>
              )}
              {codesSearch && (
                <button className="btn btn--sm" style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                  onClick={() => { setCodesSearch(''); setCodesInput('') }}>✕ Clear</button>
              )}
            </div>
            <div className="field">
              <select value={codesTax} onChange={e => setCodesTax(e.target.value)} style={{ minWidth: 120 }}>
                <option value="">All Tax Types</option>
                <option value="A">A · Exempt (0%)</option>
                <option value="B">B · VAT 18%</option>
                <option value="C">C · Zero-rated</option>
                <option value="D">D · Non-VAT</option>
              </select>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {syncStatus === 'done' && (
                <span className="chip chip--ok" style={{ fontSize: 12 }}>
                  ✓ {syncCount > 0 ? `${syncCount} codes updated` : 'Up to date'}
                </span>
              )}
              <button
                className="btn btn--sm"
                onClick={handleSyncCodes}
                disabled={syncStatus === 'loading'}
                title="Pull latest codes from RRA EBM server"
              >
                {syncStatus === 'loading'
                  ? <><svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg> Syncing…</>
                  : <><IcoRefresh /> Sync from RRA</>
                }
              </button>
            </div>
          </div>

          {/* table */}
          {codesLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>Loading codes…</div>
          ) : codesList.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-500)' }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink-700)', marginBottom: 6 }}>
                {codesSearch ? `No codes matching "${codesSearch}"` : 'No classification codes found'}
              </div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>
                {codesSearch ? 'Try a different search term.' : 'Run "Sync from RRA" to pull the latest codes from the EBM server.'}
              </div>
              <button className="btn btn--primary btn--sm" onClick={handleSyncCodes} disabled={syncStatus === 'loading'}>
                {syncStatus === 'loading' ? 'Syncing…' : 'Sync from RRA'}
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Code</th>
                    <th>Name</th>
                    <th style={{ width: 60 }}>Level</th>
                    <th style={{ width: 100 }}>Tax Type</th>
                    <th style={{ width: 80 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {codesList.map((c, i) => (
                    <tr key={c.code || i}
                      style={{ opacity: c.used === 'N' ? 0.45 : 1 }}
                      title={c.used === 'N' ? 'This code is disabled by RRA' : ''}
                    >
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--brand-700)', fontWeight: 600 }}>
                          {c.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: c.level <= 2 ? 600 : 400, paddingLeft: c.level > 2 ? `${(c.level - 2) * 14}px` : undefined }}>
                        {c.level > 2 && <span style={{ color: 'var(--ink-300)', marginRight: 6 }}>{'└'}</span>}
                        {c.name}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>
                          L{c.level}
                        </span>
                      </td>
                      <td>
                        {c.taxType
                          ? <span className={`tax-chip ${TAX_COLORS[c.taxType] || ''}`}>{TAX_LABEL[c.taxType] || c.taxType}</span>
                          : <span style={{ color: 'var(--ink-400)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td>
                        {c.used === 'Y'
                          ? <span className="chip chip--ok" style={{ fontSize: 11 }}>Active</span>
                          : <span className="chip chip--err" style={{ fontSize: 11 }}>Disabled</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* pagination */}
          {!codesLoading && codesMeta && codesMeta.lastPage > 1 && (
            <div className="pagination">
              <span>
                Showing {((codesMeta.currentPage - 1) * 20) + 1}–{Math.min(codesMeta.currentPage * 20, codesMeta.total)} of {codesMeta.total} codes
              </span>
              <div className="pages">
                <button disabled={codesMeta.currentPage <= 1} onClick={() => loadCodes(codesMeta.currentPage - 1)}>‹</button>
                <button disabled={codesMeta.currentPage >= codesMeta.lastPage} onClick={() => loadCodes(codesMeta.currentPage + 1)}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
