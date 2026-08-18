import { useState, useEffect, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import { useApp } from '../../context/AppContext'

const PER_PAGE = 10

function statusInfo(imp) {
  if (imp.isApproved  || imp.statusCode === '3') return { label: 'Approved',  cls: 'chip--ok',   pending: false }
  if (imp.isCanceled  || imp.statusCode === '4') return { label: 'Cancelled', cls: 'chip--err',  pending: false }
  return                                                { label: 'Pending',   cls: 'chip--warn', pending: true  }
}

export default function Imports() {
  const { rawUser } = useApp()
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [page,       setPage]       = useState(1)
  const [total,      setTotal]      = useState(0)
  const [lastPage,   setLastPage]   = useState(1)

  // KPI states
  const [pendingCount, setPendingCount] = useState(0)

  // Approve Form
  const [activeItem, setActiveItem] = useState(null)
  const [form,       setForm]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [formErr,    setFormErr]    = useState(null)

  // Branch selection for fetching
  const [selectBranchId, setSelectBranchId] = useState(rawUser?.branchId || '')
  const [selectResult,   setSelectResult]   = useState(null)
  const [selectLoading,  setSelectLoading]  = useState(false)

  const load = useCallback(async (p = page) => {
    setLoading(true); setError(null)
    try {
      const res = await operatorApi.listImports(p, PER_PAGE)
      const data = res?.importItems?.data || res?.data || []
      setItems(data)
      setTotal(res?.importItems?.meta?.total || data.length)
      setLastPage(res?.importItems?.meta?.lastPage || 1)
      setPendingCount(res?.importItems?.meta?.totalPending || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  async function handleFetchByBranch() {
    if (!selectBranchId.trim()) return
    setSelectLoading(true); setSelectResult(null)
    try {
      const res = await operatorApi.selectImport(selectBranchId.trim())
      setSelectResult(res?.data ?? res ?? [])
    } catch (err) {
      setError(`Fetch failed: ${err.message}`)
    } finally {
      setSelectLoading(false)
    }
  }

  function openApprove(item) {
    setActiveItem(item)
    setForm({
      name:                  item.itemName || '',
      barcode:               '',
      quantityUnit:          item.quantityUnitCode || 'U',
      packingType:           item.packageUnitCode  || 'CT',
      taxTypeCode:           'B',
      useYn:                 'Y',
      insuranceApplicableYn: 'N',
      productType:           '2',
      classificationCode:    '',
    })
    setFormErr(null)
  }

  async function handleApprove(e) {
    e.preventDefault(); setFormErr(null); setSaving(true)
    try {
      await operatorApi.approveImport({
        id: activeItem.id,
        item: form
      })
      logActivity({ action: 'APPROVE_IMPORT', category: 'Inventory', summary: `Approved import item "${form.name}"` })
      alert('Import approved and added to stock successfully!')
      setActiveItem(null); load()
    } catch (err) {
      setFormErr(err.data?.errors?.[0]?.message || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(item) {
    if (!window.confirm('Cancel this import task?')) return
    try {
      await operatorApi.cancelImport({ id: item.id })
      logActivity({ action: 'CANCEL_IMPORT', category: 'Inventory', summary: `Cancelled import ${item.id}` })
      alert('Import task cancelled.')
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Workspace</span><span>›</span><span>Imports</span></div>
            <h1>Import Management</h1>
          </div>
          <div className="page-head__actions">
            <button className="btn btn--primary" onClick={() => load(1)} disabled={loading}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {loading ? 'Syncing...' : 'Sync Customs'}
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi__label">Total Customs Items</div>
            <div className="kpi__value">{total}</div>
            <span className="kpi__sub">records found</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Pending Approval</div>
            <div className="kpi__value">{pendingCount || items.filter(i => statusInfo(i).pending).length}</div>
            <span className="kpi__delta kpi__delta--warn">Awaiting registration</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Branch</div>
            <div className="kpi__value" style={{ fontSize: 20 }}>{rawUser?.branchId || '—'}</div>
            <span className="kpi__sub">Active location</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card__head">
            <h3>Quick Fetch by Branch</h3>
          </div>
          <div className="card__body">
             <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: 300 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Branch ID</label>
                  <input className="form-input mono" value={selectBranchId} onChange={e => setSelectBranchId(e.target.value)} placeholder="e.g. 00" />
                </div>
                <button className="btn btn--primary" onClick={handleFetchByBranch} disabled={selectLoading}>
                  {selectLoading ? 'Fetching...' : 'Query Branch Declaration'}
                </button>
             </div>
             {selectResult && (
               <div style={{ marginTop: 20, padding: 16, background: 'var(--ink-50)', borderRadius: 12, border: '1px solid var(--ink-200)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', color: 'var(--ink-500)' }}>Search Results</div>
                  {selectResult.length === 0 ? (
                    <div style={{ fontSize: 13 }}>No items found for this branch.</div>
                  ) : (
                    <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                      <table className="data" style={{ fontSize: 12.5 }}>
                        <thead><tr><th>Declaration No</th><th>Item Name</th><th>HS Code</th></tr></thead>
                        <tbody>
                          {selectResult.map((r, i) => (
                            <tr key={i}>
                              <td className="mono">{r.declarationNumber || '—'}</td>
                              <td style={{ fontWeight: 600 }}>{r.itemName || '—'}</td>
                              <td className="mono">{r.hsCode || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
               </div>
             )}
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <h3>Import List</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--sm btn--ghost" onClick={() => load()}>
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
          <div className="table-wrap">
            {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner-sm" style={{ margin: '0 auto 10px' }} />Loading customs data...</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-400)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: 16, opacity: 0.5 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontWeight: 600, color: 'var(--ink-600)' }}>No Import Items Found</div>
                <div style={{ fontSize: 13 }}>Sync with Customs to pull latest import declarations.</div>
              </div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Declaration No</th>
                    <th>Item Name</th>
                    <th>HS Code</th>
                    <th className="num">Quantity</th>
                    <th>Unit</th>
                    <th>Origin</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const status = statusInfo(item)
                    return (
                      <tr key={item.id || idx}>
                        <td className="mono">{item.declarationNumber || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{item.itemName || '—'}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{item.hsCode || '—'}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{Number(item.quantity || 0).toLocaleString()}</td>
                        <td><span className="chip chip--plain">{item.quantityUnitCode || '—'}</span></td>
                        <td>{item.originNationCode || '—'}</td>
                        <td><span className={`chip ${status.cls}`}>{status.label}</span></td>
                        <td>
                          {status.pending && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn--sm btn--primary" onClick={() => openApprove(item)}>Approve</button>
                              <button className="btn btn--sm btn--ghost btn--danger" onClick={() => handleCancel(item)}>
                                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="card__foot" style={{ display: 'flex', justifyContent: 'center', padding: 12, borderTop: '1px solid var(--ink-100)' }}>
             <div className="pagination">
                <button className="btn btn--sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>Page <b>{page}</b> of {lastPage}</span>
                <button className="btn btn--sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</button>
             </div>
          </div>
        </div>
      </div>

      {/* Full-screen Approve Modal */}
      {activeItem && (
        <div className="modal-backdrop" onClick={() => setActiveItem(null)}>
          <div className="modal" style={{ maxWidth: 800, borderRadius: 20, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="modal__head" style={{ padding: '24px 32px', background: 'var(--brand-900)', color: '#fff' }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7, marginBottom: 4 }}>Inventory Registration</div>
                <h3 style={{ margin: 0, fontSize: 20 }}>Approve Import Item</h3>
              </div>
              <button className="modal__close" onClick={() => setActiveItem(null)} style={{ color: '#fff', opacity: 0.7 }}>
                 <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
              </button>
            </div>
            <div className="modal__body" style={{ padding: 32 }}>
               {formErr && <div className="settings-error" style={{ marginBottom: 20 }}>{formErr}</div>}
               
               <form onSubmit={handleApprove} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">System Item Name <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="How this item will appear in your stock" />
                    <span className="form-hint">Original Customs Name: {activeItem.itemName}</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Barcode</label>
                    <input className="form-input mono" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} placeholder="Scan or type barcode" />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Classification Code <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input mono" required value={form.classificationCode} onChange={e => setForm({...form, classificationCode: e.target.value})} placeholder="e.g. 101010101" />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tax Type</label>
                    <select className="form-input" value={form.taxTypeCode} onChange={e => setForm({...form, taxTypeCode: e.target.value})}>
                      <option value="A">A — Exempt</option>
                      <option value="B">B — 18% Standard</option>
                      <option value="C">C — Zero Rated</option>
                      <option value="D">D — Special</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Product Type</label>
                    <select className="form-input" value={form.productType} onChange={e => setForm({...form, productType: e.target.value})}>
                      <option value="1">1 — Raw Material</option>
                      <option value="2">2 — Finished Product</option>
                      <option value="3">3 — Service</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity Unit</label>
                    <select className="form-input" value={form.quantityUnit} onChange={e => setForm({...form, quantityUnit: e.target.value})}>
                      <option value="U">Units (U)</option>
                      <option value="PCS">Pieces (PCS)</option>
                      <option value="KGM">Kilograms (KGM)</option>
                      <option value="LTR">Liters (LTR)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Packing Type</label>
                    <select className="form-input" value={form.packingType} onChange={e => setForm({...form, packingType: e.target.value})}>
                      <option value="CT">Carton (CT)</option>
                      <option value="BA">Barrel (BA)</option>
                      <option value="BC">Bottlecrate (BC)</option>
                      <option value="BE">Bundle (BE)</option>
                      <option value="BG">Bag (BG)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Insurance Applicable</label>
                    <select className="form-input" value={form.insuranceApplicableYn} onChange={e => setForm({...form, insuranceApplicableYn: e.target.value})}>
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: '1 / -1', marginTop: 12, display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--ink-100)', paddingTop: 24 }}>
                    <button type="button" className="btn btn--lg btn--ghost" onClick={() => setActiveItem(null)}>Discard</button>
                    <button type="submit" className="btn btn--lg btn--primary" style={{ padding: '0 40px' }} disabled={saving}>
                       {saving ? 'Approving...' : 'Approve & Register Stock'}
                    </button>
                  </div>
               </form>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
