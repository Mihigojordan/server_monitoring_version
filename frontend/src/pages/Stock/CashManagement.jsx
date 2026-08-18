import { useState, useCallback, useEffect } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'

const EMPTY_DEPOSIT = { amount: '', reason: 'Opening float' }
const EMPTY_WITHDRAWAL = { amount: '', reason: '' }

export default function CashManagement() {
  const [depositForm,   setDepositForm]   = useState(EMPTY_DEPOSIT)
  const [depositSaving, setDepositSaving] = useState(false)
  const [depositErr,    setDepositErr]    = useState(null)
  const [depositOk,     setDepositOk]     = useState(false)

  const [withdrawalForm,   setWithdrawalForm]   = useState(EMPTY_WITHDRAWAL)
  const [withdrawalSaving, setWithdrawalSaving] = useState(false)
  const [withdrawalErr,    setWithdrawalErr]    = useState(null)
  const [withdrawalOk,     setWithdrawalOk]     = useState(false)

  const [cashList,        setCashList]        = useState([])
  const [netBalance,      setNetBalance]      = useState(0)
  const [allTimeBalance,  setAllTimeBalance]  = useState(0)
  const [cashListLoading, setCashListLoading] = useState(false)
  const [cashListDate,    setCashListDate]    = useState(new Date().toISOString().slice(0, 10))
  const [voidingId,       setVoidingId]       = useState(null)
  const [dayClose,        setDayClose]        = useState(null)
  const [exporting,       setExporting]       = useState(false)

  // Filter the currently-loaded day's list — no need to round-trip to the
  // server for this, one day's movements is a small, already-fetched set.
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'DEPOSIT' | 'WITHDRAWAL'
  const [searchQuery, setSearchQuery] = useState('')

  const [voidTarget, setVoidTarget] = useState(null) // movement being voided, or null
  const [voidReason, setVoidReason] = useState('')
  const [voidErr,    setVoidErr]    = useState(null)

  const [closeOpen,    setCloseOpen]    = useState(false)
  const [closeCounted, setCloseCounted] = useState('')
  const [closeNote,    setCloseNote]    = useState('')
  const [closeSaving,  setCloseSaving]  = useState(false)
  const [closeErr,     setCloseErr]     = useState(null)

  const loadCashList = useCallback(async () => {
    setCashListLoading(true)
    try {
      const res = await operatorApi.cashList(cashListDate)
      const list = Array.isArray(res) ? res : res?.data ?? []
      setCashList(list)
      // Prefer the server-computed net (deposits minus withdrawals, voided
      // entries excluded) — falling back to a client-side equivalent only if
      // an older/unexpected response shape ever shows up. Never sum raw
      // amounts regardless of type — that was the original bug.
      setNetBalance(typeof res?.netBalance === 'number'
        ? res.netBalance
        : list.reduce((acc, m) => m.isVoided ? acc : acc + (m.movementType === 'DEPOSIT' ? Number(m.amount) : -Number(m.amount)), 0))
      setAllTimeBalance(typeof res?.allTimeBalance === 'number' ? res.allTimeBalance : 0)
      setDayClose(res?.dayClose ?? null)
    } catch { setCashList([]); setNetBalance(0); setAllTimeBalance(0); setDayClose(null) }
    finally { setCashListLoading(false) }
  }, [cashListDate])

  useEffect(() => { loadCashList() }, [loadCashList])

  async function handleDeposit(e) {
    e.preventDefault(); setDepositErr(null); setDepositSaving(true); setDepositOk(false)
    try {
      await operatorApi.deposit({ amount: Number(depositForm.amount), description: depositForm.reason || undefined })
      logActivity({ action: 'CASH_DEPOSIT', category: 'System', summary: `Opening deposit of ${Number(depositForm.amount).toLocaleString()} RWF` })
      setDepositOk(true); setDepositForm(EMPTY_DEPOSIT); loadCashList()
      setTimeout(() => setDepositOk(false), 5000)
    } catch (err) { setDepositErr(err.data?.errors?.[0]?.message || err.message) }
    finally { setDepositSaving(false) }
  }

  async function handleWithdrawal(e) {
    e.preventDefault(); setWithdrawalErr(null); setWithdrawalSaving(true); setWithdrawalOk(false)
    try {
      await operatorApi.withdrawal({ amount: Number(withdrawalForm.amount), description: withdrawalForm.reason || undefined })
      logActivity({ action: 'CASH_WITHDRAWAL', category: 'System', summary: `Withdrawal of ${Number(withdrawalForm.amount).toLocaleString()} RWF` })
      setWithdrawalOk(true); setWithdrawalForm(EMPTY_WITHDRAWAL); loadCashList()
      setTimeout(() => setWithdrawalOk(false), 5000)
    } catch (err) { setWithdrawalErr(err.data?.errors?.[0]?.message || err.message) }
    finally { setWithdrawalSaving(false) }
  }

  function openVoid(movement) {
    setVoidTarget(movement)
    setVoidReason('')
    setVoidErr(null)
  }

  async function confirmVoid(e) {
    e.preventDefault()
    setVoidErr(null); setVoidingId(voidTarget.id)
    try {
      await operatorApi.voidCashMovement(voidTarget.id, voidReason || undefined)
      logActivity({ action: 'CASH_VOID', category: 'System', summary: `Voided ${voidTarget.movementType.toLowerCase()} of ${Number(voidTarget.amount).toLocaleString()} RWF` })
      setVoidTarget(null)
      loadCashList()
    } catch (err) {
      setVoidErr(err.data?.error || err.message)
    } finally {
      setVoidingId(null)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      await operatorApi.exportCash(cashListDate)
      logActivity({ action: 'CASH_EXPORT', category: 'System', summary: `Exported cash movements for ${cashListDate}` })
    } catch (err) {
      alert(err.data?.error || err.message)
    } finally {
      setExporting(false)
    }
  }

  function openCloseDay() {
    setCloseCounted('')
    setCloseNote('')
    setCloseErr(null)
    setCloseOpen(true)
  }

  async function confirmCloseDay(e) {
    e.preventDefault()
    setCloseErr(null); setCloseSaving(true)
    try {
      const result = await operatorApi.closeCashDay(cashListDate, Number(closeCounted), closeNote || undefined)
      logActivity({ action: 'CASH_DAY_CLOSE', category: 'System', summary: `Closed cash day ${cashListDate} — variance ${Number(result.variance).toLocaleString()} RWF` })
      setCloseOpen(false)
      loadCashList()
    } catch (err) {
      setCloseErr(err.data?.error || err.message)
    } finally {
      setCloseSaving(false)
    }
  }

  const closePreviewVariance = closeCounted !== '' ? Number(closeCounted) - netBalance : null

  const filteredCashList = cashList.filter(m => {
    if (typeFilter !== 'all' && m.movementType !== typeFilter) return false
    if (searchQuery && !(m.description || '').toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <AppShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Workspace</span><span>›</span><span>Finance</span></div>
            <h1>Cash Management</h1>
          </div>
        </div>

        <div className="kpi-grid">
           <div className="kpi">
              <div className="kpi__label">Net Cash Balance</div>
              <div className="kpi__value" style={{ color: netBalance < 0 ? 'var(--err)' : 'inherit' }}>{netBalance.toLocaleString()} RWF</div>
              <span className="kpi__sub">Deposits minus withdrawals for this date (voided entries excluded)</span>
           </div>
           <div className="kpi">
              <div className="kpi__label">All-Time Cash Balance</div>
              <div className="kpi__value" style={{ color: allTimeBalance < 0 ? 'var(--err)' : 'inherit' }}>{allTimeBalance.toLocaleString()} RWF</div>
              <span className="kpi__sub">Every deposit and withdrawal ever recorded (voided entries excluded)</span>
           </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="card">
            <div className="card__head"><h3>Opening Deposit</h3></div>
            <div className="card__body">
              {depositErr && <div className="settings-error" style={{ marginBottom: 16 }}>{depositErr}</div>}
              {depositOk  && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, color: 'var(--ok)', marginBottom: 16 }}>✓ Registered successfully</div>}
              <form onSubmit={handleDeposit}>
                 <div className="form-group">
                   <label className="form-label">Amount (RWF)</label>
                   <input className="form-input mono" type="number" required value={depositForm.amount} onChange={e => setDepositForm({...depositForm, amount: e.target.value})} />
                 </div>
                 <div className="form-group">
                   <label className="form-label">Description</label>
                   <input className="form-input" value={depositForm.reason} onChange={e => setDepositForm({...depositForm, reason: e.target.value})} />
                 </div>
                 <button type="submit" className="btn btn--primary btn--block" disabled={depositSaving}>{depositSaving ? 'Registering...' : 'Register Deposit'}</button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card__head"><h3>Cash Withdrawal</h3></div>
            <div className="card__body">
              {withdrawalErr && <div className="settings-error" style={{ marginBottom: 16 }}>{withdrawalErr}</div>}
              {withdrawalOk  && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, color: 'var(--ok)', marginBottom: 16 }}>✓ Registered successfully</div>}
              <form onSubmit={handleWithdrawal}>
                 <div className="form-group">
                   <label className="form-label">Amount (RWF)</label>
                   <input className="form-input mono" type="number" required value={withdrawalForm.amount} onChange={e => setWithdrawalForm({...withdrawalForm, amount: e.target.value})} />
                 </div>
                 <div className="form-group">
                   <label className="form-label">Description</label>
                   <input className="form-input" value={withdrawalForm.reason} onChange={e => setWithdrawalForm({...withdrawalForm, reason: e.target.value})} />
                 </div>
                 <button type="submit" className="btn btn--primary btn--block" disabled={withdrawalSaving}>{withdrawalSaving ? 'Registering...' : 'Register Withdrawal'}</button>
              </form>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__head" style={{ flexWrap: 'wrap', gap: 12 }}>
            <h3>Recent Movements</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" className="form-input form-input--sm" style={{ width: 140 }} value={cashListDate} onChange={e => setCashListDate(e.target.value)} />
              <select className="form-input form-input--sm" style={{ width: 130 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                <option value="DEPOSIT">Deposits</option>
                <option value="WITHDRAWAL">Withdrawals</option>
              </select>
              <input className="form-input form-input--sm" style={{ width: 160 }} placeholder="Search description…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <button className="btn btn--sm btn--ghost" onClick={handleExport} disabled={exporting || cashList.length === 0}>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
              <button className="btn btn--sm btn--primary" onClick={openCloseDay}>
                {dayClose ? 'Re-close Day' : 'Close Day'}
              </button>
            </div>
          </div>

          {dayClose && (
            <div style={{
              margin: '0 20px', marginTop: 16, padding: '12px 16px', borderRadius: 10,
              background: Math.abs(dayClose.variance) < 0.01 ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${Math.abs(dayClose.variance) < 0.01 ? '#bbf7d0' : '#fde68a'}`,
              fontSize: 13, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <span>
                <strong>Day closed</strong> — expected {Number(dayClose.expectedBalance).toLocaleString()} RWF,
                counted {Number(dayClose.countedAmount).toLocaleString()} RWF
                {dayClose.createdByName ? ` by ${dayClose.createdByName}` : ''}
              </span>
              <span style={{ fontWeight: 700, color: Math.abs(dayClose.variance) < 0.01 ? 'var(--ok)' : '#92400e' }}>
                Variance: {dayClose.variance > 0 ? '+' : ''}{Number(dayClose.variance).toLocaleString()} RWF
              </span>
            </div>
          )}

          <div className="table-wrap">
            {filteredCashList.length === 0 ? (
               <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-400)' }}>
                 {cashList.length === 0 ? 'No movements found for this date.' : 'No movements match this filter.'}
               </div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="num">Amount (RWF)</th>
                    <th>Description</th>
                    <th>Recorded By</th>
                    <th>Time</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredCashList.map((m, i) => (
                    <tr key={i} style={m.isVoided ? { opacity: 0.5 } : undefined}>
                      <td>
                        <span className={`chip ${m.movementType === 'DEPOSIT' ? 'chip--ok' : 'chip--warn'}`}>{m.movementType}</span>
                        {m.isVoided && <span className="chip chip--err" style={{ marginLeft: 6 }} title={m.voidReason || undefined}>VOIDED</span>}
                      </td>
                      <td className="num" style={{ fontWeight: 700, textDecoration: m.isVoided ? 'line-through' : 'none' }}>{Number(m.amount || 0).toLocaleString()}</td>
                      <td>{m.description || '—'}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{m.createdByName || '—'}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{new Date(m.createdAt).toLocaleTimeString()}</td>
                      <td>
                        {!m.isVoided && (
                          <button className="btn btn--sm btn--ghost btn--danger" disabled={voidingId === m.id} onClick={() => openVoid(m)}>
                            {voidingId === m.id ? 'Voiding...' : 'Void'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Void confirmation modal */}
      {voidTarget && (
        <div className="modal-backdrop" onClick={() => !voidingId && setVoidTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal__head">
              <h3 style={{ margin: 0 }}>Void Movement</h3>
              <button className="modal__close" onClick={() => setVoidTarget(null)}>✕</button>
            </div>
            <div className="modal__body">
              {voidErr && <div className="settings-error" style={{ marginBottom: 16 }}>{voidErr}</div>}

              <div style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`chip ${voidTarget.movementType === 'DEPOSIT' ? 'chip--ok' : 'chip--warn'}`}>{voidTarget.movementType}</span>
                  <span style={{ fontWeight: 800, fontSize: 18 }}>{Number(voidTarget.amount).toLocaleString()} RWF</span>
                </div>
                {voidTarget.description && <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 8 }}>{voidTarget.description}</div>}
              </div>

              <form onSubmit={confirmVoid}>
                <div className="form-group">
                  <label className="form-label">Reason (optional)</label>
                  <textarea className="form-input" rows={2} value={voidReason} maxLength={400}
                    onChange={e => setVoidReason(e.target.value)} placeholder="Why is this being voided?" autoFocus />
                </div>

                <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 20 }}>
                  This won't delete the entry — it stays visible, marked as voided, and is excluded from your cash balance.
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setVoidTarget(null)} disabled={!!voidingId}>Cancel</button>
                  <button type="submit" className="btn btn--danger" disabled={!!voidingId}>{voidingId ? 'Voiding...' : 'Void Movement'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Close Day / reconciliation modal */}
      {closeOpen && (
        <div className="modal-backdrop" onClick={() => !closeSaving && setCloseOpen(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal__head">
              <h3 style={{ margin: 0 }}>Close Day — {cashListDate}</h3>
              <button className="modal__close" onClick={() => setCloseOpen(false)}>✕</button>
            </div>
            <div className="modal__body">
              {closeErr && <div className="settings-error" style={{ marginBottom: 16 }}>{closeErr}</div>}

              <div style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--ink-500)' }}>Expected balance (system)</span>
                  <span style={{ fontWeight: 700 }}>{netBalance.toLocaleString()} RWF</span>
                </div>
              </div>

              <form onSubmit={confirmCloseDay}>
                <div className="form-group">
                  <label className="form-label">Physically Counted Cash (RWF)</label>
                  <input className="form-input mono" type="number" required step="any" value={closeCounted}
                    onChange={e => setCloseCounted(e.target.value)} autoFocus />
                </div>

                {closePreviewVariance !== null && (
                  <div style={{
                    marginBottom: 16, fontSize: 13, fontWeight: 700,
                    color: Math.abs(closePreviewVariance) < 0.01 ? 'var(--ok)' : 'var(--err)',
                  }}>
                    Variance: {closePreviewVariance > 0 ? '+' : ''}{closePreviewVariance.toLocaleString()} RWF
                    {Math.abs(closePreviewVariance) < 0.01 ? ' (matches)' : closePreviewVariance > 0 ? ' (over)' : ' (short)'}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Note (optional)</label>
                  <textarea className="form-input" rows={2} value={closeNote} maxLength={400}
                    onChange={e => setCloseNote(e.target.value)} placeholder="Explain any variance…" />
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn--ghost" onClick={() => setCloseOpen(false)} disabled={closeSaving}>Cancel</button>
                  <button type="submit" className="btn btn--primary" disabled={closeSaving || closeCounted === ''}>
                    {closeSaving ? 'Closing...' : 'Confirm Close'}
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
