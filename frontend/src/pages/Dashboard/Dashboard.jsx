import { useState, useEffect } from 'react'
import AppShell from '../../components/layout/AppShell'
import { useApp } from '../../context/AppContext'
import { authApi } from '../../api/auth'
import { operatorApi } from '../../api/operator'
import StatTile from '../../components/charts/StatTile'
import TrendChart from '../../components/charts/TrendChart'
import DonutChart from '../../components/charts/DonutChart'
import BarChart from '../../components/charts/BarChart'
import { compactNumber, formatRwf } from '../../components/charts/format'

const PAYMENT_LABELS = {
  '01': 'Cash', '02': 'Credit', '03': 'Cash/Credit', '04': 'Bank Cheque',
  '05': 'Debit/Credit Card', '06': 'Mobile Money', '07': 'Other',
}
// Fixed code → categorical slot, so a given type always reads the same
// color regardless of what else is present that day (never re-cycled).
const PAYMENT_COLORS = {
  '01': 'var(--viz-series-1)', '02': 'var(--viz-series-2)', '03': 'var(--viz-series-3)',
  '04': 'var(--viz-series-4)', '05': 'var(--viz-series-5)', '06': 'var(--viz-series-6)', '07': 'var(--viz-series-7)',
}
const SALE_TYPE_LABELS = {
  NS: 'Normal Sale', TS: 'Training Sale', PS: 'Proforma', NR: 'Refund',
  CS: 'Copy Sale', CR: 'Copy Refund', TR: 'Training Refund', PR: 'Proforma Refund',
}
const SALE_TYPE_COLORS = {
  NS: 'var(--viz-series-1)', PS: 'var(--viz-series-2)', TS: 'var(--viz-series-3)',
  NR: 'var(--viz-series-8)', CS: 'var(--viz-series-7)', CR: 'var(--viz-series-6)',
  TR: 'var(--viz-series-5)', PR: 'var(--viz-series-4)',
}
const TAX_LABELS = { A: 'A · Exempt', B: 'B · Standard 18%', C: 'C · Zero-rated', D: 'D · Non-VAT' }
const TAX_COLORS = { A: 'var(--viz-series-1)', B: 'var(--viz-series-2)', C: 'var(--viz-series-3)', D: 'var(--viz-series-4)' }

function ReconnectButton({ onSuccess }) {
  const [status, setStatus] = useState('idle')
  const [msg, setMsg] = useState('')

  async function handleReconnect() {
    setStatus('loading')
    setMsg('')
    try {
      const res = await operatorApi.ebmReconnect()
      if (res.reconnected) {
        setStatus('ok')
        setMsg('EBM reconnected — sales unblocked.')
        onSuccess()
      } else {
        setStatus('error')
        setMsg(res.error || 'EBM is still unreachable.')
      }
    } catch (err) {
      setStatus('error')
      setMsg(err.message || 'Reconnect failed.')
    }
  }

  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        className="btn btn--danger"
        onClick={handleReconnect}
        disabled={status === 'loading'}
        style={{ fontSize: 13, padding: '7px 14px' }}
      >
        {status === 'loading' ? (
          <>
            <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" style={{ marginRight: 6 }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            Reconnecting…
          </>
        ) : 'Reconnect EBM'}
      </button>
      {msg && (
        <span style={{ fontSize: 12.5, color: status === 'ok' ? '#15803d' : '#b91c1c' }}>{msg}</span>
      )}
    </div>
  )
}

function InitBanner({ onSuccess }) {
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleInit() {
    setStatus('loading')
    setErrorMsg('')
    try {
      await authApi.initDevice()
      setStatus('idle')
      onSuccess()
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message || 'Initialization failed. Please try again.')
    }
  }

  return (
    <div className="init-banner">
      <div className="init-banner__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
          <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="init-banner__body">
        <div className="init-banner__title">Device not initialized</div>
        <div className="init-banner__desc">
          Your device has not been registered with the RRA EBM server yet.
          Initialize it to activate invoicing, purchases, and stock management.
        </div>
        {status === 'error' && <div className="init-banner__error">{errorMsg}</div>}
      </div>
      <button
        className="btn btn--primary"
        onClick={handleInit}
        disabled={status === 'loading'}
        style={{ flexShrink: 0 }}
      >
        {status === 'loading' ? (
          <>
            <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            Initializing…
          </>
        ) : 'Initialize Device'}
      </button>
    </div>
  )
}

function CounterCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, marginTop: 4, color: color || 'var(--ink-900)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function NoticeCard({ notice, index }) {
  const [open, setOpen] = useState(index === 0)
  const date = notice.date ? new Date(notice.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null

  return (
    <div style={{ borderBottom: '1px solid var(--ink-150)', padding: '12px 0' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          all: 'unset', cursor: 'pointer', display: 'flex', width: '100%',
          justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink-900)', lineHeight: 1.4 }}>{notice.title || 'Notice'}</div>
          {date && <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 2 }}>{date}</div>}
        </div>
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"
          style={{ flexShrink: 0, color: 'var(--ink-400)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', marginTop: 2 }}>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
        </svg>
      </button>
      {open && notice.content && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {notice.content}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { rawUser, refreshUser } = useApp()
  const isInitialized = rawUser?.ebmInitialized === true

  const [counters,        setCounters]        = useState(null)
  const [countersErr,     setCountersErr]     = useState(null)
  const [notices,         setNotices]         = useState([])
  const [noticesLoading,  setNoticesLoading]  = useState(false)
  const [noticesErr,      setNoticesErr]      = useState(null)
  const [offlineHours,    setOfflineHours]    = useState(null)

  const [summary,    setSummary]    = useState(null)
  const [summaryErr, setSummaryErr] = useState(null)

  useEffect(() => {
    if (!isInitialized) return
    operatorApi.receiptCounters()
      .then(data => { setCounters(data); setCountersErr(null) })
      .catch(err => { console.error('Failed to load receipt counters:', err); setCountersErr(err.message || 'Failed to load') })
    setNoticesLoading(true)
    operatorApi.notices()
      .then(data => setNotices(Array.isArray(data) ? data : data?.data ?? []))
      .catch(err => setNoticesErr(err.message))
      .finally(() => setNoticesLoading(false))
    operatorApi.dashboardSummary()
      .then(data => { setSummary(data); setSummaryErr(null) })
      .catch(err => setSummaryErr(err.message || 'Failed to load'))
  }, [isInitialized])

  // Check offline duration from user info
  useEffect(() => {
    if (!rawUser?.ebmLastOnlineAt) return
    const last = new Date(rawUser.ebmLastOnlineAt)
    const hours = (Date.now() - last.getTime()) / 3600000
    setOfflineHours(Math.floor(hours))
  }, [rawUser])

  return (
    <AppShell title="Dashboard">
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Dashboard</span></div>
            <h1>Dashboard</h1>
          </div>
          {rawUser && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-400)', textAlign: 'right' }}>
              <div style={{ fontWeight: 600, color: 'var(--ink-700)' }}>{rawUser.taxPayerName || rawUser.fullName}</div>
              <div>TIN: {rawUser.tin} · Branch: {rawUser.branchName || rawUser.branchId || '—'}</div>
            </div>
          )}
        </div>

        {!isInitialized && rawUser !== null && (
          <InitBanner onSuccess={refreshUser} />
        )}

        {/* 24-hour offline lockdown warning (Art. 7.30) */}
        {isInitialized && offlineHours !== null && offlineHours >= 20 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 16,
            padding: '16px 20px', borderRadius: 12, marginBottom: 20,
            background: offlineHours >= 24 ? '#fff1f2' : '#fffbeb',
            border: `1.5px solid ${offlineHours >= 24 ? '#fecdd3' : '#fde68a'}`,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24" style={{ flexShrink: 0, color: offlineHours >= 24 ? 'var(--err)' : 'var(--warn)', marginTop: 1 }}>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: offlineHours >= 24 ? '#991b1b' : '#92400e' }}>
                {offlineHours >= 24
                  ? `⛔ Sales blocked — EBM offline for ${offlineHours} hours (Art. 7.30)`
                  : `⚠ EBM offline for ${offlineHours} hours — sales will be blocked at 24h`
                }
              </div>
              <div style={{ fontSize: 13, color: offlineHours >= 24 ? '#b91c1c' : '#b45309', marginTop: 4, lineHeight: 1.5 }}>
                {offlineHours >= 24
                  ? 'All new sales are blocked until the device reconnects to the RRA EBM server. Restore internet connectivity and perform any EBM operation to unblock.'
                  : `Last EBM contact: ${new Date(rawUser.ebmLastOnlineAt).toLocaleString()}. Ensure connectivity before the 24-hour limit is reached.`
                }
              </div>
              {offlineHours >= 24 && <ReconnectButton onSuccess={refreshUser} />}
            </div>
          </div>
        )}

        {isInitialized && (
          <>
            {/* Receipt counters */}
            {counters ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <CounterCard label="Sales (NS)"     value={counters.lastSaleInvoiceNo}     sub="last invoice no" />
                <CounterCard label="Training (TS)"  value={counters.lastTrainingInvoiceNo}  sub="last training no" color="var(--ink-500)" />
                <CounterCard label="Proforma (PS)"  value={counters.lastProformaInvoiceNo}  sub="last proforma no" color="var(--ink-500)" />
                <CounterCard label="Purchases"      value={counters.lastPurchaseInvoiceNo}  sub="last purchase no" />
              </div>
            ) : countersErr && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 24,
                background: '#fff1f2', border: '1.5px solid #fecdd3', color: '#b91c1c', fontSize: 13,
              }}>
                Could not load dashboard summary: {countersErr}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                BUSINESS OVERVIEW — hero KPIs + charts
            ═══════════════════════════════════════════════════ */}
            {summaryErr ? (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 24,
                background: '#fff1f2', border: '1.5px solid #fecdd3', color: '#b91c1c', fontSize: 13,
              }}>
                Could not load business overview: {summaryErr}
              </div>
            ) : summary && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <StatTile
                    label="Today's Sales" value={summary.today.amount} sub={`${summary.today.count} receipts`}
                    color="var(--viz-series-1)"
                    trend={summary.salesTrend.slice(-7).map(d => d.amount)}
                  />
                  <StatTile
                    label="Month to Date" value={summary.monthToDate.amount} sub={`${summary.monthToDate.count} receipts`}
                    color="var(--viz-series-2)"
                  />
                  <StatTile
                    label="Customers" value={summary.customers.total}
                    sub={`${summary.customers.business} business · ${summary.customers.individual} individual`}
                    color="var(--viz-series-3)"
                  />
                  <StatTile
                    label="Low Stock Items" value={summary.stock.lowStock} sub={`of ${summary.stock.total} active items`}
                    color={summary.stock.lowStock > 0 ? 'var(--warn)' : 'var(--viz-series-6)'}
                  />
                </div>

                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card__head"><h3>Sales &amp; Purchases — last 14 days</h3></div>
                  <div className="card__body">
                    <TrendChart
                      valueFormatter={formatRwf}
                      xLabels={summary.salesTrend.map(d => new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}
                      series={[
                        { name: 'Sales', color: 'var(--viz-series-1)', values: summary.salesTrend.map(d => d.amount) },
                        { name: 'Purchases', color: 'var(--viz-series-2)', values: summary.purchasesTrend.map(d => d.amount) },
                      ]}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>Revenue by Tax Type</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>Last 30 days</span></div>
                    <div className="card__body">
                      <DonutChart
                        valueFormatter={formatRwf}
                        centerLabel={compactNumber(Object.values(summary.taxBreakdown).reduce((a, b) => a + b, 0))}
                        data={Object.entries(summary.taxBreakdown)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => ({ label: TAX_LABELS[k] || k, value: v, color: TAX_COLORS[k] }))}
                      />
                    </div>
                  </div>

                  <div className="card">
                    <div className="card__head"><h3>Payment Methods</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>Last 30 days</span></div>
                    <div className="card__body">
                      <BarChart
                        valueFormatter={formatRwf}
                        data={summary.paymentMethods.map(p => ({
                          label: PAYMENT_LABELS[p.method] || p.method || 'Unknown', value: p.amount,
                          color: PAYMENT_COLORS[p.method] || 'var(--viz-series-8)',
                        }))}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>Receipt Type Mix</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>Last 30 days</span></div>
                    <div className="card__body">
                      <BarChart
                        data={summary.saleTypes.map(t => ({
                          label: SALE_TYPE_LABELS[t.type] || t.type, value: t.count,
                          color: SALE_TYPE_COLORS[t.type] || 'var(--viz-series-8)',
                        }))}
                      />
                    </div>
                  </div>

                  <div className="card">
                    <div className="card__head"><h3>Top Selling Items</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>By revenue, last 30 days</span></div>
                    <div className="card__body">
                      <BarChart
                        valueFormatter={formatRwf} labelWidth={140}
                        data={summary.topItems.map(it => ({ label: it.name || it.code, value: it.revenue, color: 'var(--viz-series-1)' }))}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>Customer Mix</h3></div>
                    <div className="card__body">
                      <DonutChart
                        centerLabel={compactNumber(summary.customers.total)}
                        data={[
                          { label: 'Business (TIN)', value: summary.customers.business, color: 'var(--viz-series-1)' },
                          { label: 'Individual', value: summary.customers.individual, color: 'var(--viz-series-3)' },
                        ].filter(d => d.value > 0)}
                      />
                    </div>
                  </div>

                  <div className="card">
                    <div className="card__head"><h3>Cash Movements</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>Last 30 days</span></div>
                    <div className="card__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <StatTile label="Deposits" value={summary.cash.deposits} color="var(--viz-series-6)" />
                      <StatTile label="Withdrawals" value={summary.cash.withdrawals} color="var(--viz-series-8)" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Two-column layout: device status + notices */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

              {/* Device status card */}
              <div className="card">
                <div className="card__head"><h3>Device Status</h3></div>
                <div className="card__body" style={{ padding: '12px 16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                      {[
                        ['SDC ID',        rawUser.sdcId         || '—', true],
                        ['MRC',           rawUser.mrc           || '—', true],
                        ['Serial No',     rawUser.serialNo      || '—', true],
                        ['Branch',        rawUser.branchName || rawUser.branchId || '—', false],
                        ['Training Mode', rawUser.isTrainingMode ? 'Active' : 'Off', false],
                        ['Last Sale #',   counters?.lastSaleInvoiceNo ?? '—', false],
                        ['Last Stock #',  counters?.lastStockNo       ?? '—', false],
                      ].map(([label, value, mono]) => (
                        <tr key={label} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                          <td style={{ padding: '7px 0', color: 'var(--ink-500)', width: 110 }}>{label}</td>
                          <td style={{ padding: '7px 0 7px 8px', fontWeight: 500, fontFamily: mono ? 'var(--font-mono)' : undefined, fontSize: mono ? 12 : 13 }}>
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rawUser.isTrainingMode && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef3c7', borderRadius: 7, fontSize: 12.5, color: '#b45309' }}>
                      ⚠ Training Mode is active — invoices are not fiscally recorded
                    </div>
                  )}
                </div>
              </div>

              {/* Notices */}
              <div className="card">
                <div className="card__head">
                  <h3>RRA Notices</h3>
                  {notices.length > 0 && (
                    <span className="chip chip--info chip--plain" style={{ fontSize: 12 }}>{notices.length} notice{notices.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="card__body">
                  {noticesLoading ? (
                    <div style={{ color: 'var(--ink-400)', fontSize: 13, padding: '8px 0' }}>Loading notices…</div>
                  ) : noticesErr ? (
                    <div style={{ color: 'var(--ink-500)', fontSize: 13, padding: '8px 0' }}>Could not load notices: {noticesErr}</div>
                  ) : notices.length === 0 ? (
                    <div style={{ color: 'var(--ink-400)', fontSize: 13, padding: '8px 0' }}>No notices from RRA at this time.</div>
                  ) : (
                    <div>
                      {notices.map((n, i) => <NoticeCard key={i} notice={n} index={i} />)}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
