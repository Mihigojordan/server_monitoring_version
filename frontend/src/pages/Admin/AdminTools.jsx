import { useState } from 'react'
import AdminShell from '../../components/layout/AdminShell'
import { adminApi } from '../../api/admin'
import { logActivity } from '../../hooks/useActivityLog'

function ResultBox({ data }) {
  if (!data) return null
  return (
    <pre style={{
      marginTop: 12, padding: '12px 14px', borderRadius: 8,
      background: 'var(--ink-100)', fontSize: 12, overflowX: 'auto',
      maxHeight: 320, border: '1px solid var(--ink-200)', lineHeight: 1.6,
      fontFamily: 'var(--font-mono)',
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

function ToolCard({ title, description, children }) {
  return (
    <div className="card">
      <div className="card__head"><h3>{title}</h3></div>
      <div className="card__body">
        {description && (
          <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 16, marginTop: 0 }}>{description}</p>
        )}
        {children}
      </div>
    </div>
  )
}

function useAction(fn, logMeta) {
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error,  setError]  = useState(null)

  async function run(arg) {
    setStatus('loading')
    setResult(null)
    setError(null)
    try {
      const data = await fn(arg)
      setResult(data)
      setStatus('done')
      logActivity({ action: logMeta.action, category: 'Tools', summary: logMeta.successMsg, detail: JSON.stringify(data, null, 2) })
    } catch (err) {
      setError(err.message || 'Request failed')
      setStatus('error')
      logActivity({ action: logMeta.action, category: 'Tools', summary: logMeta.errorMsg, status: 'error', detail: err.message })
    }
  }

  return { status, result, error, run }
}

// ─── Classification Sync ─────────────────────────────────────────────────────
function ClassificationSync() {
  const { status, result, error, run } = useAction(
    () => adminApi.syncClassifications(),
    { action: 'SYNC_CLASSIFICATIONS', successMsg: 'Classification codes synced from RRA EBM', errorMsg: 'Classification sync failed' }
  )
  return (
    <ToolCard
      title="Classification Code Sync"
      description="Pull the latest item classification codes (UNSPSC) from the RRA EBM server and update the local database."
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn btn--primary btn--sm" onClick={run} disabled={status === 'loading'}>
          {status === 'loading' ? 'Syncing…' : 'Sync Now'}
        </button>
        {status === 'done'  && <span className="chip chip--ok">✓ Sync complete</span>}
        {status === 'error' && <span style={{ fontSize: 13, color: 'var(--err)' }}>{error}</span>}
      </div>
      <ResultBox data={result} />
    </ToolCard>
  )
}

// ─── TIN Reprogramming ────────────────────────────────────────────────────────
function TinReprogram() {
  const [form, setForm] = useState({ currentTin: '', newTin: '' })
  const [confirm, setConfirm] = useState(false)
  const { status, result, error, run } = useAction(
    (data) => adminApi.reprogramTin(data),
    { action: 'REPROGRAM_TIN', successMsg: `TIN reprogrammed: ${form.currentTin} → ${form.newTin}`, errorMsg: 'TIN reprogram failed' }
  )

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setConfirm(false) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!confirm) { setConfirm(true); return }
    await run({ currentTin: Number(form.currentTin), newTin: Number(form.newTin) })
    setConfirm(false)
  }

  return (
    <ToolCard
      title="TIN Reprogramming"
      description="Reassign a device to a new TIN. Resets all invoice counters and re-initializes EBM credentials. Use only when legally required."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="currentTin">Current TIN</label>
          <input id="currentTin" className="form-input form-input--sm" placeholder="999909100" value={form.currentTin}
            onChange={e => set('currentTin', e.target.value)} required />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="newTin">New TIN</label>
          <input id="newTin" className="form-input form-input--sm" placeholder="100200300" value={form.newTin}
            onChange={e => set('newTin', e.target.value)} required />
        </div>
        <button
          type="submit"
          className="btn btn--sm"
          style={confirm ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' } : {}}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Processing…' : confirm ? '⚠ Confirm Reprogram' : 'Reprogram TIN'}
        </button>
      </form>
      {status === 'done'  && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ok)' }}>✓ {result?.message}</div>}
      {status === 'error' && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--err)' }}>{error}</div>}
    </ToolCard>
  )
}

// ─── EBM Queries ─────────────────────────────────────────────────────────────
function EbmQuery({ title, description, apiFn }) {
  const [form, setForm] = useState({ tin: '', branchId: '', lastRequestDt: '' })
  const { status, result, error, run } = useAction(
    (data) => apiFn(data),
    { action: `EBM_QUERY_${title.toUpperCase().replace(/\s+/g,'_')}`, successMsg: `${title} query completed`, errorMsg: `${title} query failed` }
  )

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {}
    if (form.tin)           payload.tin           = Number(form.tin)
    if (form.branchId)      payload.branchId      = form.branchId
    if (form.lastRequestDt) payload.lastRequestDt = form.lastRequestDt
    run(payload)
  }

  const uid = title.replace(/\s+/g, '-').toLowerCase()

  return (
    <ToolCard title={title} description={description}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor={`${uid}-tin`}>TIN (optional)</label>
          <input id={`${uid}-tin`} className="form-input form-input--sm" placeholder="uses your TIN" value={form.tin} onChange={e => set('tin', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor={`${uid}-branch`}>Branch ID</label>
          <input id={`${uid}-branch`} className="form-input form-input--sm" placeholder="00" value={form.branchId} onChange={e => set('branchId', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor={`${uid}-date`}>Last Request Date</label>
          <input id={`${uid}-date`} className="form-input form-input--sm" placeholder="20180101000000" value={form.lastRequestDt} onChange={e => set('lastRequestDt', e.target.value)} />
        </div>
        <button type="submit" className="btn btn--sm btn--primary" disabled={status === 'loading'}>
          {status === 'loading' ? 'Querying…' : 'Query EBM'}
        </button>
      </form>
      {status === 'error' && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--err)' }}>{error}</div>}
      <ResultBox data={result} />
    </ToolCard>
  )
}

export default function AdminTools() {
  return (
    <AdminShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Admin</span><span>›</span><span>EBM Tools</span></div>
            <h1>EBM Tools</h1>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20, maxWidth: 860 }}>
          <ClassificationSync />
          <TinReprogram />
          <EbmQuery
            title="EBM Branch Users"
            description="Query registered branch operators from the RRA EBM server."
            apiFn={adminApi.ebmBranchUsers}
          />
          <EbmQuery
            title="EBM Branch Insurances"
            description="Query insurance companies registered under a branch from the EBM server."
            apiFn={adminApi.ebmBranchInsurances}
          />
          <EbmQuery
            title="EBM Stock Items"
            description="Query stock item list from the RRA EBM server for a given branch."
            apiFn={adminApi.ebmStockItems}
          />
        </div>
      </div>
    </AdminShell>
  )
}
