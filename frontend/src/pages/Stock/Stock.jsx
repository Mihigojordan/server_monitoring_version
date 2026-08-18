import { useState, useCallback } from 'react'
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

const EMPTY_MOVE = { storedAndReleasedType: '02', originalStoredAndReleaseNo: '', itemCd: '', quantity: '', unitCost: '' }
const EMPTY_MASTER = { itemCode: '', remainQuantity: '' }
const EMPTY_DEPOSIT = { amount: '', reason: 'Opening float' }
const EMPTY_WITHDRAWAL = { amount: '', reason: '' }
const EMPTY_BATCH_ITEM = { itemCd: '', itemNm: '', quantity: '', price: '', discountAmount: '0', taxationType: 'B' }

export default function Stock() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || ''

  const [tab, setTab] = useState('Movement')

  // Batch movement (save_with_items)
  const [batchType,    setBatchType]    = useState('02')
  const [batchRefNo,   setBatchRefNo]   = useState('')
  const [batchItems,   setBatchItems]   = useState([{ ...EMPTY_BATCH_ITEM }])
  const [batchSaving,  setBatchSaving]  = useState(false)
  const [batchErr,     setBatchErr]     = useState(null)
  const [batchOk,      setBatchOk]      = useState(false)

  // Stock movement
  const [moveForm,   setMoveForm]   = useState(EMPTY_MOVE)
  const [moveSaving, setMoveSaving] = useState(false)
  const [moveErr,    setMoveErr]    = useState(null)
  const [moveOk,     setMoveOk]     = useState(false)

  // Stock master
  const [masterForm,   setMasterForm]   = useState(EMPTY_MASTER)
  const [masterSaving, setMasterSaving] = useState(false)
  const [masterErr,    setMasterErr]    = useState(null)
  const [masterOk,     setMasterOk]     = useState(false)

  // Sync
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  // Cash deposit
  const [depositForm,   setDepositForm]   = useState(EMPTY_DEPOSIT)
  const [depositSaving, setDepositSaving] = useState(false)
  const [depositErr,    setDepositErr]    = useState(null)
  const [depositOk,     setDepositOk]     = useState(false)

  // Cash withdrawal
  const [withdrawalForm,   setWithdrawalForm]   = useState(EMPTY_WITHDRAWAL)
  const [withdrawalSaving, setWithdrawalSaving] = useState(false)
  const [withdrawalErr,    setWithdrawalErr]    = useState(null)
  const [withdrawalOk,     setWithdrawalOk]     = useState(false)

  // Cash movements list
  const [cashList,        setCashList]        = useState([])
  const [cashListLoading, setCashListLoading] = useState(false)
  const [cashListDate,    setCashListDate]    = useState(new Date().toISOString().slice(0, 10))

  // Training mode
  const [trainingStatus, setTrainingStatus] = useState(null)
  const [trainingLoading, setTrainingLoading] = useState(false)

  function setMove(k, v)   { setMoveForm(f => ({ ...f, [k]: v })) }
  function setMaster(k, v) { setMasterForm(f => ({ ...f, [k]: v })) }

  function setBatchItem(idx, k, v) {
    setBatchItems(rows => rows.map((r, i) => i === idx ? { ...r, [k]: v } : r))
  }
  function addBatchItem()        { setBatchItems(r => [...r, { ...EMPTY_BATCH_ITEM }]) }
  function removeBatchItem(idx)  { setBatchItems(r => r.filter((_, i) => i !== idx)) }

  const selectedType     = MOVEMENT_TYPES.find(t => t.v === moveForm.storedAndReleasedType)
  const batchSelectedType = MOVEMENT_TYPES.find(t => t.v === batchType)

  async function handleBatchMovement(e) {
    e.preventDefault(); setBatchErr(null); setBatchSaving(true); setBatchOk(false)
    try {
      const payload = {
        storedAndReleasedType: batchType,
        branchId,
        items: batchItems.map(it => ({
          itemCd:         it.itemCd,
          itemNm:         it.itemNm,
          quantity:       Number(it.quantity),
          price:          Number(it.price),
          discountAmount: Number(it.discountAmount || 0),
          taxationType:   it.taxationType,
        })),
      }
      if (batchRefNo) payload.originalStoredAndReleaseNo = batchRefNo
      await operatorApi.saveStockWithItems(payload)
      logActivity({ action: 'STOCK_BATCH', category: 'System', summary: `Batch stock ${batchSelectedType?.dir} — ${batchItems.length} item(s), type ${batchType}` })
      setBatchOk(true)
      setBatchItems([{ ...EMPTY_BATCH_ITEM }])
      setBatchRefNo('')
      setTimeout(() => setBatchOk(false), 3000)
    } catch (err) {
      setBatchErr(err.data?.errors?.[0]?.message || err.message)
      logActivity({ action: 'STOCK_BATCH', category: 'System', summary: `Batch stock movement failed`, status: 'error', detail: err.message })
    } finally { setBatchSaving(false) }
  }

  async function handleMovement(e) {
    e.preventDefault(); setMoveErr(null); setMoveSaving(true); setMoveOk(false)
    try {
      const payload = {
        storedAndReleasedType: moveForm.storedAndReleasedType,
        itemCd: moveForm.itemCd,
        quantity: Number(moveForm.quantity),
        unitCost: Number(moveForm.unitCost),
        branchId,
      }
      if (moveForm.originalStoredAndReleaseNo) payload.originalStoredAndReleaseNo = Number(moveForm.originalStoredAndReleaseNo)
      await operatorApi.saveStock(payload)
      logActivity({ action: 'STOCK_MOVEMENT', category: 'System', summary: `Stock ${selectedType?.dir} — ${selectedType?.l} for item ${moveForm.itemCd} qty ${moveForm.quantity}` })
      setMoveOk(true); setMoveForm(EMPTY_MOVE)
      setTimeout(() => setMoveOk(false), 3000)
    } catch (err) {
      setMoveErr(err.data?.errors?.[0]?.message || err.message)
      logActivity({ action: 'STOCK_MOVEMENT', category: 'System', summary: `Stock movement failed for ${moveForm.itemCd}`, status: 'error', detail: err.message })
    } finally { setMoveSaving(false) }
  }

  async function handleMaster(e) {
    e.preventDefault(); setMasterErr(null); setMasterSaving(true); setMasterOk(false)
    try {
      await operatorApi.saveMaster({
        itemCode: masterForm.itemCode,
        remainQuantity: Number(masterForm.remainQuantity),
        branchId,
      })
      logActivity({ action: 'STOCK_MASTER', category: 'System', summary: `Updated stock master for ${masterForm.itemCode} — qty ${masterForm.remainQuantity}` })
      setMasterOk(true); setMasterForm(EMPTY_MASTER)
      setTimeout(() => setMasterOk(false), 3000)
    } catch (err) {
      setMasterErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setMasterSaving(false) }
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      await operatorApi.syncStock()
      setSyncMsg('Stock levels synced from EBM successfully.')
      logActivity({ action: 'SYNC_STOCK', category: 'System', summary: 'Stock levels synced from EBM' })
    } catch (err) {
      setSyncMsg(`Sync failed: ${err.message}`)
    } finally { setSyncing(false) }
  }

  async function handleDeposit(e) {
    e.preventDefault(); setDepositErr(null); setDepositSaving(true); setDepositOk(false)
    try {
      await operatorApi.deposit({ amount: Number(depositForm.amount), description: depositForm.reason || undefined })
      logActivity({ action: 'CASH_DEPOSIT', category: 'System', summary: `Registered opening deposit of ${Number(depositForm.amount).toLocaleString()} RWF` })
      setDepositOk(true); setDepositForm(EMPTY_DEPOSIT)
      setTimeout(() => setDepositOk(false), 3000)
      loadCashList()
    } catch (err) {
      setDepositErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setDepositSaving(false) }
  }

  async function handleWithdrawal(e) {
    e.preventDefault(); setWithdrawalErr(null); setWithdrawalSaving(true); setWithdrawalOk(false)
    try {
      await operatorApi.withdrawal({ amount: Number(withdrawalForm.amount), description: withdrawalForm.reason || undefined })
      logActivity({ action: 'CASH_WITHDRAWAL', category: 'System', summary: `Registered cash withdrawal of ${Number(withdrawalForm.amount).toLocaleString()} RWF` })
      setWithdrawalOk(true); setWithdrawalForm(EMPTY_WITHDRAWAL)
      setTimeout(() => setWithdrawalOk(false), 3000)
      loadCashList()
    } catch (err) {
      setWithdrawalErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setWithdrawalSaving(false) }
  }

  const loadCashList = useCallback(async () => {
    setCashListLoading(true)
    try {
      const res = await operatorApi.cashList(cashListDate)
      setCashList(Array.isArray(res) ? res : res?.data ?? [])
    } catch { setCashList([]) }
    finally { setCashListLoading(false) }
  }, [cashListDate])

  async function handleToggleTraining() {
    setTrainingLoading(true)
    try {
      const res = await operatorApi.toggleTraining()
      setTrainingStatus(res)
      logActivity({ action: 'TOGGLE_TRAINING', category: 'System', summary: `Training mode ${res.isTrainingMode ? 'activated' : 'deactivated'}` })
    } catch (err) { alert(err.message) }
    finally { setTrainingLoading(false) }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Stock</span></div>
            <h1>Stock &amp; Inventory</h1>
          </div>
          <div className="page-head__actions">
            <button className="btn" onClick={handleSync} disabled={syncing}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {syncing ? 'Syncing…' : 'Sync from EBM'}
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className={`settings-error`} style={{ background: syncMsg.includes('failed') ? undefined : '#f0fdf4', borderColor: syncMsg.includes('failed') ? undefined : '#bbf7d0', color: syncMsg.includes('failed') ? undefined : 'var(--ok)', marginBottom: 16 }}>
            {syncMsg}
          </div>
        )}

        <div className="tab-bar" style={{ marginBottom: 20 }}>
          {['Movement', 'Batch Movement', 'Stock Master', 'Cash', 'Training Mode'].map(t => (
            <button key={t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {/* ── Stock Movement ── */}
        {tab === 'Movement' && (
          <div className="card" style={{ maxWidth: 680 }}>
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>Record Stock Movement</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>Record incoming or outgoing stock movements</p>
              </div>
            </div>
            <div className="card__body">
              {moveErr && <div className="settings-error">{moveErr}</div>}
              {moveOk  && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: 'var(--ok)', marginBottom: 12 }}>✓ Stock movement recorded</div>}
              <form onSubmit={handleMovement}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="moveType">Movement Type</label>
                    <select id="moveType" className="form-input" value={moveForm.storedAndReleasedType} onChange={e => setMove('storedAndReleasedType', e.target.value)}>
                      {MOVEMENT_TYPES.map(t => (
                        <option key={t.v} value={t.v}>{t.v} — {t.l} ({t.dir})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="itemCd">Item Code</label>
                    <input id="itemCd" className="form-input input--mono" required placeholder="RW1BXXXXXXXXXX"
                      value={moveForm.itemCd} onChange={e => setMove('itemCd', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="moveQty">Quantity</label>
                    <input id="moveQty" className="form-input input--mono" type="number" min="1" required
                      value={moveForm.quantity} onChange={e => setMove('quantity', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="unitCost">Unit Cost (RWF)</label>
                    <input id="unitCost" className="form-input input--mono" type="number" min="0" required
                      value={moveForm.unitCost} onChange={e => setMove('unitCost', e.target.value)} />
                  </div>
                  {selectedType?.needsRef && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label" htmlFor="origRef">Original Movement No <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input id="origRef" className="form-input input--mono" required placeholder="Required for return movements"
                        value={moveForm.originalStoredAndReleaseNo} onChange={e => setMove('originalStoredAndReleaseNo', e.target.value)} />
                      <span className="form-hint">Required for types 03 (Incoming Return) and 12 (Outgoing Return)</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn btn--primary" disabled={moveSaving}>{moveSaving ? 'Recording…' : 'Record Movement'}</button>
                  {selectedType && (
                    <span className={`chip ${selectedType.dir === 'IN' ? 'chip--ok' : 'chip--warn'}`}>{selectedType.dir}</span>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Batch Movement ── */}
        {tab === 'Batch Movement' && (
          <div className="card" style={{ maxWidth: 860 }}>
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>Batch Stock Movement</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>POST /stocks/save_with_items — includes tax details per item</p>
              </div>
              {batchSelectedType && (
                <span className={`chip ${batchSelectedType.dir === 'IN' ? 'chip--ok' : 'chip--warn'}`}>{batchSelectedType.dir}</span>
              )}
            </div>
            <div className="card__body">
              {batchErr && <div className="settings-error">{batchErr}</div>}
              {batchOk  && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: 'var(--ok)', marginBottom: 12 }}>✓ Batch movement recorded</div>}
              <form onSubmit={handleBatchMovement}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', marginBottom: 4 }}>
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
                      <input className="form-input input--mono" required placeholder="Reference no. of original movement"
                        value={batchRefNo} onChange={e => setBatchRefNo(e.target.value)} />
                      <span className="form-hint">Required for types 03 and 12 (returns)</span>
                    </div>
                  )}
                </div>

                {/* Items table */}
                <div className="table-wrap" style={{ marginBottom: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th className="num">Qty</th>
                        <th className="num">Price (RWF)</th>
                        <th className="num">Discount</th>
                        <th>Tax</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {batchItems.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            <input className="form-input form-input--sm input--mono" required placeholder="RW1B…"
                              value={row.itemCd} onChange={e => setBatchItem(idx, 'itemCd', e.target.value)} />
                          </td>
                          <td>
                            <input className="form-input form-input--sm" required placeholder="Item name"
                              value={row.itemNm} onChange={e => setBatchItem(idx, 'itemNm', e.target.value)} />
                          </td>
                          <td>
                            <input className="form-input form-input--sm input--mono" required type="number" min="1" style={{ width: 80, textAlign: 'right' }}
                              value={row.quantity} onChange={e => setBatchItem(idx, 'quantity', e.target.value)} />
                          </td>
                          <td>
                            <input className="form-input form-input--sm input--mono" required type="number" min="0" style={{ width: 100, textAlign: 'right' }}
                              value={row.price} onChange={e => setBatchItem(idx, 'price', e.target.value)} />
                          </td>
                          <td>
                            <input className="form-input form-input--sm input--mono" type="number" min="0" style={{ width: 80, textAlign: 'right' }}
                              value={row.discountAmount} onChange={e => setBatchItem(idx, 'discountAmount', e.target.value)} />
                          </td>
                          <td>
                            <select className="form-input form-input--sm" style={{ width: 80 }}
                              value={row.taxationType} onChange={e => setBatchItem(idx, 'taxationType', e.target.value)}>
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                            </select>
                          </td>
                          <td>
                            <button type="button" className="btn btn--sm btn--danger"
                              disabled={batchItems.length === 1}
                              onClick={() => removeBatchItem(idx)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button type="button" className="btn btn--sm" onClick={addBatchItem}>
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                    Add row
                  </button>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{batchItems.length} item{batchItems.length === 1 ? '' : 's'}</span>
                  <button type="submit" className="btn btn--primary" disabled={batchSaving} style={{ marginLeft: 'auto' }}>
                    {batchSaving ? 'Recording…' : 'Record Batch Movement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Stock Master ── */}
        {tab === 'Stock Master' && (
          <div className="card" style={{ maxWidth: 560 }}>
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>Update Stock Master</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>Set current on-hand quantity for EBM stock pre-check</p>
              </div>
            </div>
            <div className="card__body">
              {masterErr && <div className="settings-error">{masterErr}</div>}
              {masterOk  && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: 'var(--ok)', marginBottom: 12 }}>✓ Stock master updated</div>}
              <form onSubmit={handleMaster}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="masterCode">Item Code</label>
                    <input id="masterCode" className="form-input input--mono" required placeholder="RW1BXXXXXXXXXX"
                      value={masterForm.itemCode} onChange={e => setMaster('itemCode', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="remainQty">Remaining Quantity</label>
                    <input id="remainQty" className="form-input input--mono" type="number" min="0" required
                      value={masterForm.remainQuantity} onChange={e => setMaster('remainQuantity', e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button type="submit" className="btn btn--primary" disabled={masterSaving}>{masterSaving ? 'Saving…' : 'Save Stock Master'}</button>
                </div>
              </form>
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--ink-50)', borderRadius: 8, fontSize: 12.5, color: 'var(--ink-600)' }}>
                <b>Note:</b> Services (typeCode 3) do not need a Stock Master entry — the EBM pre-check skips them automatically.
              </div>
            </div>
          </div>
        )}

        {/* ── Cash ── */}
        {tab === 'Cash' && (
          <div style={{ display: 'grid', gap: 20, maxWidth: 680 }}>

            {/* Deposit */}
            <div className="card">
              <div className="card__head">
                <h3 style={{ margin: 0 }}>Register Opening Deposit</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>Register opening cash before the first sale of the day</p>
              </div>
              <div className="card__body">
                {depositErr && <div className="settings-error">{depositErr}</div>}
                {depositOk  && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: 'var(--ok)', marginBottom: 12 }}>✓ Opening deposit registered</div>}
                <form onSubmit={handleDeposit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, flex: '1 1 160px' }}>
                    <label className="form-label" htmlFor="depAmount">Amount (RWF) *</label>
                    <input id="depAmount" className="form-input input--mono" type="number" min="0.01" step="0.01" required placeholder="50000"
                      value={depositForm.amount} onChange={e => setDepositForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: '2 1 200px' }}>
                    <label className="form-label" htmlFor="depDesc">Description (optional)</label>
                    <input id="depDesc" className="form-input" placeholder="Opening float"
                      value={depositForm.reason} onChange={e => setDepositForm(f => ({ ...f, reason: e.target.value }))} />
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={depositSaving}>{depositSaving ? 'Registering…' : 'Register Deposit'}</button>
                </form>
              </div>
            </div>

            {/* Withdrawal */}
            <div className="card">
              <div className="card__head">
                <h3 style={{ margin: 0 }}>Cash Withdrawal</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>Record a cash withdrawal from the register</p>
              </div>
              <div className="card__body">
                {withdrawalErr && <div className="settings-error">{withdrawalErr}</div>}
                {withdrawalOk  && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: 'var(--ok)', marginBottom: 12 }}>✓ Withdrawal registered</div>}
                <form onSubmit={handleWithdrawal} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, flex: '1 1 160px' }}>
                    <label className="form-label" htmlFor="wdAmount">Amount (RWF) *</label>
                    <input id="wdAmount" className="form-input input--mono" type="number" min="0.01" step="0.01" required placeholder="10000"
                      value={withdrawalForm.amount} onChange={e => setWithdrawalForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: '2 1 200px' }}>
                    <label className="form-label" htmlFor="wdDesc">Description (optional)</label>
                    <input id="wdDesc" className="form-input" placeholder="Reason for withdrawal"
                      value={withdrawalForm.reason} onChange={e => setWithdrawalForm(f => ({ ...f, reason: e.target.value }))} />
                  </div>
                  <button type="submit" className="btn btn--primary" disabled={withdrawalSaving}>{withdrawalSaving ? 'Registering…' : 'Register Withdrawal'}</button>
                </form>
              </div>
            </div>

            {/* Cash movements list */}
            <div className="card">
              <div className="card__head">
                <h3>Cash Movements</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="date" className="form-input form-input--sm" value={cashListDate}
                    onChange={e => setCashListDate(e.target.value)} />
                  <button className="btn btn--sm" onClick={loadCashList} disabled={cashListLoading}>
                    {cashListLoading ? 'Loading…' : 'Load'}
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                {cashList.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>
                    No cash movements for this date. Click Load to fetch.
                  </div>
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th className="num">Amount (RWF)</th>
                        <th>Description</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashList.map((m, i) => (
                        <tr key={m.id || i}>
                          <td>
                            {m.movementType === 'DEPOSIT'
                              ? <span className="chip chip--ok">Deposit</span>
                              : <span className="chip chip--warn">Withdrawal</span>
                            }
                          </td>
                          <td className="num" style={{ fontWeight: 600 }}>{Number(m.amount || 0).toLocaleString()}</td>
                          <td style={{ color: 'var(--ink-600)', fontSize: 13 }}>{m.description || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>
                            {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : m.occurredDt || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Training Mode ── */}
        {tab === 'Training Mode' && (
          <div className="card" style={{ maxWidth: 560 }}>
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>Training Mode</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>Test sales without fiscal impact</p>
              </div>
            </div>
            <div className="card__body">
              {trainingStatus && (
                <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: trainingStatus.isTrainingMode ? '#fef3c7' : '#f0fdf4', border: `1px solid ${trainingStatus.isTrainingMode ? '#fde68a' : '#bbf7d0'}` }}>
                  <div style={{ fontWeight: 700, color: trainingStatus.isTrainingMode ? '#92400e' : 'var(--ok)' }}>
                    {trainingStatus.isTrainingMode ? '⚠ Training mode is ACTIVE' : '✓ Training mode is OFF — live mode active'}
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--ink-600)' }}>{trainingStatus.message}</div>
                </div>
              )}
              <div style={{ fontSize: 13.5, color: 'var(--ink-700)', marginBottom: 16, lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 8px' }}>When training mode is <b>ON</b>:</p>
                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-600)' }}>
                  <li>Normal sales are <b>blocked</b> — use the Training tab in Invoices instead</li>
                  <li>Use the Training tab in Invoices to issue TS receipts</li>
                  <li>Training counters are tracked separately from live counters</li>
                </ul>
                <p style={{ margin: '8px 0 0' }}>When training mode is <b>OFF</b>: live fiscal sales are active.</p>
              </div>
              <button className="btn btn--primary" onClick={handleToggleTraining} disabled={trainingLoading}>
                {trainingLoading ? 'Toggling…' : 'Toggle Training Mode'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
