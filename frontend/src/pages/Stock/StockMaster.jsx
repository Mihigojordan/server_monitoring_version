import { useState, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import { useApp } from '../../context/AppContext'

const EMPTY_ENTRY = { itemCode: '', itemName: '', quantity: '' }

export default function StockMaster() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || ''

  // Mode: 'opening' (stockTyCd=1) or 'reconcile' (stockTyCd=3)
  const [mode, setMode] = useState('opening')

  // Single-item form (reconcile mode)
  const [form,    setForm]    = useState({ itemCode: '', remainQuantity: '' })
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState(null)
  const [ok,      setOk]      = useState(false)
  const [search,  setSearch]  = useState('')
  const [results, setResults] = useState([])
  const [finding, setFinding] = useState(false)

  // Opening deposit batch list
  const [batch,        setBatch]        = useState([{ ...EMPTY_ENTRY }])
  const [batchSaving,  setBatchSaving]  = useState(false)
  const [batchErr,     setBatchErr]     = useState(null)
  const [batchOk,      setBatchOk]      = useState(false)
  const [batchResults, setBatchResults] = useState({}) // itemCode → search results per row
  const [batchSearch,  setBatchSearch]  = useState({}) // rowIdx → search string

  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState(null)

  // ── Search helpers ────────────────────────────────────────────────────────
  const searchItems = useCallback(async (q, setList, setLoading) => {
    if (!q || q.length < 2) { setList([]); return }
    setLoading(true)
    try {
      const res = await operatorApi.searchItems(q, 1, 15)
      setList(res?.items?.data ?? res?.data ?? [])
    } catch { setList([]) }
    finally { setLoading(false) }
  }, [])

  // ── Single reconciliation ─────────────────────────────────────────────────
  async function handleSingle(e) {
    e.preventDefault(); setErr(null); setSaving(true); setOk(false)
    try {
      await operatorApi.saveMaster({
        itemCode: form.itemCode,
        remainQuantity: Number(form.remainQuantity),
        branchId,
        stockTyCd: '3',
      })
      logActivity({ action: 'STOCK_MASTER', category: 'Inventory', summary: `Reconciliation: ${form.itemCode} → ${form.remainQuantity}` })
      setOk(true); setForm({ itemCode: '', remainQuantity: '' }); setSearch('')
      setTimeout(() => setOk(false), 4000)
    } catch (err2) { setErr(err2.data?.errors?.[0]?.message || err2.message || 'Failed') }
    finally { setSaving(false) }
  }

  // ── Batch opening deposit ─────────────────────────────────────────────────
  function addRow() { setBatch(b => [...b, { ...EMPTY_ENTRY }]) }
  function removeRow(i) { setBatch(b => b.filter((_, idx) => idx !== i)) }
  function updateRow(i, field, value) { setBatch(b => b.map((r, idx) => idx === i ? { ...r, [field]: value } : r)) }

  async function searchForRow(rowIdx, q) {
    setBatchSearch(s => ({ ...s, [rowIdx]: q }))
    if (!q || q.length < 2) { setBatchResults(r => ({ ...r, [rowIdx]: [] })); return }
    try {
      const res = await operatorApi.searchItems(q, 1, 10)
      setBatchResults(r => ({ ...r, [rowIdx]: res?.items?.data ?? res?.data ?? [] }))
    } catch { setBatchResults(r => ({ ...r, [rowIdx]: [] })) }
  }

  function selectRowItem(rowIdx, item) {
    updateRow(rowIdx, 'itemCode', item.code)
    updateRow(rowIdx, 'itemName', item.name)
    setBatchSearch(s => ({ ...s, [rowIdx]: item.name }))
    setBatchResults(r => ({ ...r, [rowIdx]: [] }))
  }

  async function handleBatch(e) {
    e.preventDefault(); setBatchErr(null); setBatchSaving(true); setBatchOk(false)
    const valid = batch.filter(r => r.itemCode && r.quantity)
    if (valid.length === 0) { setBatchErr('Add at least one item with a quantity.'); setBatchSaving(false); return }
    try {
      await Promise.all(valid.map(r =>
        operatorApi.saveMaster({
          itemCode: r.itemCode,
          remainQuantity: Number(r.quantity),
          branchId,
          stockTyCd: '1', // Opening Stock
        })
      ))
      logActivity({ action: 'OPENING_DEPOSIT', category: 'Inventory', summary: `Opening deposit: ${valid.length} items registered` })
      setBatchOk(true)
      setBatch([{ ...EMPTY_ENTRY }])
      setBatchSearch({}); setBatchResults({})
      setTimeout(() => setBatchOk(false), 5000)
    } catch (err2) { setBatchErr(err2.data?.resultMsg || err2.message || 'Failed') }
    finally { setBatchSaving(false) }
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try { await operatorApi.syncStock(); setSyncMsg('Stock levels synchronized with RRA.') }
    catch (err2) { setSyncMsg(`Sync failed: ${err2.message}`) }
    finally { setSyncing(false) }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Stock</span><span>›</span><span>Inventory Count</span></div>
            <h1>Inventory Count</h1>
          </div>
          <button className="btn" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : '↻ Sync from RRA'}
          </button>
        </div>

        {syncMsg && (
          <div style={{ marginBottom: 20, padding: '10px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: 'var(--ok)', fontSize: 13 }}>
            {syncMsg}
          </div>
        )}

        {/* Mode switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[
            { id: 'opening',    label: 'Opening Deposit',   desc: 'First-time stock entry (§9.1 stockTyCd=1)' },
            { id: 'reconcile',  label: 'Reconciliation',    desc: 'Correct stock after physical count (stockTyCd=3)' },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              border: mode === m.id ? '2px solid var(--brand-500)' : '2px solid var(--ink-200)',
              background: mode === m.id ? 'var(--brand-50,#eff6ff)' : 'var(--surface)',
              fontFamily: 'inherit',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: mode === m.id ? 'var(--brand-700)' : 'var(--ink-800)' }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* ── OPENING DEPOSIT (batch, stockTyCd=1) ── */}
        {mode === 'opening' && (
          <div className="card">
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>Opening Deposit</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>
                  Enter your existing stock before your first sale. All entries are sent to EBM as <code>stockTyCd=1</code> (Opening Stock).
                </p>
              </div>
            </div>
            <div className="card__body">
              {batchErr && <div className="settings-error" style={{ marginBottom: 14 }}>{batchErr}</div>}
              {batchOk && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: 'var(--ok)', fontWeight: 600 }}>
                  ✓ Opening deposit registered for {batch.length} items
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 40px', gap: 10, padding: '0 4px', marginBottom: 6 }}>
                  {['Item', 'Opening Qty', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</span>
                  ))}
                </div>

                {batch.map((row, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 40px', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                    {/* Item search */}
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        placeholder="Search item name or code…"
                        value={batchSearch[idx] ?? row.itemName}
                        onChange={e => searchForRow(idx, e.target.value)}
                        autoComplete="off"
                      />
                      {row.itemCode && (
                        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 3, paddingLeft: 2 }}>{row.itemCode}</div>
                      )}
                      {(batchResults[idx] || []).length > 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 8, zIndex: 10, boxShadow: '0 6px 20px rgba(0,0,0,.12)', maxHeight: 200, overflowY: 'auto' }}>
                          {(batchResults[idx] || []).map((it, j) => (
                            <div key={it.id || it.code} onClick={() => selectRowItem(idx, it)} style={{ padding: '9px 12px', cursor: 'pointer', borderTop: j > 0 ? '1px solid var(--ink-100)' : 'none', fontSize: 13 }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              <span style={{ fontWeight: 600 }}>{it.name}</span>
                              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{it.code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      className="form-input input--mono"
                      type="number" min="0" step="0.01"
                      placeholder="0"
                      value={row.quantity}
                      onChange={e => updateRow(idx, 'quantity', e.target.value)}
                      style={{ textAlign: 'center' }}
                    />

                    <button
                      className="btn btn--sm"
                      style={{ padding: 0, width: 36, height: 38, display: 'grid', placeItems: 'center', color: 'var(--err)', borderColor: 'var(--err)', opacity: batch.length === 1 ? 0.3 : 0.7 }}
                      onClick={() => removeRow(idx)}
                      disabled={batch.length === 1}
                      title="Remove row"
                    >✕</button>
                  </div>
                ))}
              </div>

              <button className="btn btn--sm" onClick={addRow} style={{ marginBottom: 20 }}>
                + Add another item
              </button>

              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fefce8', border: '1px solid #fde68a', fontSize: 12.5, color: '#92400e', marginBottom: 20 }}>
                <strong>RRA requirement (§9.1):</strong> Opening deposit must be entered before your first invoice is issued.
                Once any sale is recorded, this action becomes a regular adjustment (stockTyCd=3).
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn--primary" onClick={handleBatch} disabled={batchSaving}>
                  {batchSaving ? 'Registering…' : `Register Opening Deposit (${batch.filter(r => r.itemCode && r.quantity).length} items)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RECONCILIATION (single item, stockTyCd=3) ── */}
        {mode === 'reconcile' && (
          <div className="card">
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>Stock Reconciliation</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>
                  Correct stock level after a physical count. Sent as <code>stockTyCd=3</code> (Manual Adjustment).
                </p>
              </div>
            </div>
            <div className="card__body" style={{ padding: 32 }}>
              {err && <div className="settings-error" style={{ marginBottom: 20 }}>{err}</div>}
              {ok && (
                <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: 'var(--ok)', fontWeight: 600 }}>
                  ✓ Stock level updated
                </div>
              )}

              <form onSubmit={handleSingle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Search item <span style={{ color: 'var(--err)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" placeholder="Type product name or code…"
                        value={search} onChange={e => { setSearch(e.target.value); searchItems(e.target.value, setResults, setFinding) }} />
                      {finding && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--ink-400)' }}>…</div>}
                      {results.length > 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 8, zIndex: 10, boxShadow: '0 6px 20px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto' }}>
                          {results.map((it, i) => (
                            <div key={it.id} onClick={() => { setForm(f => ({ ...f, itemCode: it.code })); setSearch(it.name); setResults([]) }}
                              style={{ padding: '10px 14px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--ink-100)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              <div>
                                <span style={{ fontWeight: 600 }}>{it.name}</span>
                                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{it.code}</span>
                              </div>
                              <span className={`tax-chip tax-${it.taxTypeCode}`}>{it.taxTypeCode}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Item code</label>
                    <input className="form-input input--mono" readOnly value={form.itemCode} placeholder="Select above" style={{ background: 'var(--ink-50)' }} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Actual quantity counted <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input input--mono" type="number" min="0" required
                      value={form.remainQuantity} onChange={e => setForm(f => ({ ...f, remainQuantity: e.target.value }))} />
                  </div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef9c3', border: '1px solid #fde047', fontSize: 12.5, color: '#92400e', marginTop: 8, marginBottom: 24 }}>
                  <strong>Important:</strong> This replaces the current balance in EBM. Use only after a physical stock count confirms a discrepancy.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn--primary btn--lg" style={{ padding: '0 40px' }} disabled={saving || !form.itemCode}>
                    {saving ? 'Updating…' : 'Update Count'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
