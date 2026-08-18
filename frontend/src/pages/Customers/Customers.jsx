import { useState, useEffect, useCallback } from 'react'
import AppShell from '../../components/layout/AppShell'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'
import { useApp } from '../../context/AppContext'

// ── Constants ──────────────────────────────────────────────────────────────
const PER_PAGE = 4

const AVATAR_COLORS = [
  { bg: 'var(--brand-100)', color: 'var(--brand-700)' },
  { bg: '#dcfce7',          color: 'var(--ok)' },
  { bg: '#fef3c7',          color: '#b45309' },
  { bg: '#ede9fe',          color: '#6d28d9' },
  { bg: '#cffafe',          color: '#0e7490' },
  { bg: '#ffe4e6',          color: '#be123c' },
]

const EMPTY_FORM = { 
  customerTin: '', 
  customerName: '', 
  customerPhoneNumber: '', 
  email: '', 
  address: '', 
  contact: '', 
  faxNumber: '', 
  remark: '', 
  used: 'Y' 
}

// ── Helpers ────────────────────────────────────────────────────────────────
function avatarColor(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xff_ff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function getPageNums(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (cur <= 4)        return [1, 2, 3, 4, 5, '…', total]
  if (cur >= total - 3) return [1, '…', total-4, total-3, total-2, total-1, total]
  return [1, '…', cur-1, cur, cur+1, '…', total]
}

function formatLastSynced(iso) {
  if (!iso) return 'Never synced'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'Synced just now'
  if (mins < 60) return `Synced ${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `Synced ${hours}h ago`
  return `Synced ${Math.round(hours / 24)}d ago`
}

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ── Icons ──────────────────────────────────────────────────────────────────
const IcoRefresh = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
const IcoSync    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
const IcoPlus    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const IcoTable   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
const IcoList    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const IcoGrid    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
const IcoSearch  = () => <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/></svg>
const IcoBack    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
const IcoEye     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const IcoTin     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>
const IcoEdit    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoTrash   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>

// ── Main component ─────────────────────────────────────────────────────────
export default function Customers() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || ''
  const isTrainingMode = rawUser?.isTrainingMode || false

  const [customers,    setCustomers]    = useState([])
  const [meta,         setMeta]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [pageTab,      setPageTab]      = useState('List') // 'List' | 'Add' | 'Edit' | 'Detail' | 'Find'
  const [viewMode,     setViewMode]     = useState('table')
  const [statusFilter, setStatusFilter] = useState('All')

  const [detailCustomer, setDetailCustomer] = useState(null)
  const [form,           setForm]           = useState(EMPTY_FORM)
  const [saving,         setSaving]         = useState(false)
  const [saveErr,        setSaveErr]        = useState(null)
  const [saveOk,         setSaveOk]         = useState(false)

  // Find by TIN
  const [findTin,    setFindTin]    = useState('')
  const [findResult, setFindResult] = useState(null)
  const [finding,    setFinding]    = useState(false)
  const [findErr,    setFindErr]    = useState(null)

  // Sync
  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState(null)
  const [lastSyncedAt,   setLastSyncedAt]   = useState(null)
  const [syncRetryAfter, setSyncRetryAfter] = useState(0) // seconds remaining in cooldown

  // Branch-wide stats (KPI strip) — a real aggregate, not a count of
  // whatever page happens to be loaded.
  const [stats, setStats] = useState(null)
  const loadStats = useCallback(() => {
    operatorApi.customerStats().then(setStats).catch(() => {})
  }, [])

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async (p = 1) => {
    setLoading(true); setError(null)
    try {
      const res = search.trim()
        ? await operatorApi.searchCustomers(search, p, PER_PAGE)
        : await operatorApi.listCustomers(p, PER_PAGE)
      
      const data = res?.data ?? []
      const metadata = res?.meta ?? null
      
      setCustomers(Array.isArray(data) ? data : [])
      setMeta(metadata)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load(1) }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  // ── Sync status (last synced / cooldown) ─────────────────────────────────
  useEffect(() => {
    operatorApi.customerSyncStatus()
      .then(res => { setLastSyncedAt(res.lastSyncedAt); setSyncRetryAfter(res.retryAfterSeconds || 0) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (syncRetryAfter <= 0) return
    const t = setInterval(() => setSyncRetryAfter(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [syncRetryAfter > 0])

  // ── Form helpers ─────────────────────────────────────────────────────────
  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault(); setSaveErr(null); setSaving(true); setSaveOk(false)
    try {
      if (pageTab === 'Edit') {
        await operatorApi.updateCustomer({
          id: form.id,
          branchId,
          customerTin: Number(form.customerTin),
          customerName: form.customerName,
          customerPhoneNumber: form.customerPhoneNumber,
          email: form.email || undefined,
          address: form.address || undefined,
          contact: form.contact || undefined,
          faxNumber: form.faxNumber || undefined,
          remark: form.remark || undefined,
          used: form.used,
        })
        logActivity({ action: 'UPDATE_CUSTOMER', category: 'System', summary: `Updated customer "${form.customerName}"` })
      } else {
        await operatorApi.saveCustomer({
          branchId,
          customerTin: Number(form.customerTin),
          customerName: form.customerName,
          customerPhoneNumber: form.customerPhoneNumber,
          email: form.email || undefined,
          address: form.address || undefined,
          contact: form.contact || undefined,
          faxNumber: form.faxNumber || undefined,
          remark: form.remark || undefined,
          used: form.used,
        })
        logActivity({ action: 'SAVE_CUSTOMER', category: 'System', summary: `Saved customer "${form.customerName}" (TIN: ${form.customerTin})` })
      }
      setSaveOk(true); setForm(EMPTY_FORM); load(meta?.currentPage || 1); loadStats()
      setTimeout(() => { setSaveOk(false); setPageTab('List') }, 2000)
    } catch (err) {
      setSaveErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setSaving(false) }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Are you sure you want to delete "${c.customerName || c.name}"?`)) return
    try {
      await operatorApi.deleteCustomer(c.id)
      logActivity({ action: 'DELETE_CUSTOMER', category: 'System', summary: `Deleted customer "${c.customerName || c.name}"` })
      load(meta?.currentPage || 1); loadStats()
      if (pageTab === 'Detail') backToList()
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  async function handleFind(e) {
    e.preventDefault(); setFindErr(null); setFindResult(null); setFinding(true)
    try {
      const res = await operatorApi.findCustomerByTin(findTin)
      setFindResult(res)
    } catch (err) { setFindErr(err.message) }
    finally { setFinding(false) }
  }

  async function handleSync(force = false) {
    setSyncing(true); setSyncMsg(null)
    try {
      const res = await operatorApi.syncCustomers({ branchId, force })
      setLastSyncedAt(res.lastSyncedAt || new Date().toISOString())
      setSyncRetryAfter(0)
      setSyncMsg('Customers synced with EBM successfully.')
      logActivity({ action: 'SYNC_CUSTOMERS', category: 'System', summary: 'Branch customers synced with EBM' })
      load(1); loadStats()
      setTimeout(() => setSyncMsg(null), 5000)
    } catch (err) {
      if (err.status === 429) {
        setSyncRetryAfter(err.data?.retryAfterSeconds || 0)
      }
      setSyncMsg(`Sync failed: ${err.message}`)
    } finally { setSyncing(false) }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function openDetail(c) { setDetailCustomer(c); setPageTab('Detail') }
  function backToList() { setPageTab('List'); setDetailCustomer(null) }
  function openAdd() { setPageTab('Add'); setForm(EMPTY_FORM); setSaveErr(null); setSaveOk(false) }
  function openEdit(c) {
    setForm({
      id: c.id,
      customerTin: c.customerTin || '',
      customerName: c.customerName || '',
      customerPhoneNumber: c.customerPhoneNumber || '',
      email: c.email || '',
      address: c.address || '',
      contact: c.contact || '',
      faxNumber: c.faxNumber || '',
      remark: c.remark || '',
      used: c.used || 'Y'
    })
    setPageTab('Edit')
    setSaveErr(null)
    setSaveOk(false)
  }
  function openFind() { setPageTab('Find'); setFindTin(''); setFindResult(null); setFindErr(null) }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = customers.filter(c => {
    if (statusFilter === 'Active'   && c.used !== 'Y') return false
    if (statusFilter === 'Inactive' && c.used === 'Y') return false
    return true
  })

  const totalPages  = meta ? (meta.lastPage ?? Math.ceil(meta.total / PER_PAGE)) : 1
  const currentPage = meta?.currentPage ?? 1
  // Branch-wide aggregates from /branches/customers/stats — never derived
  // from `customers` (only the current PER_PAGE-sized page is loaded there).
  const total    = stats?.total    ?? meta?.total ?? customers.length
  const business = stats?.business ?? 0
  const walkin   = stats?.walkin   ?? 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="page">
        
        {/* ── Page header ── */}
        <div className="page-head">
          <div>
            <div className="crumbs">
              <span>Home</span><span>›</span>
              {pageTab === 'List' ? (
                <span>Customers &amp; TINs</span>
              ) : (
                <>
                  <span style={{ cursor: 'pointer', color: 'var(--brand-600)' }} onClick={backToList}>Customers &amp; TINs</span>
                  <span>›</span>
                  <span>{pageTab === 'Add' ? 'Add customer' : pageTab === 'Edit' ? 'Edit customer' : pageTab === 'Find' ? 'Find by TIN' : (detailCustomer?.customerName || 'Customer details')}</span>
                </>
              )}
            </div>
            <h1>
              {pageTab === 'Add' ? 'Add customer' 
                : pageTab === 'Edit' ? 'Edit customer information'
                : pageTab === 'Find' ? 'Find by TIN'
                : pageTab === 'Detail' ? (detailCustomer?.customerName || 'Customer details')
                : 'Customer database'}
            </h1>
          </div>
          <div className="page-head__actions">
            {pageTab === 'List' ? (
              <>
                <button className="icon-btn" title="Refresh" onClick={() => load(currentPage)}><IcoRefresh /></button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <button className="btn" onClick={() => handleSync(false)}
                    disabled={syncing || isTrainingMode || syncRetryAfter > 0}
                    title={isTrainingMode ? 'Customer sync is disabled in Training Mode' : undefined}>
                    <IcoSync /> {syncing ? 'Syncing…' : syncRetryAfter > 0 ? `Sync with EBM (wait ${formatCountdown(syncRetryAfter)})` : 'Sync with EBM'}
                  </button>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-400)', display: 'flex', gap: 6 }}>
                    {formatLastSynced(lastSyncedAt)}
                    {syncRetryAfter > 0 && !isTrainingMode && (
                      <button type="button" className="btn btn--xs" style={{ padding: '0 4px' }} onClick={() => handleSync(true)}>sync anyway</button>
                    )}
                  </span>
                </div>
                <button className="btn" onClick={openFind}>
                  <IcoTin /> Find by TIN
                </button>
                <button className="btn btn--primary" onClick={openAdd}>
                  <IcoPlus /> Add Customer
                </button>
              </>
            ) : (
              <button className="btn" onClick={backToList}>
                <IcoBack /> Back to database
              </button>
            )}
          </div>
        </div>

        {syncMsg && (
          <div className={syncMsg.includes('failed') ? 'settings-error' : 'chip chip--ok'}
            style={{ marginBottom: 16, display: 'inline-flex' }}>
            {syncMsg}
          </div>
        )}

        {/* ── Reduced Stats strip (List only) ── */}
        {pageTab === 'List' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total',  value: total,    sub: 'users', color: '' },
              { label: 'TIN',    value: business, sub: 'active', color: 'var(--brand-600)' },
              { label: 'Walkin', value: walkin,   sub: 'guests', color: 'var(--ink-500)' },
              { label: 'Branch', value: branchId || '—', sub: 'id', color: '' },
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
        )}

        {/* ═══════════════════════════════════════════════════
            LIST TAB
        ═══════════════════════════════════════════════════ */}
        {pageTab === 'List' && (
          <div className="card">
            
            {/* ── Filter bar ── */}
            <div className="filterbar">
              <div className="field" style={{ flex: 1 }}>
                <IcoSearch />
                <input
                  placeholder="Search name, TIN, phone number…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
                />
                {searchInput && searchInput !== search && (
                  <button className="btn btn--sm btn--primary" style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    onClick={() => setSearch(searchInput)}>Go</button>
                )}
                {search && (
                  <button className="btn btn--sm" style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    onClick={() => { setSearch(''); setSearchInput('') }}>✕ Clear</button>
                )}
              </div>
              <div className="field">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="All">All Status</option>
                  <option value="Active">Active only</option>
                  <option value="Inactive">Inactive only</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
                {[['table', <IcoTable />], ['list', <IcoList />], ['grid', <IcoGrid />]].map(([mode, icon]) => (
                  <button key={mode}
                    className="icon-btn"
                    style={{
                      background: viewMode === mode ? 'var(--brand-100)' : '',
                      color: viewMode === mode ? 'var(--brand-700)' : '',
                      border: viewMode === mode ? '1px solid var(--brand-200)' : '',
                    }}
                    onClick={() => setViewMode(mode)}>{icon}</button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}
              
              {loading ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-400)' }}>
                  <div className="spinner" style={{ marginBottom: 12 }} />
                  <div>Fetching customers…</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-500)' }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink-700)', marginBottom: 6 }}>
                    {search ? `No customers matching "${search}"` : 'No customers found'}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 16 }}>
                    {search ? 'Try a different search term.' : 'Add your first customer to get started.'}
                  </div>
                  {!search && <button className="btn btn--primary btn--sm" onClick={openAdd}>Add Customer</button>}
                </div>
              ) : (
                <>
                  {/* ── TABLE view ── */}
                  {viewMode === 'table' && (
                    <table className="data data--hover">
                      <thead>
                        <tr>
                          <th style={{ width: 250 }}>Name</th>
                          <th style={{ width: 140 }}>TIN</th>
                          <th>Address</th>
                          <th style={{ width: 200 }}>Contact info</th>
                          <th style={{ width: 100 }}>Status</th>
                          <th style={{ width: 100 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((c, i) => {
                          const initials = (c.customerName || c.name || '??').slice(0, 2).toUpperCase()
                          const { bg, color } = avatarColor(String(c.customerTin || c.tin || i))
                          return (
                            <tr key={c.id || i} onClick={() => openDetail(c)}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, color, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 12 }}>{initials}</div>
                                  <div style={{ fontWeight: 600 }}>{c.customerName || c.name || '—'}</div>
                                </div>
                              </td>
                              <td>
                                {c.customerTin || c.tin ? (
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500 }}>{c.customerTin || c.tin}</span>
                                ) : (
                                  <span style={{ color: 'var(--ink-400)', fontSize: 12 }}>Walk-in</span>
                                )}
                              </td>
                              <td style={{ fontSize: 13, color: 'var(--ink-600)' }}>{c.address || '—'}</td>
                              <td>
                                <div style={{ fontSize: 13 }}>{c.customerPhoneNumber || c.phone || '—'}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{c.email || '—'}</div>
                              </td>
                              <td>
                                {c.used === 'Y' 
                                  ? <span className="chip chip--ok">Active</span> 
                                  : <span className="chip chip--err">Inactive</span>}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="icon-btn icon-btn--sm" title="Edit" onClick={e => { e.stopPropagation(); openEdit(c) }}><IcoEdit /></button>
                                  <button className="icon-btn icon-btn--sm icon-btn--danger" title="Delete" onClick={e => { e.stopPropagation(); handleDelete(c) }}><IcoTrash /></button>
                                  <button className="icon-btn icon-btn--sm" title="View Details" onClick={e => { e.stopPropagation(); openDetail(c) }}><IcoEye /></button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* ── LIST view ── */}
                  {viewMode === 'list' && (
                    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {filtered.map((c, i) => {
                         const { bg, color } = avatarColor(String(c.customerTin || c.tin || i))
                         return (
                           <div key={c.id || i} className="list-item" onClick={() => openDetail(c)}
                             style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--ink-200)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
                             <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, color, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{(c.customerName||'?').slice(0,1).toUpperCase()}</div>
                             <div style={{ flex: 1 }}>
                               <div style={{ fontWeight: 600 }}>{c.customerName || '—'}</div>
                               <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>TIN: {c.customerTin || 'N/A'} · {c.customerPhoneNumber || 'No phone'}</div>
                               <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 2 }}>{c.address}</div>
                             </div>
                             <div style={{ display: 'flex', gap: 6 }}>
                               <button className="icon-btn" onClick={e => { e.stopPropagation(); openEdit(c) }}><IcoEdit /></button>
                               <button className="icon-btn icon-btn--danger" onClick={e => { e.stopPropagation(); handleDelete(c) }}><IcoTrash /></button>
                               <button className="btn btn--sm" onClick={e => { e.stopPropagation(); openDetail(c) }}>View</button>
                             </div>
                           </div>
                         )
                      })}
                    </div>
                  )}

                  {/* ── GRID view ── */}
                  {viewMode === 'grid' && (
                    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                      {filtered.map((c, i) => {
                        const { bg, color } = avatarColor(String(c.customerTin || c.tin || i))
                        return (
                          <div key={c.id || i} className="grid-item" onClick={() => openDetail(c)}
                            style={{ padding: 16, borderRadius: 12, border: '1px solid var(--ink-200)', background: 'var(--surface)', textAlign: 'center', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 2 }}>
                               <button className="icon-btn icon-btn--sm" onClick={e => { e.stopPropagation(); openEdit(c) }}><IcoEdit /></button>
                               <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={e => { e.stopPropagation(); handleDelete(c) }}><IcoTrash /></button>
                            </div>
                            <div style={{ width: 48, height: 48, borderRadius: 24, background: bg, color, margin: '8px auto 10px', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18 }}>{(c.customerName||'?').slice(0,1).toUpperCase()}</div>
                            <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.customerName}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>TIN: {c.customerTin || 'No TIN'}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginBottom: 12, height: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '—'}</div>
                            <div className="chip chip--sm" style={{ background: 'var(--ink-100)', color: 'var(--ink-700)' }}>{c.customerPhoneNumber || '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Pagination ── */}
            {!loading && totalPages > 1 && (
              <div className="pagination" style={{ borderTop: '1px solid var(--ink-100)', padding: '12px 16px' }}>
                <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>
                  Showing {((currentPage-1)*PER_PAGE)+1}–{Math.min(currentPage*PER_PAGE, total)} of {total} customers
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
          </div>
        )}

        {/* ── Add / Edit Customer Form ── */}
        {(pageTab === 'Add' || pageTab === 'Edit') && (
          <div className="card" style={{ width: '100%' }}>
             <div className="card__head">
               <div>
                 <h3 style={{ margin: 0 }}>{pageTab === 'Add' ? 'Register New Customer' : 'Update Customer Details'}</h3>
                 <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>Fill in the tax and contact information below</p>
               </div>
               {saveOk && <span className="chip chip--ok">Successfully saved ✓</span>}
             </div>
             <form onSubmit={handleSubmit}>
               <div className="card__body" style={{ padding: '24px 32px' }}>
                 {saveErr && <div className="settings-error" style={{ marginBottom: 24 }}>{saveErr}</div>}
                 
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px 32px' }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Full Name / Business Name <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input className="form-input" required placeholder="Enter customer or company name"
                        value={form.customerName} onChange={e => setF('customerName', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">TIN <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input className="form-input input--mono" required placeholder="123456789" type="number"
                        value={form.customerTin} onChange={e => setF('customerTin', e.target.value)} />
                      <span className="form-hint">Must be 9 digits</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phone Number <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input className="form-input" required placeholder="0788000000" maxLength={10}
                        value={form.customerPhoneNumber} onChange={e => setF('customerPhoneNumber', e.target.value)} />
                      <span className="form-hint">E.g. 078XXXXXXX (10 digits)</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input className="form-input" type="email" placeholder="email@example.com"
                        value={form.email} onChange={e => setF('email', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Contact Person</label>
                      <input className="form-input" placeholder="Representative name"
                        value={form.contact} onChange={e => setF('contact', e.target.value)} />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Physical Address</label>
                      <input className="form-input" placeholder="Province, District, Sector, Cell, Street"
                        value={form.address} onChange={e => setF('address', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Account Status</label>
                      <select className="form-input" value={form.used} onChange={e => setF('used', e.target.value)}>
                        <option value="Y">Active</option>
                        <option value="N">Inactive / Suspended</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Fax Number</label>
                      <input className="form-input" placeholder="Optional"
                        value={form.faxNumber} onChange={e => setF('faxNumber', e.target.value)} />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Internal Remark</label>
                      <input className="form-input" placeholder="Any additional notes about this customer"
                        value={form.remark} onChange={e => setF('remark', e.target.value)} />
                    </div>
                 </div>
               </div>
               <div className="card__foot" style={{ padding: '20px 32px', display: 'flex', gap: 12, background: 'var(--ink-50)' }}>
                 <button type="submit" className="btn btn--primary btn--lg" disabled={saving}>
                   {saving ? 'Processing…' : pageTab === 'Add' ? 'Register Customer' : 'Update Customer'}
                 </button>
                 <button type="button" className="btn btn--lg" onClick={backToList}>Cancel</button>
                 {pageTab === 'Add' && (
                   <button type="button" className="btn btn--lg btn--ghost" style={{ marginLeft: 'auto' }} onClick={() => setForm(EMPTY_FORM)}>Reset form</button>
                 )}
               </div>
             </form>
          </div>
        )}

        {/* ── Find by TIN ── */}
        {pageTab === 'Find' && (
          <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>EBM Global Lookup</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>Find and import taxpayer information directly from EBM</p>
              </div>
            </div>
            <div className="card__body" style={{ padding: 32 }}>
              {findErr && <div className="settings-error" style={{ marginBottom: 24 }}>{findErr}</div>}
              <form onSubmit={handleFind} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 32 }}>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <label className="form-label">Taxpayer TIN</label>
                  <input className="form-input input--mono" required placeholder="111111111"
                    value={findTin} onChange={e => setFindTin(e.target.value)} autoFocus />
                </div>
                <button type="submit" className="btn btn--primary btn--lg" style={{ height: 38 }} disabled={finding}>{finding ? 'Searching…' : 'Find'}</button>
              </form>

              {findResult && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--brand-200)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                       <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--ink-900)' }}>{findResult.taxPayerName || findResult.name || '—'}</div>
                       <div style={{ color: 'var(--brand-600)', fontWeight: 700, fontSize: 14 }}>TIN: {findResult.tin || '—'}</div>
                    </div>
                    <span className="chip chip--ok chip--plain">Found in EBM</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 0', fontSize: 14 }}>
                    <span style={{ color: 'var(--ink-500)' }}>Address</span>
                    <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{findResult.address || findResult.locDesc || '—'}</span>
                    
                    <span style={{ color: 'var(--ink-500)' }}>Phone</span>
                    <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{findResult.phone || '—'}</span>
                    
                    <span style={{ color: 'var(--ink-500)' }}>Email</span>
                    <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{findResult.email || '—'}</span>
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--ink-100)' }}>
                    <button className="btn btn--primary btn--lg" style={{ width: '100%' }}
                      onClick={() => { 
                        setForm({ 
                          customerTin: findResult.tin || '', 
                          customerName: findResult.taxPayerName || findResult.name || '', 
                          customerPhoneNumber: findResult.phone || '', 
                          email: findResult.email || '', 
                          address: findResult.address || findResult.locDesc || '', 
                          contact: '', faxNumber: '', remark: '', used: 'Y' 
                        }); 
                        setPageTab('Add') 
                      }}>
                      Import &amp; Register this Customer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Detail View ── */}
        {pageTab === 'Detail' && detailCustomer && (
          <div className="card" style={{ width: '100%' }}>
             <div className="card__head" style={{ borderBottom: 'none', padding: '32px 32px 0' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%' }}>
                 <div style={{ width: 80, height: 80, borderRadius: 20, background: avatarColor(detailCustomer.customerTin).bg, color: avatarColor(detailCustomer.customerTin).color, display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 800 }}>
                   {(detailCustomer.customerName||'?').slice(0,1).toUpperCase()}
                 </div>
                 <div style={{ flex: 1 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                     <h1 style={{ margin: 0, fontSize: 32 }}>{detailCustomer.customerName}</h1>
                     {detailCustomer.used === 'Y' ? <span className="chip chip--ok">Active Account</span> : <span className="chip chip--err">Inactive</span>}
                   </div>
                   <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand-600)', fontWeight: 700 }}>
                        <IcoTin /> <span>TIN: {detailCustomer.customerTin || 'N/A'}</span>
                     </div>
                     <div style={{ color: 'var(--ink-500)', fontSize: 14 }}>
                        Customer ID: #{detailCustomer.customerNo || '—'}
                     </div>
                   </div>
                 </div>
                 <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn--lg" onClick={() => openEdit(detailCustomer)}><IcoEdit /> Edit profile</button>
                    <button className="btn btn--lg btn--danger" onClick={() => handleDelete(detailCustomer)}><IcoTrash /> Delete</button>
                 </div>
               </div>
             </div>
             
             <div className="card__body" style={{ padding: '40px 32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
               <div>
                 <h4 style={{ margin: '0 0 20px', color: 'var(--ink-400)', textTransform: 'uppercase', fontSize: 12, letterSpacing: '.1em', fontWeight: 800 }}>Contact Information</h4>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <DetailItem label="Phone Number" value={detailCustomer.customerPhoneNumber} />
                    <DetailItem label="Email Address" value={detailCustomer.email} isEmail />
                    <DetailItem label="Contact Person" value={detailCustomer.contact} />
                    <DetailItem label="Fax Number" value={detailCustomer.faxNumber} />
                 </div>
               </div>
               
               <div>
                 <h4 style={{ margin: '0 0 20px', color: 'var(--ink-400)', textTransform: 'uppercase', fontSize: 12, letterSpacing: '.1em', fontWeight: 800 }}>Location &amp; Registry</h4>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <DetailItem label="Physical Address" value={detailCustomer.address} />
                    <DetailItem label="Registration Date" value={new Date(detailCustomer.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })} />
                    <DetailItem label="Last Updated" value={new Date(detailCustomer.updatedAt).toLocaleDateString(undefined, { dateStyle: 'long' })} />
                 </div>
               </div>

               <div>
                 <h4 style={{ margin: '0 0 20px', color: 'var(--ink-400)', textTransform: 'uppercase', fontSize: 12, letterSpacing: '.1em', fontWeight: 800 }}>Notes &amp; Internal</h4>
                 <div style={{ background: 'var(--ink-50)', padding: 20, borderRadius: 12, border: '1px solid var(--ink-200)', height: '100%' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 8 }}>Internal Remark</div>
                    <div style={{ fontSize: 14, color: 'var(--ink-800)', lineHeight: 1.6, fontStyle: detailCustomer.remark ? 'normal' : 'italic' }}>
                      {detailCustomer.remark || 'No internal remarks for this customer.'}
                    </div>
                 </div>
               </div>
             </div>

             <div className="card__foot" style={{ borderTop: '1px solid var(--ink-100)', padding: '24px 32px', background: 'var(--ink-50)' }}>
                <button className="btn btn--lg" onClick={backToList}>Return to Database</button>
             </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}

function DetailItem({ label, value, isEmail }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: isEmail ? 'var(--brand-600)' : 'var(--ink-900)' }}>
        {value || <span style={{ color: 'var(--ink-300)', fontWeight: 400 }}>Not provided</span>}
      </div>
    </div>
  )
}
