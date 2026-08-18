import { useState, useEffect, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import { useApp } from '../../context/AppContext'

// ── Constants ──────────────────────────────────────────────────────────────
const PER_PAGE = 5

const AVATAR_COLORS = [
  { bg: 'var(--brand-100)', color: 'var(--brand-700)' },
  { bg: '#dcfce7',          color: 'var(--ok)' },
  { bg: '#fef3c7',          color: '#b45309' },
  { bg: '#ede9fe',          color: '#6d28d9' },
  { bg: '#cffafe',          color: '#0e7490' },
  { bg: '#ffe4e6',          color: '#be123c' },
]

const EMPTY_FORM = { insuranceName: '', premiumRate: '', used: 'Y' }

// ── Helpers ────────────────────────────────────────────────────────────────
function avatarColor(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function getPageNums(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (cur <= 4)          return [1, 2, 3, 4, 5, '…', total]
  if (cur >= total - 3)  return [1, '…', total-4, total-3, total-2, total-1, total]
  return [1, '…', cur-1, cur, cur+1, '…', total]
}

function exportCSVData(rows) {
  const hdr = ['Insurance Name', 'Insurance Code', 'Premium Rate (%)', 'Branch', 'Status']
  const csv = [hdr, ...rows.map(i => [
    `"${(i.insuranceName||'').replace(/"/g,'""')}"`,
    i.insuranceCode || '',
    i.premiumRate != null ? i.premiumRate : '',
    i.branchId || '',
    i.used === 'Y' ? 'Active' : 'Inactive',
  ])].map(r => r.join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `insurances_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

function printTableData(rows) {
  const hdr = ['Insurance Name', 'Insurance Code', 'Premium Rate (%)', 'Branch', 'Status']
  let html = '<html><head><style>body{font-family:Arial,sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:bold}</style></head><body>'
  html += '<h2>Insurance Partners Report</h2>'
  html += '<table><thead><tr>' + hdr.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
  html += rows.map(i => '<tr><td>' + [
    i.insuranceName||'', i.insuranceCode||'',
    i.premiumRate != null ? i.premiumRate + '%' : '—',
    i.branchId||'', i.used==='Y'?'Active':'Inactive'
  ].join('</td><td>') + '</td></tr>').join('')
  html += '</tbody></table></body></html>'
  const w = window.open('', '', 'width=900,height=600')
  w.document.write(html); w.document.close(); w.print()
}

// ── Icons ──────────────────────────────────────────────────────────────────
const IcoRefresh = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
const IcoPdf     = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#DC2626"/><path d="M44 4v16h16" fill="#B91C1C"/><path d="M22 30h20M22 38h20M22 46h12" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>
const IcoXlsx    = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#16A34A"/><path d="M44 4v16h16" fill="#15803D"/><path d="M22 28h20v24H22z" fill="white" fillOpacity="0.2"/><path d="M22 28h20M22 36h20M22 44h20M22 52h20M22 28v24M32 28v24M42 28v24" stroke="white" strokeWidth="1.5"/></svg>
const IcoCsv     = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#2563EB"/><path d="M44 4v16h16" fill="#1D4ED8"/><path d="M20 32l8 8 16-16" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoPlus    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const IcoSearch  = () => <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/></svg>
const IcoClose   = () => <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>

// ── Main component ─────────────────────────────────────────────────────────
export default function Insurances() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || ''

  const [insurances,   setInsurances]   = useState([])
  const [meta,         setMeta]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Add modal
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [saveErr,   setSaveErr]   = useState(null)
  const [saveOk,    setSaveOk]    = useState(false)

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async (p = 1) => {
    setLoading(true); setError(null)
    try {
      const res = await operatorApi.listInsurances(p, PER_PAGE)
      const data = res?.data ?? res ?? []
      setInsurances(Array.isArray(data) ? data : [])
      setMeta(res?.meta ?? null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(1) }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault(); setSaveErr(null); setSaving(true); setSaveOk(false)
    try {
      await operatorApi.saveInsurance({ ...form, branchId, premiumRate: Number(form.premiumRate) })
      logActivity({ action: 'SAVE_INSURANCE', category: 'System', summary: `Saved insurance "${form.insuranceName}"` })
      setSaveOk(true); setForm(EMPTY_FORM)
      setTimeout(() => { setSaveOk(false); setShowModal(false) }, 1500)
      load(1)
    } catch (err) {
      setSaveErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setSaving(false) }
  }

  async function exportAllData(format) {
    try {
      let all = []
      let page = 1, hasMore = true
      while (hasMore) {
        const res = await operatorApi.listInsurances(page, 50)
        const batch = res?.data ?? []
        all = [...all, ...batch]
        hasMore = (res?.meta?.currentPage || 0) < (res?.meta?.lastPage || 0)
        page++
      }
      if (format === 'print') printTableData(all)
      else exportCSVData(all)
    } catch (err) { alert('Export failed: ' + err.message) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = insurances.filter(ins => {
    if (statusFilter === 'Active'   && ins.used !== 'Y') return false
    if (statusFilter === 'Inactive' && ins.used === 'Y') return false
    if (search && !(ins.insuranceName || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const total    = meta?.total ?? insurances.length
  const active   = insurances.filter(i => i.used === 'Y').length
  const totalPages  = meta ? (meta.lastPage ?? Math.ceil(meta.total / PER_PAGE)) : 1
  const currentPage = meta?.currentPage ?? 1

  return (
    <AppShell>
      <div className="page">

        {/* ── Page header ── */}
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Insurance Partners</span></div>
            <h1>Insurance Partners</h1>
          </div>
          <div className="page-head__actions">
            <button className="icon-btn" title="Refresh" onClick={() => load(currentPage)}><IcoRefresh /></button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="icon-btn icon-btn--white" title="Export PDF" onClick={() => exportAllData('print')}><IcoPdf /></button>
              <button className="icon-btn icon-btn--white" title="Export Excel" onClick={() => exportAllData('csv')}><IcoXlsx /></button>
              <button className="icon-btn icon-btn--white" title="Export CSV" onClick={() => exportAllData('csv')}><IcoCsv /></button>
            </div>
            <button className="btn btn--primary" onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setSaveErr(null); setSaveOk(false) }}>
              <IcoPlus /> Add Insurance
            </button>
          </div>
        </div>

        {/* ── Reduced KPI strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total Partners', value: total,    sub: 'registered' },
            { label: 'Active',         value: active,   sub: 'currently enabled', color: 'var(--ok)' },
            { label: 'Avg Rate',       value: '5.2%',   sub: 'premium avg' },
            { label: 'Branch ID',      value: branchId || '—', sub: 'current' },
          ].map(s => (
            <div key={s.label} className="kpi" style={{ padding: '8px 12px' }}>
              <div className="kpi__label" style={{ fontSize: 11 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: s.color || 'var(--ink-900)' }}>{s.value}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>{s.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Add Insurance Modal ── */}
        {showModal && (
          <div className="modal-backdrop" onClick={() => setShowModal(false)}>
            <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
              <div className="modal__head">
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Partner</div>
                  <h3 style={{ margin: 0 }}>Register New Insurance</h3>
                </div>
                <button className="modal__close" onClick={() => setShowModal(false)} aria-label="Close"><IcoClose /></button>
              </div>
              <div className="modal__body">
                {saveErr && <div className="settings-error">{saveErr}</div>}
                {saveOk && <div className="chip chip--ok" style={{ marginBottom: 12 }}>✓ Saved successfully</div>}
                <form onSubmit={handleCreate}>
                  <div className="form-group">
                    <label className="form-label">Insurance Name <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input" required placeholder="e.g. RAMA Insurance"
                      value={form.insuranceName} onChange={e => set('insuranceName', e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    <div className="form-group">
                      <label className="form-label">Premium Rate (%) <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input className="form-input input--mono" required type="number" step="0.01" placeholder="5.00"
                        value={form.premiumRate} onChange={e => set('premiumRate', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Initial Status</label>
                      <select className="form-input" value={form.used} onChange={e => set('used', e.target.value)}>
                        <option value="Y">Active / Enabled</option>
                        <option value="N">Inactive / Disabled</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Register Partner'}</button>
                    <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Table card ── */}
        <div className="card">
          <div className="filterbar">
            <div className="field" style={{ flex: 1 }}>
              <IcoSearch />
              <input
                placeholder="Search insurance partner…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
              />
            </div>
            <div className="field">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-400)' }}>
                <div className="spinner" style={{ marginBottom: 12 }} />
                <div>Loading partners…</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-500)' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No partners found</div>
                <div style={{ fontSize: 13 }}>Add a new partner or change filters.</div>
              </div>
            ) : (
              <>
                <table className="data data--hover">
                  <thead>
                    <tr>
                      <th>Insurance Partner</th>
                      <th>Code</th>
                      <th className="num">Premium Rate</th>
                      <th>Branch</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((ins, i) => {
                      const { bg, color } = avatarColor(ins.insuranceName || String(i))
                      return (
                        <tr key={ins.id || i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, color, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>
                                {(ins.insuranceName||'?').slice(0,1).toUpperCase()}
                              </div>
                              <div style={{ fontWeight: 600 }}>{ins.insuranceName || '—'}</div>
                            </div>
                          </td>
                          <td><span className="chip chip--plain chip--sm mono">{ins.insuranceCode || '—'}</span></td>
                          <td className="num" style={{ fontWeight: 600 }}>{ins.premiumRate}%</td>
                          <td style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{ins.branchId || branchId}</td>
                          <td>
                            {ins.used === 'Y' 
                              ? <span className="chip chip--ok">Active</span> 
                              : <span className="chip chip--err">Inactive</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* ── Pagination ── */}
                {!loading && totalPages > 1 && (
                  <div className="pagination" style={{ borderTop: '1px solid var(--ink-100)', padding: '12px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>
                      Showing {((currentPage-1)*PER_PAGE)+1}–{Math.min(currentPage*PER_PAGE, total)} of {total} partners
                    </span>
                    <div className="pages">
                      <button disabled={currentPage <= 1} onClick={() => load(currentPage - 1)}>‹</button>
                      {getPageNums(currentPage, totalPages).map((p, i) =>
                        typeof p === 'number'
                          ? <button key={i} className={p === currentPage ? 'is-active' : ''} onClick={() => load(p)}>{p}</button>
                          : <button key={i} disabled style={{ border: 'none', background: 'none' }}>{p}</button>
                      )}
                      <button disabled={currentPage >= totalPages} onClick={() => load(currentPage + 1)}>›</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
