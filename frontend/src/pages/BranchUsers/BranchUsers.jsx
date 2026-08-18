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

const EMPTY_FORM = { userId: '', userName: '', password: '', admnYn: 'N', authorityCode: '', used: 'Y', remark: '' }

const AUTHORITY_CODES = [
  { v: '01', l: 'Cashier' },
  { v: '02', l: 'Supervisor' },
  { v: '03', l: 'Manager' },
  { v: '04', l: 'Admin' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function avatarColor(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// Spec (§3.3.3.2) caps userId at 20 chars and doesn't require any particular
// format — "USR" + a random 4-digit suffix keeps it short and readable.
function generateUserId() {
  const rnd = String(Math.floor(1000 + Math.random() * 9000))
  return `USR${rnd}`
}

// Spec caps password at 255 chars with no format requirement — 12 chars
// mixing case, digits, and a couple of symbols is plenty for an initial
// credential the operator resets on first login.
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  let pwd = ''
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

function getPageNums(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (cur <= 4)        return [1, 2, 3, 4, 5, '…', total]
  if (cur >= total - 3) return [1, '…', total-4, total-3, total-2, total-1, total]
  return [1, '…', cur-1, cur, cur+1, '…', total]
}

function exportCSVData(rows) {
  const hdr = ['Operator Name', 'User ID', 'Role', 'Admin', 'Status', 'Branch']
  const csv = [hdr, ...rows.map(u => [
    `"${(u.userName||u.userNm||'').replace(/"/g,'""')}"`,
    u.userId || '',
    AUTHORITY_CODES.find(a => a.v === (u.authorityCode || u.userAuthorCd))?.l || 'Standard',
    u.admnYn === 'Y' ? 'Yes' : 'No',
    (u.used || u.useYn) !== 'N' ? 'Active' : 'Inactive',
    u.branchId || ''
  ])].map(r => r.join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `branch_users_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

function printTableData(rows) {
  const hdr = ['Operator Name', 'User ID', 'Role', 'Admin', 'Status', 'Branch']
  let html = '<html><head><style>body{font-family:Arial,sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:bold}</style></head><body>'
  html += '<h2>Branch Operators Report</h2>'
  html += '<table><thead><tr>' + hdr.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
  html += rows.map(u => '<tr><td>' + [
    u.userName||u.userNm||'', u.userId||'',
    AUTHORITY_CODES.find(a => a.v === (u.authorityCode || u.userAuthorCd))?.l || 'Standard',
    u.admnYn === 'Y' ? 'Yes' : 'No',
    (u.used || u.useYn) !== 'N' ? 'Active' : 'Inactive',
    u.branchId || ''
  ].join('</td><td>') + '</td></tr>').join('')
  html += '</tbody></table></body></html>'
  const w = window.open('', '', 'width=1000,height=600')
  w.document.write(html); w.document.close(); w.print()
}

// ── Icons ──────────────────────────────────────────────────────────────────
const IcoPlus    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const IcoBack    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
const IcoEdit    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoTrash   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
const IcoRefresh = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
const IcoPdf     = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#DC2626"/><path d="M44 4v16h16" fill="#B91C1C"/><path d="M22 30h20M22 38h20M22 46h12" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>
const IcoXlsx    = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#16A34A"/><path d="M44 4v16h16" fill="#15803D"/><path d="M22 28h20v24H22z" fill="white" fillOpacity="0.2"/><path d="M22 28h20M22 36h20M22 44h20M22 52h20M22 28v24M32 28v24M42 28v24" stroke="white" strokeWidth="1.5"/></svg>
const IcoCsv     = () => <svg width="28" height="28" viewBox="0 0 64 64" fill="none"><path d="M12 4h32l16 16v36c0 4.4-3.6 8-8 8H12c-4.4 0-8-3.6-8-8V12c0-4.4 3.6-8 8-8z" fill="#2563EB"/><path d="M44 4v16h16" fill="#1D4ED8"/><path d="M20 32l8 8 16-16" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoMagic   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M12.2 6.2 11 5M12.2 11.8 11 13M15 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="m3 21 9-9"/></svg>
const IcoCopy    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>

// ── Main component ─────────────────────────────────────────────────────────
export default function BranchUsers() {
  const { rawUser } = useApp()
  const branchId = rawUser?.branchId || ''

  const [users,   setUsers]   = useState([])
  const [meta,    setMeta]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('List') // 'List' | 'Add' | 'Edit'

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState(null)
  const [saveOk,  setSaveOk]  = useState(false)
  const [pwdCopied, setPwdCopied] = useState(false)

  const load = useCallback(async (p = 1) => {
    setLoading(true); setError(null)
    try {
      const res = await operatorApi.listBranchUsers(p, PER_PAGE)
      const data = res?.data ?? res ?? []
      setUsers(Array.isArray(data) ? data : [])
      setMeta(res?.meta ?? null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(1) }, [load])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCopyPassword() {
    if (!form.password) return
    try {
      await navigator.clipboard.writeText(form.password)
      setPwdCopied(true)
      setTimeout(() => setPwdCopied(false), 1500)
    } catch { /* clipboard unavailable — silently ignore */ }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault(); setSaveErr(null); setSaving(true); setSaveOk(false)
    try {
      if (tab === 'Edit') {
        await operatorApi.updateBranchUser({
          id: form.id,
          branchId,
          userName: form.userName,
          authorityCode: form.authorityCode || undefined,
          remark: form.remark || undefined,
          used: form.used,
        })
        logActivity({ action: 'UPDATE_BRANCH_USER', category: 'System', summary: `Updated branch user "${form.userName}"` })
      } else {
        await operatorApi.saveBranchUser({
          branchId,
          userName: form.userName,
          authorityCode: form.authorityCode || undefined,
          remark: form.remark || undefined,
          used: form.used,
        })
        logActivity({ action: 'SAVE_BRANCH_USER', category: 'System', summary: `Registered branch user "${form.userName}"` })
      }
      setSaveOk(true); setForm(EMPTY_FORM); load(meta?.currentPage || 1)
      setTimeout(() => { setSaveOk(false); setTab('List') }, 2000)
    } catch (err) {
      setSaveErr(err.data?.errors?.[0]?.message || err.message)
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this user? This cannot be undone.')) return
    try {
      await operatorApi.deleteBranchUser(id)
      logActivity({ action: 'DELETE_BRANCH_USER', category: 'System', summary: `Deleted branch user ID: ${id}` })
      load(meta?.currentPage || 1)
    } catch (err) { alert(err.message) }
  }

  async function exportAllData(format) {
    try {
      let all = []
      let page = 1, hasMore = true
      while (hasMore) {
        const res = await operatorApi.listBranchUsers(page, 50)
        const batch = res?.data ?? []
        all = [...all, ...batch]
        hasMore = (res?.meta?.currentPage || 0) < (res?.meta?.lastPage || 0)
        page++
      }
      if (format === 'print') printTableData(all)
      else exportCSVData(all)
    } catch (err) { alert('Export failed: ' + err.message) }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function openAdd() { setTab('Add'); setForm(EMPTY_FORM); setSaveErr(null); setSaveOk(false) }
  function openEdit(u) {
    setForm({
      id: u.id,
      userId: u.userId,
      userName: u.userName || u.userNm,
      authorityCode: u.authorityCode || u.userAuthorCd || '',
      used: u.used || u.useYn || 'Y',
      remark: u.remark || '',
      admnYn: u.admnYn || 'N'
    })
    setTab('Edit')
    setSaveErr(null)
    setSaveOk(false)
  }
  function backToList() { setTab('List') }

  // ── Derived ───────────────────────────────────────────────────────────────
  const total       = meta?.total ?? users.length
  const totalPages  = meta ? (meta.lastPage ?? Math.ceil(meta.total / PER_PAGE)) : 1
  const currentPage = meta?.currentPage ?? 1

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="page">
        
        {/* ── Header ── */}
        <div className="page-head">
          <div>
            <div className="crumbs">
              <span>Home</span><span>›</span>
              {tab === 'List' ? (
                <span>Branch Users</span>
              ) : (
                <>
                  <span style={{ cursor: 'pointer', color: 'var(--brand-600)' }} onClick={backToList}>Branch Users</span>
                  <span>›</span>
                  <span>{tab === 'Add' ? 'Register user' : 'Edit user'}</span>
                </>
              )}
            </div>
            <h1>{tab === 'Add' ? 'Register Branch User' : tab === 'Edit' ? 'Edit User Profile' : 'Branch Operators'}</h1>
          </div>
          <div className="page-head__actions">
            {tab === 'List' ? (
              <>
                <button className="icon-btn" title="Refresh" onClick={() => load(currentPage)}><IcoRefresh /></button>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn icon-btn--white" title="Export PDF" onClick={() => exportAllData('print')}><IcoPdf /></button>
                  <button className="icon-btn icon-btn--white" title="Export Excel" onClick={() => exportAllData('csv')}><IcoXlsx /></button>
                  <button className="icon-btn icon-btn--white" title="Export CSV" onClick={() => exportAllData('csv')}><IcoCsv /></button>
                </div>
                <button className="btn btn--primary" onClick={openAdd}>
                  <IcoPlus /> Add Operator
                </button>
              </>
            ) : (
              <button className="btn" onClick={backToList}>
                <IcoBack /> Back to database
              </button>
            )}
          </div>
        </div>

        {/* ── Reduced KPIs (List only) ── */}
        {tab === 'List' && (
          <div className="kpi-grid" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            <div className="kpi" style={{ padding: '8px 12px' }}>
              <div className="kpi__label" style={{ fontSize: 11 }}>Total Users</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{total}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>staff</span>
              </div>
            </div>
            <div className="kpi" style={{ padding: '8px 12px' }}>
              <div className="kpi__label" style={{ fontSize: 11 }}>Admins</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-600)' }}>{users.filter(u => u.admnYn === 'Y').length}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>full rights</span>
              </div>
            </div>
            <div className="kpi" style={{ padding: '8px 12px' }}>
              <div className="kpi__label" style={{ fontSize: 11 }}>Active</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ok)' }}>{users.filter(u => (u.used || u.useYn) !== 'N').length}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>online</span>
              </div>
            </div>
            <div className="kpi" style={{ padding: '8px 12px' }}>
              <div className="kpi__label" style={{ fontSize: 11 }}>Branch</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{branchId || '—'}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>id</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            LIST VIEW
        ═══════════════════════════════════════════════════ */}
        {tab === 'List' && (
          <div className="card">
            <div className="table-wrap">
              {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-400)' }}>
                   <div className="spinner" style={{ marginBottom: 12 }} />
                   <div>Fetching operators…</div>
                </div>
              ) : users.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-500)' }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No operators registered</div>
                  <div style={{ fontSize: 13, marginBottom: 16 }}>Register users to allow them to operate the EBM device.</div>
                  <button className="btn btn--primary btn--sm" onClick={openAdd}>Add First Operator</button>
                </div>
              ) : (
                <>
                  <table className="data data--hover">
                    <thead>
                      <tr>
                        <th>Operator Name</th>
                        <th>User ID</th>
                        <th>Role / Authority</th>
                        <th>Admin</th>
                        <th>Status</th>
                        <th style={{ width: 100 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => {
                        const initials = (u.userName || u.userNm || '??').slice(0, 2).toUpperCase()
                        const { bg, color } = avatarColor(u.userId || String(i))
                        const author = AUTHORITY_CODES.find(a => a.v === (u.authorityCode || u.userAuthorCd))?.l || 'Standard'
                        return (
                          <tr key={u.id || i}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, color, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>
                                  {initials}
                                </div>
                                <div style={{ fontWeight: 700, color: 'var(--ink-900)' }}>{u.userName || u.userNm || '—'}</div>
                              </div>
                            </td>
                            <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--brand-700)' }}>{u.userId}</code></td>
                            <td style={{ fontSize: 13 }}>{author}</td>
                            <td>
                              {u.admnYn === 'Y' 
                                ? <span className="chip chip--brand chip--plain">Admin</span> 
                                : <span className="chip chip--plain">User</span>}
                            </td>
                            <td>
                              {(u.used || u.useYn) !== 'N' 
                                ? <span className="chip chip--ok">Active</span> 
                                : <span className="chip chip--err">Inactive</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="icon-btn icon-btn--sm" title="Edit" onClick={() => openEdit(u)}><IcoEdit /></button>
                                <button className="icon-btn icon-btn--sm icon-btn--danger" title="Delete" onClick={() => handleDelete(u.id)}><IcoTrash /></button>
                              </div>
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
                        Showing {((currentPage-1)*PER_PAGE)+1}–{Math.min(currentPage*PER_PAGE, total)} of {total} operators
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
        )}

        {/* ═══════════════════════════════════════════════════
            ADD / EDIT FORM
        ═══════════════════════════════════════════════════ */}
        {(tab === 'Add' || tab === 'Edit') && (
          <div className="card" style={{ width: '100%' }}>
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>{tab === 'Add' ? 'Register New Operator' : 'Edit Operator Access'}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>Set credentials and authority levels for the branch device</p>
              </div>
              {saveOk && <span className="chip chip--ok">Changes applied ✓</span>}
            </div>
            <form onSubmit={handleSubmit}>
              <div className="card__body" style={{ padding: '24px 32px' }}>
                {saveErr && <div className="settings-error" style={{ marginBottom: 24 }}>{saveErr}</div>}
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px 32px' }}>
                   <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Full Name <span style={{ color: 'var(--err)' }}>*</span></label>
                      <input className="form-input" required placeholder="Enter operator's full name"
                        value={form.userName} onChange={e => set('userName', e.target.value)} />
                   </div>

                   <div className="form-group">
                      <label className="form-label">User ID <span style={{ color: 'var(--err)' }}>*</span></label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="form-input input--mono" required placeholder="E.g. user01" disabled={tab === 'Edit'}
                          value={form.userId} onChange={e => set('userId', e.target.value)} style={{ flex: 1 }} />
                        {tab === 'Add' && (
                          <button type="button" className="btn btn--sm" title="Auto-generate User ID"
                            onClick={() => set('userId', generateUserId())}
                            style={{ flexShrink: 0, gap: 5 }}>
                            <IcoMagic /> Gen
                          </button>
                        )}
                      </div>
                      <span className="form-hint">System identifier (unique)</span>
                   </div>

                   {tab === 'Add' && (
                     <div className="form-group">
                        <label className="form-label">Initial Password <span style={{ color: 'var(--err)' }}>*</span></label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input className="form-input" type="password" required placeholder="••••••••"
                            value={form.password} onChange={e => set('password', e.target.value)} style={{ flex: 1 }} />
                          <button type="button" className="btn btn--sm" title="Auto-generate password"
                            onClick={() => set('password', generatePassword())}
                            style={{ flexShrink: 0, gap: 5 }}>
                            <IcoMagic /> Gen
                          </button>
                          <button type="button" className="btn btn--sm" title="Copy password" disabled={!form.password}
                            onClick={handleCopyPassword}
                            style={{ flexShrink: 0, gap: 5 }}>
                            {pwdCopied ? '✓ Copied' : <><IcoCopy /> Copy</>}
                          </button>
                        </div>
                     </div>
                   )}

                   <div className="form-group">
                      <label className="form-label">Authority Role</label>
                      <select className="form-input" value={form.authorityCode} onChange={e => set('authorityCode', e.target.value)}>
                        <option value="">Standard Access</option>
                        {AUTHORITY_CODES.map(a => <option key={a.v} value={a.v}>{a.l} ({a.v})</option>)}
                      </select>
                   </div>

                   <div className="form-group">
                      <label className="form-label">Account Status</label>
                      <select className="form-input" value={form.used} onChange={e => set('used', e.target.value)}>
                        <option value="Y">Active / Enabled</option>
                        <option value="N">Inactive / Disabled</option>
                      </select>
                   </div>

                   <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Internal Remark</label>
                      <input className="form-input" placeholder="Any additional notes…"
                        value={form.remark} onChange={e => set('remark', e.target.value)} />
                   </div>
                </div>
              </div>

              <div className="card__foot" style={{ padding: '20px 32px', display: 'flex', gap: 12, background: 'var(--ink-50)' }}>
                <button type="submit" className="btn btn--primary btn--lg" disabled={saving}>
                  {saving ? 'Processing…' : tab === 'Add' ? 'Register Operator' : 'Update Access'}
                </button>
                <button type="button" className="btn btn--lg" onClick={backToList}>Cancel</button>
                {tab === 'Add' && (
                  <button type="button" className="btn btn--lg btn--ghost" style={{ marginLeft: 'auto' }} onClick={() => setForm(EMPTY_FORM)}>Reset</button>
                )}
              </div>
            </form>
          </div>
        )}

      </div>
    </AppShell>
  )
}
