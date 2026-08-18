import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { logActivity } from '../../hooks/useActivityLog'
import {
  STATUSES, statusMeta, SERVER_TYPES, ENVIRONMENTS,
  EMPTY_SERVER_FORM, genServerId, pct,
} from './constants'

const GROUP_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'provider', label: 'Group by provider' },
  { value: 'environment', label: 'Group by environment' },
  { value: 'status', label: 'Group by status' },
]

const SORT_COLUMNS = [
  { key: 'name', label: 'Server' },
  { key: 'ip', label: 'IP Address' },
  { key: 'provider', label: 'Provider' },
  { key: 'cpuUsage', label: 'CPU' },
  { key: 'ram', label: 'RAM' },
  { key: 'storage', label: 'Storage' },
  { key: 'status', label: 'Status' },
  { key: 'uptimeDays', label: 'Uptime' },
]

function ramPct(s) { return pct(s.ramUsedGb, s.ramTotalGb) }
function storagePct(s) { return pct(s.storageUsedGb, s.storageTotalGb) }

function sortValue(s, key) {
  switch (key) {
    case 'ram': return ramPct(s)
    case 'storage': return storagePct(s)
    case 'cpuUsage': return Number(s.cpuUsage) || 0
    case 'uptimeDays': return Number(s.uptimeDays) || 0
    default: return (s[key] || '').toString().toLowerCase()
  }
}

function MiniBar({ value, color }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 72 }}>
      <div style={{ width: 46, height: 6, borderRadius: 4, background: 'var(--ink-100)', overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--ink-600)', fontVariantNumeric: 'tabular-nums' }}>{v}%</span>
    </div>
  )
}

function barColor(v) {
  if (v >= 90) return '#ef4444'
  if (v >= 70) return '#f59e0b'
  return '#22c55e'
}

