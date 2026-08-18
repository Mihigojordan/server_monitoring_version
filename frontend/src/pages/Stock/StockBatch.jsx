import { useState } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import { useApp } from '../../context/AppContext'

const MOVEMENT_TYPES = [
  { v: '01', l: 'Incoming Import',         dir: 'IN' },
  { v: '02', l: 'Incoming Purchase',        dir: 'IN' },
  { v: '03', l: 'Incoming Return',          dir: 'IN',  needsRef: true },
  { v: '04', l: 'Incoming Stock Movement',  dir: 'IN' },
  { v: '05', l: 'Incoming Processing',      dir: 'IN' },
  { v: '06', l: 'Incoming Adjustment',      dir: 'IN' },
  { v: '11', l: 'Outgoing Sale',            dir: 'OUT' },
  { v: '12', l: 'Outgoing Return',          dir: 'OUT', needsRef: true },
  { v: '13', l: 'Outgoing Stock Movement',  dir: 'OUT' },
  { v: '14', l: 'Outgoing Processing',      dir: 'OUT' },
  { v: '15', l: 'Outgoing Discarding',      dir: 'OUT' },
  { v: '16', l: 'Outgoing Adjustment',      dir: 'OUT' },
]

// Field names here must match saveStockWithItemsValidator's item schema
// (code/name/classificationCode/packageUnit/quantityUnit) — the backend has
// no itemCd/itemNm aliases, and classificationCode/packageUnit/quantityUnit
// are required, not optional.
const EMPTY_BATCH_ITEM = {
  code: '', name: '', classificationCode: '', barcode: '',
  packageUnit: 'CT', packageNo: 1, quantityUnit: 'U',
  quantity: '', price: '', discountAmount: '0', taxationType: 'B',
}

