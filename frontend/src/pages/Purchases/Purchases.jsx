import { useState, useEffect, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import { useApp } from '../../context/AppContext'

const PER_PAGE = 10
const PAYMENT_TYPES = [
  { v: '01', l: 'Cash' }, { v: '02', l: 'Credit' }, { v: '03', l: 'Cash / Credit' },
  { v: '04', l: 'Bank Cheque' }, { v: '05', l: 'Debit / Credit Card' },
  { v: '06', l: 'Mobile Money' }, { v: '07', l: 'Other' },
]

// F-58: Manual purchase — for suppliers who aren't EBM-registered, so there's
// nothing for Local Purchase sync to pull.
const TAX_TYPES = [
  { v: 'A', l: 'A — Exempt' }, { v: 'B', l: 'B — 18% Standard' },
  { v: 'C', l: 'C — Zero Rated' }, { v: 'D', l: 'D — Special' },
]
const PRODUCT_TYPES = [
  { v: '1', l: '1 — Raw Material' }, { v: '2', l: '2 — Finished Product' },
  { v: '3', l: '3 — Service' },
]
const MANUAL_QTY_UNITS = ['U', 'PCS', 'KGM', 'GRM', 'LTR', 'MTR', 'DZ', 'SET', 'BX', 'BG', 'CT', 'NO']
const MANUAL_PKG_UNITS = ['CT', 'BA', 'BC', 'BE', 'BG', 'BJ', 'BK', 'CA', 'JR', 'NT']

const EMPTY_MANUAL_ITEM = {
  itemId: '', q: '', results: [], searching: false,
  name: '', barcode: '', classificationCode: '',
  packagingUnitCode: 'CT', quantityUnitCode: 'U', taxTypeCode: 'B', productType: '2',
  insuranceApplicableYn: 'N',
  quantity: 1, price: '', discountRate: 0, packageNo: 1,
}

function statusInfo(p) {
  if (p.isConfirmed) return { label: 'Confirmed', cls: 'chip--ok' }
  if (p.isRejected)  return { label: 'Cancelled', cls: 'chip--err' }
  return                    { label: 'Pending',   cls: 'chip--warn', pending: true }
}

export default function Purchases() {
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [page,       setPage]       = useState(1)
  const [total,      setTotal]      = useState(0)
  const [lastPage,   setLastPage]   = useState(1)

  // KPIs
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0 })

  // Confirmation state
  const [activePurchase, setActivePurchase] = useState(null)
  const [confirmItems,    setConfirmItems]    = useState([])
  const [saving,          setSaving]          = useState(false)
  const [confirmErr,      setConfirmErr]      = useState(null)

  // View More — read-only detail view for a single purchase row
  const [viewPurchase, setViewPurchase] = useState(null)
  const [remarkEditing, setRemarkEditing] = useState(false)
  const [remarkDraft,   setRemarkDraft]   = useState('')
  const [remarkSaving,  setRemarkSaving]  = useState(false)

  // F-58: Manual purchase creation state
  const [manualOpen,   setManualOpen]   = useState(false)
  const [manualForm,   setManualForm]   = useState(null)
  const [manualItems,  setManualItems]  = useState([{ ...EMPTY_MANUAL_ITEM }])
  const [manualSaving, setManualSaving] = useState(false)
  const [manualErr,    setManualErr]    = useState(null)

  const load = useCallback(async (p = page) => {
    setLoading(true); setError(null)
    try {
      const res = await operatorApi.listPurchases(p, PER_PAGE)
      const data = res?.purchases?.data || res?.data || []
      setItems(data)
      setTotal(res?.purchases?.meta?.total || data.length)
      setLastPage(res?.purchases?.meta?.lastPage || 1)
      
      // Stats
      const confirmed = data.filter(x => x.isConfirmed).length
      const pending   = data.filter(x => !x.isConfirmed && !x.isRejected).length
      setStats({ total: data.length, pending, confirmed })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  function openConfirm(p) {
    setActivePurchase(p)
    const items = p.items?.data ?? []
    setConfirmItems(items.map(item => ({
      sequenceNo:            item.sequenceNo,
      name:                  item.name || '',
      insuranceApplicableYn: 'N',
    })))
    setConfirmErr(null)
  }

  async function handleConfirm(e) {
    e.preventDefault(); setConfirmErr(null); setSaving(true)
    try {
      await operatorApi.savePurchase({
        purchaseId: activePurchase.id,
        isConfirm:  true,
        items: confirmItems.map(item => ({
          sequenceNo:            item.sequenceNo,
          insuranceApplicableYn: item.insuranceApplicableYn,
        })),
      })
      logActivity({ action: 'CONFIRM_PURCHASE', category: 'Procurement', summary: `Confirmed purchase from ${activePurchase.supplierName}` })
      setActivePurchase(null); load()
    } catch (err) {
      setConfirmErr(err.data?.errors?.[0]?.message || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReject(p) {
    if (!window.confirm('Are you sure you want to REJECT this purchase? This will notify the supplier.')) return
    try {
      await operatorApi.savePurchase({ purchaseId: p.id, isConfirm: false })
      logActivity({ action: 'REJECT_PURCHASE', category: 'Procurement', summary: `Rejected purchase from ${p.supplierName}` })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  // Local-only soft-delete — hides the row from the list without touching
  // whatever's already been reported to EBM.
  async function handleHide(p) {
    if (!window.confirm(`Remove "${p.supplierName || 'this purchase'}" from your list? This only hides it locally — it does not affect anything already reported to EBM.`)) return
    try {
      await operatorApi.hidePurchase(p.id)
      logActivity({ action: 'HIDE_PURCHASE', category: 'Procurement', summary: `Hid purchase from ${p.supplierName}` })
      load()
    } catch (err) {
      alert(err.data?.error || err.message)
    }
  }

  function openRemarkEdit() {
    setRemarkDraft(viewPurchase?.remark || '')
    setRemarkEditing(true)
  }

  function openView(p) {
    setViewPurchase(p)
    setRemarkEditing(false)
  }

  function openUpdate(p) {
    setViewPurchase(p)
    setRemarkDraft(p.remark || '')
    setRemarkEditing(true)
  }

  async function handleSaveRemark() {
    setRemarkSaving(true)
    try {
      await operatorApi.updatePurchaseRemark(viewPurchase.id, remarkDraft)
      setViewPurchase(v => ({ ...v, remark: remarkDraft }))
      setRemarkEditing(false)
      load()
    } catch (err) {
      alert(err.data?.error || err.message)
    } finally {
      setRemarkSaving(false)
    }
  }

  // F-58: Manual purchase — for a supplier who isn't EBM-registered, so
  // Local Purchase sync has nothing to pull from RRA.
  function openManualCreate() {
    setManualForm({
      supplierName: '', supplierTin: '', paymentMethod: '01',
      purchaseDate: new Date().toISOString().slice(0, 10), remark: '',
    })
    setManualItems([{ ...EMPTY_MANUAL_ITEM }])
    setManualErr(null)
    setManualOpen(true)
  }

  function addManualItem() {
    setManualItems(items => [...items, { ...EMPTY_MANUAL_ITEM }])
  }
  function removeManualItem(idx) {
    setManualItems(items => items.filter((_, j) => j !== idx))
  }
  function setManualItem(idx, patch) {
    setManualItems(items => items.map((it, j) => j === idx ? { ...it, ...patch } : it))
  }

  function searchManualItem(idx, q) {
    setManualItem(idx, { q, searching: q.length >= 2 })
    if (q.length < 2) { setManualItem(idx, { results: [] }); return }
    operatorApi.searchItems(q, 1, 8)
      .then(res => setManualItem(idx, { results: res?.data || res?.items?.data || [], searching: false }))
      .catch(() => setManualItem(idx, { results: [], searching: false }))
  }

  function pickManualItem(idx, it) {
    setManualItem(idx, {
      itemId: it.id, q: it.name, results: [],
      name: it.name, classificationCode: it.classificationCode,
      taxTypeCode: it.taxTypeCode || 'B',
      packagingUnitCode: it.packagingUnitCode || 'CT',
      quantityUnitCode: it.quantityUnitCode || 'U',
    })
  }

  function clearManualItemPick(idx) {
    setManualItem(idx, { ...EMPTY_MANUAL_ITEM })
  }

  async function handleCreateManualPurchase(e) {
    e.preventDefault(); setManualErr(null)

    if (!manualForm.supplierName.trim()) { setManualErr('Supplier name is required.'); return }
    for (const it of manualItems) {
      if (!it.itemId) {
        if (!it.name.trim()) { setManualErr('Every new item needs a name.'); return }
        if (!it.classificationCode.trim()) { setManualErr(`Item "${it.name}" needs a classification code.`); return }
      }
      if (!it.quantity || !it.price) { setManualErr('Every item needs a quantity and unit price.'); return }
    }

    setManualSaving(true)
    try {
      const payload = {
        supplierName: manualForm.supplierName.trim(),
        paymentMethod: manualForm.paymentMethod,
        purchaseDate: manualForm.purchaseDate,
        items: manualItems.map(it => {
          const base = {
            quantity: Number(it.quantity),
            price: Number(it.price),
            discountRate: Number(it.discountRate || 0),
            packageNo: Number(it.packageNo || 1),
            insuranceApplicableYn: it.insuranceApplicableYn,
          }
          if (it.itemId) return { ...base, itemId: it.itemId }
          return {
            ...base,
            name: it.name.trim(),
            barcode: it.barcode || undefined,
            classificationCode: it.classificationCode,
            packagingUnitCode: it.packagingUnitCode,
            quantityUnitCode: it.quantityUnitCode,
            taxTypeCode: it.taxTypeCode,
            productType: it.productType,
          }
        }),
      }
      if (manualForm.supplierTin) payload.supplierTin = Number(manualForm.supplierTin)
      if (manualForm.remark) payload.remark = manualForm.remark

      await operatorApi.createPurchase(payload)
      logActivity({ action: 'CREATE_MANUAL_PURCHASE', category: 'Procurement', summary: `Recorded purchase from ${manualForm.supplierName}` })
      setManualOpen(false); load(1)
    } catch (err) {
      setManualErr(err.data?.errors?.[0]?.message || err.data?.error || err.message)
    } finally {
      setManualSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Workspace</span><span>›</span><span>Procurement</span></div>
            <h1>Local Purchases</h1>
          </div>
          <div className="page-head__actions">
            <button className="btn btn--ghost" onClick={openManualCreate}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              New Purchase
            </button>
            <button className="btn btn--primary" onClick={() => load(1)} disabled={loading}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {loading ? 'Syncing...' : 'Sync from RRA'}
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi__label">Purchases Sync</div>
            <div className="kpi__value">{stats.total}</div>
            <span className="kpi__sub">Total invoices found</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Pending My Confirmation</div>
            <div className="kpi__value">{stats.pending}</div>
            <span className="kpi__delta kpi__delta--warn">Needs action</span>
          </div>
          <div className="kpi">
            <div className="kpi__label">Confirmed</div>
            <div className="kpi__value">{stats.confirmed}</div>
            <span className="kpi__delta kpi__delta--up">Successfully added</span>
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <h3>Supply Chain Invoices</h3>
          </div>
          <div className="table-wrap">
            {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner-sm" style={{ margin: '0 auto 10px' }} />Checking for new invoices...</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 80, textAlign: 'center', color: 'var(--ink-400)' }}>
                 <div style={{ fontWeight: 600, color: 'var(--ink-600)' }}>No Purchase Invoices</div>
                 <div style={{ fontSize: 13 }}>Sync with RRA to pull invoices from EBM-registered suppliers, or use <b>New Purchase</b> above for suppliers who aren't EBM-registered.</div>
              </div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Supplier Name</th>
                    <th>Supplier TIN</th>
                    <th>Invoice No</th>
                    <th className="num">Total Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((p, idx) => {
                    const status = statusInfo(p)
                    // Invoice No prefers our own generated number (invoiceNo) —
                    // set once a purchase is confirmed or self-registered.
                    // supplierInvoiceNo (the OTHER party's number) only exists
                    // for purchases synced from a real EBM-registered supplier,
                    // and is null for manually-created ("New Purchase") ones —
                    // that's why this column used to look empty for those rows.
                    const invoiceLabel = p.invoiceNo
                      ? `#${p.invoiceNo}`
                      : p.supplierInvoiceNo
                        ? `Supplier #${p.supplierInvoiceNo}`
                        : '—'
                    return (
                      <tr key={p.id || idx}>
                        <td style={{ fontWeight: 600 }}>{p.supplierName || '—'}</td>
                        <td className="mono">{p.supplierTin || '—'}</td>
                        <td className="mono">{invoiceLabel}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{Number(p.totalAmount || 0).toLocaleString()} RWF</td>
                        <td style={{ color: 'var(--ink-500)', fontSize: 13 }}>{p.saleDate ? new Date(p.saleDate).toLocaleDateString() : '—'}</td>
                        <td><span className={`chip ${status.cls}`}>{status.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn--sm btn--ghost" title="View details" onClick={() => openView(p)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button className="btn btn--sm btn--ghost" title="Edit remark" onClick={() => openUpdate(p)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                            {status.pending && (
                              <>
                                <button className="btn btn--sm btn--primary" onClick={() => openConfirm(p)}>Confirm</button>
                                <button className="btn btn--sm btn--ghost btn--danger" onClick={() => handleReject(p)}>Reject</button>
                              </>
                            )}
                            <button className="btn btn--sm btn--ghost btn--danger" title="Remove from list (local only)" onClick={() => handleHide(p)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          </div>
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

      {/* Confirmation Modal */}
      {activePurchase && (
        <div className="modal-backdrop" onClick={() => setActivePurchase(null)}>
          <div className="modal" style={{ maxWidth: 700, borderRadius: 20 }} onClick={e => e.stopPropagation()}>
            <div className="modal__head" style={{ padding: '24px 32px', background: 'var(--ink-900)', color: '#fff' }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7, marginBottom: 4 }}>Purchase Confirmation</div>
                <h3 style={{ margin: 0 }}>Invoice #{activePurchase.supplierInvoiceNo}</h3>
              </div>
              <button className="modal__close" onClick={() => setActivePurchase(null)} style={{ color: '#fff' }}>
                 <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
              </button>
            </div>
            <div className="modal__body" style={{ padding: 32 }}>
               <div style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 12, padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Supplier</label>
                    <div style={{ fontWeight: 700 }}>{activePurchase.supplierName}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>TIN: {activePurchase.supplierTin}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Amount Payable</label>
                    <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--brand-700)' }}>{Number(activePurchase.totalAmount || 0).toLocaleString()} RWF</div>
                  </div>
               </div>

               {confirmErr && <div className="settings-error" style={{ marginBottom: 20 }}>{confirmErr}</div>}

               <form onSubmit={handleConfirm}>
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 13, marginBottom: 12, color: 'var(--ink-800)' }}>Map Items & Insurance Status</h4>
                    <div className="table-wrap" style={{ border: '1px solid var(--ink-200)', borderRadius: 10 }}>
                      <table className="data" style={{ fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th>Seq</th>
                            <th>Item Name</th>
                            <th style={{ width: 160 }}>Insurance Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {confirmItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="mono">{item.sequenceNo}</td>
                              <td style={{ fontWeight: 600 }}>{item.name}</td>
                              <td>
                                <select className="form-input form-input--sm" value={item.insuranceApplicableYn} 
                                  onChange={e => setConfirmItems(list => list.map((x, j) => j === idx ? { ...x, insuranceApplicableYn: e.target.value } : x))}>
                                  <option value="N">No Insurance</option>
                                  <option value="Y">Insurance Applied</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--ink-100)', paddingTop: 24 }}>
                    <button type="button" className="btn btn--lg btn--ghost" onClick={() => setActivePurchase(null)}>Back</button>
                    <button type="button" className="btn btn--lg btn--danger" onClick={() => handleReject(activePurchase)}>Reject Purchase</button>
                    <button type="submit" className="btn btn--lg btn--primary" style={{ padding: '0 40px' }} disabled={saving}>
                       {saving ? 'Confirming...' : 'Confirm & Accept Stock'}
                    </button>
                  </div>
               </form>
            </div>
          </div>
        </div>
      )}

      {/* View More Modal — read-only full detail for one purchase row */}
      {viewPurchase && (
        <div className="modal-backdrop" onClick={() => setViewPurchase(null)}>
          <div className="modal" style={{ maxWidth: 800, borderRadius: 20, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="modal__head" style={{ padding: '24px 32px', background: 'var(--ink-900)', color: '#fff' }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7, marginBottom: 4 }}>Purchase Detail</div>
                <h3 style={{ margin: 0 }}>{viewPurchase.invoiceNo ? `Invoice #${viewPurchase.invoiceNo}` : viewPurchase.supplierInvoiceNo ? `Supplier Invoice #${viewPurchase.supplierInvoiceNo}` : 'Purchase'}</h3>
              </div>
              <button className="modal__close" onClick={() => setViewPurchase(null)} style={{ color: '#fff' }}>
                 <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
              </button>
            </div>
            <div className="modal__body" style={{ padding: 32, maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Supplier</label>
                  <div style={{ fontWeight: 700 }}>{viewPurchase.supplierName || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>TIN: {viewPurchase.supplierTin || 'N/A'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Status</label>
                  <span className={`chip ${statusInfo(viewPurchase).cls}`}>{statusInfo(viewPurchase).label}</span>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Payment Method</label>
                  <div>{PAYMENT_TYPES.find(t => t.v === viewPurchase.paymentMethod)?.l || viewPurchase.paymentMethod || '—'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Purchase Date</label>
                  <div>{viewPurchase.saleDate ? new Date(viewPurchase.saleDate).toLocaleDateString() : '—'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Confirmed On</label>
                  <div>{viewPurchase.confirmationDate ? new Date(viewPurchase.confirmationDate).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Total Items</label>
                  <div>{viewPurchase.totalItems ?? (viewPurchase.items?.data?.length || 0)}</div>
                </div>
              </div>

              <h4 style={{ fontSize: 13, marginBottom: 12, color: 'var(--ink-800)' }}>Items</h4>
              <div className="table-wrap" style={{ border: '1px solid var(--ink-200)', borderRadius: 10, marginBottom: 24 }}>
                <table className="data" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Code</th>
                      <th>Tax</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit Price</th>
                      <th className="num">Tax Amt</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewPurchase.items?.data || []).map((it, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{it.name}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{it.code}</td>
                        <td><span className="chip chip--plain">{it.taxationType}</span></td>
                        <td className="num">{Number(it.quantity || 0).toLocaleString()} {it.quantityUnit}</td>
                        <td className="num">{Number(it.price || 0).toLocaleString()}</td>
                        <td className="num">{Number(it.taxAmount || 0).toLocaleString()}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{Number(it.totalAmount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {(!viewPurchase.items?.data || viewPurchase.items.data.length === 0) && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-400)', padding: 20 }}>No item detail available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 12, padding: 20 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Taxable Amount</label>
                  <div style={{ fontWeight: 700 }}>{Number(viewPurchase.totalTaxableAmount || 0).toLocaleString()} RWF</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Tax Amount</label>
                  <div style={{ fontWeight: 700 }}>{Number(viewPurchase.totalTaxAmount || 0).toLocaleString()} RWF</div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Total Amount</label>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand-700)' }}>{Number(viewPurchase.totalAmount || 0).toLocaleString()} RWF</div>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase' }}>Remark</label>
                  {!remarkEditing && <button type="button" className="btn btn--sm btn--ghost" onClick={openRemarkEdit}>Edit</button>}
                </div>
                {remarkEditing ? (
                  <div>
                    <textarea className="form-input" rows={2} value={remarkDraft} maxLength={400}
                      onChange={e => setRemarkDraft(e.target.value)} placeholder="Add a note…" />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setRemarkEditing(false)} disabled={remarkSaving}>Cancel</button>
                      <button type="button" className="btn btn--sm btn--primary" onClick={handleSaveRemark} disabled={remarkSaving}>
                        {remarkSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: viewPurchase.remark ? 'inherit' : 'var(--ink-400)' }}>{viewPurchase.remark || 'No remark'}</div>
                )}
              </div>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--ink-100)', fontSize: 12, color: 'var(--ink-400)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Record ID: <span className="mono">{viewPurchase.id}</span></span>
                <span>EBM Result: {viewPurchase.resultDt || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Modal — F-58: manual/self-registered purchase for non-EBM suppliers */}
      {manualOpen && manualForm && (
        <div className="modal-backdrop" onClick={() => !manualSaving && setManualOpen(false)}>
          <div className="modal" style={{ maxWidth: 900, borderRadius: 20, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="modal__head" style={{ padding: '24px 32px', background: 'var(--brand-900)', color: '#fff' }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7, marginBottom: 4 }}>Procurement</div>
                <h3 style={{ margin: 0, fontSize: 20 }}>New Purchase</h3>
              </div>
              <button className="modal__close" onClick={() => setManualOpen(false)} style={{ color: '#fff', opacity: 0.7 }}>
                 <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
              </button>
            </div>
            <div className="modal__body" style={{ padding: 32, maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>
                For suppliers who aren't EBM-registered — this pushes the purchase to EBM directly and adds stock immediately, without waiting on Local Purchase sync.
              </div>

              {manualErr && <div className="settings-error" style={{ marginBottom: 20 }}>{manualErr}</div>}

              <form onSubmit={handleCreateManualPurchase}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginBottom: 24 }}>
                  <div className="form-group">
                    <label className="form-label">Supplier Name <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input" required value={manualForm.supplierName}
                      onChange={e => setManualForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="e.g. Kigali Market Vendor" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier TIN (optional)</label>
                    <input className="form-input mono" value={manualForm.supplierTin}
                      onChange={e => setManualForm(f => ({ ...f, supplierTin: e.target.value }))} placeholder="Leave blank if unregistered" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select className="form-input" value={manualForm.paymentMethod}
                      onChange={e => setManualForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                      {PAYMENT_TYPES.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input type="date" className="form-input" value={manualForm.purchaseDate}
                      onChange={e => setManualForm(f => ({ ...f, purchaseDate: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Remark (optional)</label>
                    <input className="form-input" value={manualForm.remark}
                      onChange={e => setManualForm(f => ({ ...f, remark: e.target.value }))} placeholder="Any note for this purchase" />
                  </div>
                </div>

                <h4 style={{ fontSize: 13, marginBottom: 12, color: 'var(--ink-800)' }}>Items</h4>
                {manualItems.map((it, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--ink-200)', borderRadius: 12, padding: 16, marginBottom: 12, position: 'relative' }}>
                    {manualItems.length > 1 && (
                      <button type="button" onClick={() => removeManualItem(idx)}
                        style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-400)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
                      </button>
                    )}

                    {!it.itemId ? (
                      <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label">Find Existing Item</label>
                        <input className="form-input" value={it.q} onChange={e => searchManualItem(idx, e.target.value)}
                          placeholder="Type at least 2 characters to search stock…" />
                        {it.results.length > 0 && (
                          <div style={{ border: '1px solid var(--ink-200)', borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
                            {it.results.map(r => (
                              <div key={r.id} onClick={() => pickManualItem(idx, r)}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--ink-100)' }}>
                                <b>{r.name}</b> <span className="mono" style={{ color: 'var(--ink-400)' }}>({r.code})</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <span className="form-hint">No match? Fill the fields below to create a new item.</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, background: 'var(--ink-50)', padding: '8px 12px', borderRadius: 8 }}>
                        <div><b>{it.name}</b> <span className="mono" style={{ fontSize: 12, color: 'var(--ink-400)' }}>({it.classificationCode})</span></div>
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => clearManualItemPick(idx)}>Change</button>
                      </div>
                    )}

                    {!it.itemId && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px 16px', marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">New Item Name <span style={{ color: 'var(--err)' }}>*</span></label>
                          <input className="form-input form-input--sm" required value={it.name} onChange={e => setManualItem(idx, { name: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Classification Code <span style={{ color: 'var(--err)' }}>*</span></label>
                          <input className="form-input form-input--sm mono" required value={it.classificationCode} onChange={e => setManualItem(idx, { classificationCode: e.target.value })} placeholder="e.g. 101010101" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Barcode</label>
                          <input className="form-input form-input--sm mono" value={it.barcode} onChange={e => setManualItem(idx, { barcode: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Tax Type</label>
                          <select className="form-input form-input--sm" value={it.taxTypeCode} onChange={e => setManualItem(idx, { taxTypeCode: e.target.value })}>
                            {TAX_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Product Type</label>
                          <select className="form-input form-input--sm" value={it.productType} onChange={e => setManualItem(idx, { productType: e.target.value })}>
                            {PRODUCT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Insurance</label>
                          <select className="form-input form-input--sm" value={it.insuranceApplicableYn} onChange={e => setManualItem(idx, { insuranceApplicableYn: e.target.value })}>
                            <option value="N">No</option>
                            <option value="Y">Yes</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Quantity Unit</label>
                          <select className="form-input form-input--sm" value={it.quantityUnitCode} onChange={e => setManualItem(idx, { quantityUnitCode: e.target.value })}>
                            {MANUAL_QTY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Packing Unit</label>
                          <select className="form-input form-input--sm" value={it.packagingUnitCode} onChange={e => setManualItem(idx, { packagingUnitCode: e.target.value })}>
                            {MANUAL_PKG_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px 16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Quantity <span style={{ color: 'var(--err)' }}>*</span></label>
                        <input type="number" min="0" step="any" className="form-input form-input--sm" value={it.quantity} onChange={e => setManualItem(idx, { quantity: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Unit Price (RWF) <span style={{ color: 'var(--err)' }}>*</span></label>
                        <input type="number" min="0" step="any" className="form-input form-input--sm" value={it.price} onChange={e => setManualItem(idx, { price: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Discount %</label>
                        <input type="number" min="0" max="100" step="any" className="form-input form-input--sm" value={it.discountRate} onChange={e => setManualItem(idx, { discountRate: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Line Total</label>
                        <div style={{ fontWeight: 700, padding: '6px 0' }}>
                          {(Number(it.quantity || 0) * Number(it.price || 0) * (1 - Number(it.discountRate || 0) / 100)).toLocaleString()} RWF
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" className="btn btn--sm btn--ghost" onClick={addManualItem} style={{ marginBottom: 24 }}>+ Add Item</button>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--ink-100)', paddingTop: 24 }}>
                  <button type="button" className="btn btn--lg btn--ghost" onClick={() => setManualOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn--lg btn--primary" style={{ padding: '0 40px' }} disabled={manualSaving}>
                     {manualSaving ? 'Saving...' : 'Create Purchase & Add Stock'}
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