export default function ServerManagement() {
  const navigate = useNavigate()
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [view, setView] = useState('list') // list | form
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_SERVER_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterEnv, setFilterEnv] = useState('All')
  const [groupBy, setGroupBy] = useState('none')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'servers'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setServers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [])

  const counts = useMemo(() => ({
    total: servers.length,
    online: servers.filter(s => s.status === 'Online').length,
    offline: servers.filter(s => s.status === 'Offline').length,
    critical: servers.filter(s => s.status === 'Critical').length,
  }), [servers])

  const providers = useMemo(() => [...new Set(servers.map(s => s.provider).filter(Boolean))].sort(), [servers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = servers.filter(s => {
      if (filterStatus !== 'All' && s.status !== filterStatus) return false
      if (filterEnv !== 'All' && s.environment !== filterEnv) return false
      if (q && !`${s.name} ${s.ip} ${s.hostname} ${s.provider} ${s.serverId}`.toLowerCase().includes(q)) return false
      return true
    })
    const sorted = [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key), bv = sortValue(b, sort.key)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [servers, search, filterStatus, filterEnv, sort])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    const key = groupBy === 'provider' ? 'provider' : groupBy === 'environment' ? 'environment' : 'status'
    const map = new Map()
    filtered.forEach(s => {
      const k = s[key] || '—'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(s)
    })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length)
  const pageItems = groupBy === 'none' ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize) : filtered

  function toggleSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  function openAdd() {
    setEditingId(null)
    setForm({ ...EMPTY_SERVER_FORM, serverId: genServerId() })
    setFormErrors({})
    setView('form')
  }

  function openEdit(s) {
    setEditingId(s.id)
    setForm({ ...EMPTY_SERVER_FORM, ...s })
    setFormErrors({})
    setView('form')
  }

  function backToList() {
    setView('list')
    setEditingId(null)
    setForm(EMPTY_SERVER_FORM)
    setFormErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.name.trim()) errors.name = true
    if (!form.ip.trim()) errors.ip = true
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, name: form.name.trim(), updatedAt: serverTimestamp() }
      if (editingId) {
        await updateDoc(doc(db, 'servers', editingId), payload)
        logActivity({ action: 'UPDATE_SERVER', category: 'Server Management', summary: `Updated server: ${payload.name}` })
      } else {
        await addDoc(collection(db, 'servers'), { ...payload, createdAt: serverTimestamp() })
        logActivity({ action: 'CREATE_SERVER', category: 'Server Management', summary: `Added server: ${payload.name}` })
      }
      backToList()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'servers', deleteTarget.id))
      logActivity({ action: 'DELETE_SERVER', category: 'Server Management', summary: `Deleted server: ${deleteTarget.name}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteTarget(null)
    }
  }

  function renderRow(s) {
    const sm = statusMeta(s.status)
    const rp = ramPct(s), sp = storagePct(s), cp = Math.max(0, Math.min(100, Number(s.cpuUsage) || 0))
    return (
      <tr key={s.id}>
        <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate(`/server-management/${s.id}`)}>
          <div>{s.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', fontWeight: 500 }}>{s.serverId || '—'}</div>
        </td>
        <td className="mono">{s.ip || '—'}</td>
        <td>{s.provider || '—'}</td>
        <td><MiniBar value={cp} color={barColor(cp)} /></td>
        <td><MiniBar value={rp} color={barColor(rp)} /></td>
        <td><MiniBar value={sp} color={barColor(sp)} /></td>
        <td>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sm.bg, color: sm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot }} />{s.status}
          </span>
        </td>
        <td>{s.uptimeDays ? `${s.uptimeDays}d` : '—'}</td>
        <td style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn--sm" onClick={() => navigate(`/server-management/${s.id}`)}>View</button>
            <button className="btn btn--sm" onClick={() => openEdit(s)}>Edit</button>
            <button className="btn btn--sm btn--danger" onClick={() => setDeleteTarget(s)}>Delete</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <AppShell>
      <div className="page">
        {view === 'list' ? (
          <>
            <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
              <div>
                <div className="crumbs"><span>Home</span><span>›</span><span>Server Management</span></div>
                <h1>Server Management</h1>
              </div>
              <div className="page-head__actions">
                <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={openAdd}>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  Add Server
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              {[
                ['TOTAL SERVERS', counts.total, '#4338ca', '#eef2ff'],
                ['ONLINE', counts.online, '#15803d', '#dcfce7'],
                ['OFFLINE', counts.offline, '#475569', '#f1f5f9'],
                ['CRITICAL', counts.critical, '#b91c1c', '#fee2e2'],
              ].map(([label, val, color, bg]) => (
                <div key={label} className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 6 }}>{val}</div>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: bg, marginTop: -30, marginLeft: 'auto' }} />
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '14px 16px', marginBottom: 18, marginLeft: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 9, padding: '9px 12px', minWidth: 220, flex: 1, maxWidth: 280 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search name, IP, hostname, provider…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--ink-900)' }}
                />
              </div>
              <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
                <option value="All">All statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={filterEnv} onChange={e => { setFilterEnv(e.target.value); setPage(1) }}>
                <option value="All">All environments</option>
                {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                {GROUP_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{filtered.length} servers</div>
            </div>

            {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

            {loading ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading servers…</div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No servers found</div>
                <div style={{ fontSize: 13 }}>{servers.length === 0 ? 'Click "Add Server" to register your first one.' : 'No servers match your filters.'}</div>
              </div>
            ) : (
              <div className="card" style={{ marginLeft: 5 }}>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        {SORT_COLUMNS.map(c => (
                          <th key={c.key} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(c.key)}>
                            {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                          </th>
                        ))}
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped
                        ? grouped.map(([groupName, rows]) => (
                          <FragmentGroup key={groupName} groupName={groupName} rows={rows} renderRow={renderRow} />
                        ))
                        : pageItems.map(renderRow)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!loading && filtered.length > 0 && groupBy === 'none' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, marginLeft: 5, flexWrap: 'wrap', gap: 12, background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-500)' }}>
                  Showing {rangeStart}–{rangeEnd} of {filtered.length}
                  <select className="form-input" style={{ width: 'auto', padding: '6px 8px', fontSize: 12 }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="btn btn--sm" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>Page {currentPage} of {totalPages}</span>
                  <button className="btn btn--sm" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <ServerForm
            form={form} setForm={setForm} formErrors={formErrors}
            editingId={editingId} saving={saving} error={error}
            providers={providers}
            onSubmit={handleSubmit} onCancel={backToList}
          />
        )}
      </div>

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete {deleteTarget.name}?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This permanently removes the server record and its tracked issues, services, logs, backups and deployments. This can't be undone.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn--danger" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function FragmentGroup({ groupName, rows, renderRow }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <tr>
        <td colSpan={9} style={{ background: 'var(--ink-50)', cursor: 'pointer', fontWeight: 700, fontSize: 12.5 }} onClick={() => setOpen(o => !o)}>
          {open ? '▾' : '▸'} {groupName} <span style={{ color: 'var(--ink-500)', fontWeight: 500 }}>· {rows.length}</span>
        </td>
      </tr>
      {open && rows.map(renderRow)}
    </>
  )
}

function ServerForm({ form, setForm, formErrors, editingId, saving, error, providers, onSubmit, onCancel }) {
  const set = (field) => e => setForm(f => ({ ...f, [field]: e.target.value }))
  return (
    <div>
      <div onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-500)', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to Server Management
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px' }}>{editingId ? `Edit Server: ${form.name}` : 'Add Server'}</h1>

      <form onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Basic Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Server Name *</label>
                  <input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. app-prod-01" style={formErrors.name ? { borderColor: '#dc2626' } : undefined} />
                  {formErrors.name && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Name is required</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Server ID</label>
                  <input className="form-input mono" value={form.serverId} onChange={set('serverId')} placeholder="SRV-XXXXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={set('status')}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Server Type</label>
                  <select className="form-input" value={form.type} onChange={set('type')}>
                    {SERVER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <input className="form-input" list="provider-list" value={form.provider} onChange={set('provider')} placeholder="e.g. AWS, on-prem" />
                  <datalist id="provider-list">{providers.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Location / Datacenter</label>
                  <input className="form-input" value={form.location} onChange={set('location')} placeholder="e.g. Server Room · Rack 2" />
                </div>
                <div className="form-group">
                  <label className="form-label">Environment</label>
                  <select className="form-input" value={form.environment} onChange={set('environment')}>
                    {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Server Role</label>
                  <input className="form-input" value={form.role} onChange={set('role')} placeholder="e.g. Web, DB, App" />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Network</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">IP Address *</label>
                  <input className="form-input" value={form.ip} onChange={set('ip')} placeholder="e.g. 10.10.1.24" style={formErrors.ip ? { borderColor: '#dc2626' } : undefined} />
                  {formErrors.ip && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>IP address is required</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">SSH Port</label>
                  <input className="form-input" value={form.sshPort} onChange={set('sshPort')} placeholder="22" />
                </div>
                <div className="form-group">
                  <label className="form-label">Public IP</label>
                  <input className="form-input" value={form.publicIp} onChange={set('publicIp')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Private IP</label>
                  <input className="form-input" value={form.privateIp} onChange={set('privateIp')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hostname</label>
                  <input className="form-input" value={form.hostname} onChange={set('hostname')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Domain</label>
                  <input className="form-input" value={form.domain} onChange={set('domain')} />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Operating System</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Operating System</label>
                  <input className="form-input" value={form.os} onChange={set('os')} placeholder="e.g. Ubuntu, Windows Server" />
                </div>
                <div className="form-group">
                  <label className="form-label">OS Version</label>
                  <input className="form-input" value={form.osVersion} onChange={set('osVersion')} placeholder="e.g. 22.04 LTS" />
                </div>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Hardware</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">CPU Model</label>
                  <input className="form-input" value={form.cpuModel} onChange={set('cpuModel')} placeholder="e.g. Intel Xeon Gold 6248" />
                </div>
                <div className="form-group">
                  <label className="form-label">CPU Cores</label>
                  <input className="form-input" type="number" value={form.cpuCores} onChange={set('cpuCores')} />
                </div>
                <div className="form-group">
                  <label className="form-label">CPU Threads</label>
                  <input className="form-input" type="number" value={form.cpuThreads} onChange={set('cpuThreads')} />
                </div>
                <div className="form-group">
                  <label className="form-label">RAM Total (GB)</label>
                  <input className="form-input" type="number" value={form.ramTotalGb} onChange={set('ramTotalGb')} />
                </div>
                <div className="form-group">
                  <label className="form-label">RAM Used (GB)</label>
                  <input className="form-input" type="number" value={form.ramUsedGb} onChange={set('ramUsedGb')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Storage Total (GB)</label>
                  <input className="form-input" type="number" value={form.storageTotalGb} onChange={set('storageTotalGb')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Storage Used (GB)</label>
                  <input className="form-input" type="number" value={form.storageUsedGb} onChange={set('storageUsedGb')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Disk Type</label>
                  <input className="form-input" value={form.diskType} onChange={set('diskType')} placeholder="e.g. NVMe SSD" />
                </div>
                <div className="form-group">
                  <label className="form-label">Number of Disks</label>
                  <input className="form-input" type="number" value={form.diskCount} onChange={set('diskCount')} />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Monitoring &amp; Backup Configuration</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Monitoring Enabled</label>
                  <select className="form-input" value={String(form.monitoringEnabled)} onChange={e => setForm(f => ({ ...f, monitoringEnabled: e.target.value === 'true' }))}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Backup Enabled</label>
                  <select className="form-input" value={String(form.backupEnabled)} onChange={e => setForm(f => ({ ...f, backupEnabled: e.target.value === 'true' }))}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Backup Frequency</label>
                  <select className="form-input" value={form.backupFrequency} onChange={set('backupFrequency')}>
                    <option>Hourly</option><option>Daily</option><option>Weekly</option><option>Monthly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Backup Retention (days)</label>
                  <input className="form-input" type="number" value={form.backupRetentionDays} onChange={set('backupRetentionDays')} />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Notes</div>
              <textarea className="form-input form-input--textarea" value={form.notes} onChange={set('notes')} placeholder="Any additional context…" />
            </div>

          </div>
        </div>

        {error && <div className="settings-error" style={{ margin: '18px 0 0' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Server'}
          </button>
        </div>
      </form>
    </div>
  )
}