export default function StockBatch() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || ''

  const [batchType,    setBatchType]    = useState('02')
  const [batchRefNo,   setBatchRefNo]   = useState('')
  const [batchItems,   setBatchItems]   = useState([{ ...EMPTY_BATCH_ITEM }])
  const [batchSaving,  setBatchSaving]  = useState(false)
  const [batchErr,     setBatchErr]     = useState(null)
  const [batchOk,      setBatchOk]      = useState(false)

  const batchSelectedType = MOVEMENT_TYPES.find(t => t.v === batchType)

  const [searching,  setSearching]  = useState(null) // index of row being searched
  const [itemList,   setItemList]   = useState([])

  async function searchItems(idx, q) {
    if (!q || q.length < 2) { setItemList([]); return }
    setSearching(idx)
    try {
      const res = await operatorApi.searchItems(q, 1, 10)
      setItemList(res?.data || res?.items?.data || [])
    } catch { setItemList([]) }
    finally { setSearching(null) }
  }

  function setBatchItem(idx, k, v) {
    setBatchItems(rows => rows.map((r, i) => i === idx ? { ...r, [k]: v } : r))
  }
  function addBatchItem()        { setBatchItems(r => [...r, { ...EMPTY_BATCH_ITEM }]) }
  function removeBatchItem(idx)  { setBatchItems(r => r.filter((_, i) => i !== idx)) }

  async function handleBatchMovement(e) {
    e.preventDefault(); setBatchErr(null); setBatchOk(false)

    // A row nobody touched (e.g. "Add Another Item" clicked but never filled
    // in) is just a blank scratch row — drop it instead of blocking the whole
    // batch over it.
    const activeRows = batchItems.filter(it => it.name || it.code || it.quantity || it.price)
    if (activeRows.length === 0) {
      setBatchErr('Add at least one item to the batch.')
      return
    }

    const unresolved = activeRows.findIndex(it => !it.code)
    if (unresolved !== -1) {
      setBatchErr(`Row ${unresolved + 1}: pick a product from the search results — typing a name alone isn't enough.`)
      return
    }

    setBatchSaving(true)
    try {
      const payload = {
        storedAndReleasedType: batchType,
        branchId,
        items: activeRows.map(it => ({
          code:               it.code,
          name:               it.name,
          classificationCode: it.classificationCode,
          barcode:            it.barcode || undefined,
          packageUnit:        it.packageUnit,
          packageNo:          Number(it.packageNo || 1),
          quantityUnit:       it.quantityUnit,
          quantity:           Number(it.quantity),
          price:              Number(it.price),
          discountAmount:     Number(it.discountAmount || 0),
          taxationType:       it.taxationType,
        })),
      }
      if (batchRefNo) payload.originalStoredAndReleaseNo = batchRefNo
      await operatorApi.saveStockWithItems(payload)
      logActivity({ action: 'STOCK_BATCH', category: 'Inventory', summary: `Batch ${batchSelectedType?.dir} recorded` })
      setBatchOk(true); setBatchItems([{ ...EMPTY_BATCH_ITEM }]); setBatchRefNo('')
      setTimeout(() => setBatchOk(false), 5000)
    } catch (err) {
      setBatchErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setBatchSaving(false) }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Workspace</span><span>›</span><span>Stock</span></div>
            <h1>Batch Operations</h1>
          </div>
        </div>

        <div className="card">
          <div className="card__head">
             <div>
               <h3 style={{ margin: 0 }}>Record Multiple Items</h3>
               <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink-500)' }}>Search and add multiple items to one movement</p>
             </div>
             {batchSelectedType && <span className={`chip ${batchSelectedType.dir === 'IN' ? 'chip--ok' : 'chip--warn'}`}>{batchSelectedType.dir}</span>}
          </div>
          <div className="card__body" style={{ padding: 32 }}>
            {batchErr && <div className="settings-error" style={{ marginBottom: 24 }}>{batchErr}</div>}
            {batchOk  && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, color: 'var(--ok)', marginBottom: 24, fontWeight: 600 }}>✓ Batch operation recorded successfully</div>}

            <form onSubmit={handleBatchMovement}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px', marginBottom: 24 }}>
                <div className="form-group">
                  <label className="form-label">Movement Type</label>
                  <select className="form-input" value={batchType} onChange={e => setBatchType(e.target.value)}>
                    {MOVEMENT_TYPES.map(t => (
                      <option key={t.v} value={t.v}>{t.v} — {t.l} ({t.dir})</option>
                    ))}
                  </select>
                </div>
                {batchSelectedType?.needsRef && (
                  <div className="form-group">
                    <label className="form-label">Original Movement No <span style={{ color: 'var(--err)' }}>*</span></label>
                    <input className="form-input mono" required value={batchRefNo} onChange={e => setBatchRefNo(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="table-wrap" style={{ borderRadius: 12, border: '1px solid var(--ink-200)', marginBottom: 24, overflow: 'visible' }}>
                <table className="data" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Product Search</th>
                      <th>Code</th>
                      <th className="num">Qty</th>
                      <th className="num">Price</th>
                      <th>Tax</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {batchItems.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ position: 'relative' }}>
                          <input className="form-input form-input--sm" placeholder="Search item..."
                            value={row.name}
                            onChange={e => {
                               setBatchItem(idx, 'name', e.target.value)
                               setBatchItem(idx, 'code', '') // typing invalidates a previous pick — must select from the list
                               searchItems(idx, e.target.value)
                            }} />
                          {searching === idx && <div className="spinner-sm" style={{ position: 'absolute', right: 10, top: 10 }} />}

                          {searching === null && itemList.length > 0 && row.name.length >= 2 && (
                            <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--ink-200)' }}>
                               {itemList.map(it => (
                                 <div key={it.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--ink-50)' }}
                                   onClick={() => {
                                      setBatchItem(idx, 'name', it.name)
                                      setBatchItem(idx, 'code', it.code)
                                      setBatchItem(idx, 'classificationCode', it.classificationCode)
                                      setBatchItem(idx, 'barcode', it.barcode || '')
                                      setBatchItem(idx, 'packageUnit', it.packagingUnitCode || 'CT')
                                      setBatchItem(idx, 'quantityUnit', it.quantityUnitCode || 'U')
                                      setBatchItem(idx, 'price', it.defaultUnitPrice)
                                      setBatchItem(idx, 'taxationType', it.taxTypeCode)
                                      setItemList([])
                                   }}>
                                   <div style={{ fontWeight: 600 }}>{it.name}</div>
                                   <div className="mono" style={{ fontSize: 10 }}>{it.code}</div>
                                 </div>
                               ))}
                            </div>
                          )}
                        </td>
                        <td className="mono" style={{ fontSize: 11 }}>{row.code || '---'}</td>
                        <td><input className="form-input form-input--sm num mono" required type="number" min="1" style={{ width: 80 }} value={row.quantity} onChange={e => setBatchItem(idx, 'quantity', e.target.value)} /></td>
                        <td><input className="form-input form-input--sm num mono" required type="number" min="0" style={{ width: 100 }} value={row.price} onChange={e => setBatchItem(idx, 'price', e.target.value)} /></td>
                        <td>
                          <select className="form-input form-input--sm" value={row.taxationType} onChange={e => setBatchItem(idx, 'taxationType', e.target.value)}>
                            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                          </select>
                        </td>
                        <td><button type="button" className="btn btn--sm btn--ghost btn--danger" disabled={batchItems.length === 1} onClick={() => removeBatchItem(idx)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="button" className="btn btn--ghost" onClick={addBatchItem}>Add Another Item</button>
                <div style={{ flex: 1 }} />
                <button type="submit" className="btn btn--lg btn--primary" style={{ padding: '0 40px' }} disabled={batchSaving}>
                   {batchSaving ? 'Processing...' : 'Record Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
