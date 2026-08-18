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
  STATUSES, statusMeta, STORAGE_TYPES, DISK_TYPES,
  EMPTY_STORAGE_FORM, genDeviceId, pct,
} from './constants'

const GROUP_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'provider', label: 'Group by provider' },
  { value: 'type', label: 'Group by type' },
  { value: 'status', label: 'Group by status' },
]

const SORT_COLUMNS = [
  { key: 'name', label: 'Device' },
  { key: 'type', label: 'Type' },
  { key: 'provider', label: 'Provider' },
  { key: 'capacity', label: 'Usage' },
  { key: 'status', label: 'Status' },
]

function usagePct(d) { return pct(d.capacityUsedGb, d.capacityTotalGb) }

function sortValue(d, key) {
  if (key === 'capacity') return usagePct(d)
  return (d[key] || '').toString().toLowerCase()
}

function barColor(v) {
  if (v >= 90) return '#ef4444'
  if (v >= 70) return '#f59e0b'
  return '#22c55e'
}

function MiniBar({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}>
      <div style={{ width: 60, height: 6, borderRadius: 4, background: 'var(--ink-100)', overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: barColor(v), borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--ink-600)', fontVariantNumeric: 'tabular-nums' }}>{v}%</span>
    </div>
  )
}

export default function StorageManagement() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [view, setView] = useState('list')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_STORAGE_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterType, setFilterType] = useState('All')
  const [groupBy, setGroupBy] = useState('none')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'storageDevices'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setDevices(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [])

  const counts = useMemo(() => {
    const totalCapacity = devices.reduce((sum, d) => sum + (Number(d.capacityTotalGb) || 0), 0)
    const usedCapacity = devices.reduce((sum, d) => sum + (Number(d.capacityUsedGb) || 0), 0)
    return {
      total: devices.length,
      online: devices.filter(d => d.status === 'Online').length,
      critical: devices.filter(d => d.status === 'Critical').length,
      totalCapacity, usedCapacity,
      usedPct: totalCapacity ? Math.round((usedCapacity / totalCapacity) * 100) : 0,
    }
  }, [devices])

  const providers = useMemo(() => [...new Set(devices.map(d => d.provider).filter(Boolean))].sort(), [devices])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = devices.filter(d => {
      if (filterStatus !== 'All' && d.status !== filterStatus) return false
      if (filterType !== 'All' && d.type !== filterType) return false
      if (q && !`${d.name} ${d.ip} ${d.provider} ${d.deviceId}`.toLowerCase().includes(q)) return false
      return true
    })
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key), bv = sortValue(b, sort.key)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [devices, search, filterStatus, filterType, sort])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map()
    filtered.forEach(d => {
      const k = d[groupBy] || '—'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(d)
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
    setForm({ ...EMPTY_STORAGE_FORM, deviceId: genDeviceId() })
    setFormErrors({})
    setView('form')
  }

  function openEdit(d) {
    setEditingId(d.id)
    setForm({ ...EMPTY_STORAGE_FORM, ...d })
    setFormErrors({})
    setView('form')
  }

  function backToList() {
    setView('list')
    setEditingId(null)
    setForm(EMPTY_STORAGE_FORM)
    setFormErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!form.name.trim()) errors.name = true
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, name: form.name.trim(), updatedAt: serverTimestamp() }
      if (editingId) {
        await updateDoc(doc(db, 'storageDevices', editingId), payload)
        logActivity({ action: 'UPDATE_STORAGE_DEVICE', category: 'Storage Management', summary: `Updated storage device: ${payload.name}` })
      } else {
        await addDoc(collection(db, 'storageDevices'), { ...payload, createdAt: serverTimestamp() })
        logActivity({ action: 'CREATE_STORAGE_DEVICE', category: 'Storage Management', summary: `Added storage device: ${payload.name}` })
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
      await deleteDoc(doc(db, 'storageDevices', deleteTarget.id))
      logActivity({ action: 'DELETE_STORAGE_DEVICE', category: 'Storage Management', summary: `Deleted storage device: ${deleteTarget.name}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteTarget(null)
    }
  }

  function renderRow(d) {
    const sm = statusMeta(d.status)
    const up = usagePct(d)
    return (
      <tr key={d.id}>
        <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate(`/storage-management/${d.id}`)}>
          <div>{d.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', fontWeight: 500 }}>{d.deviceId || '—'}</div>
        </td>
        <td>{d.type || '—'}</td>
        <td>{d.provider || '—'}</td>
        <td className="mono">{d.ip || '—'}</td>
        <td>{d.capacityTotalGb ? `${d.capacityUsedGb || 0} / ${d.capacityTotalGb} GB` : '—'}</td>
        <td><MiniBar value={up} /></td>
        <td>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sm.bg, color: sm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot }} />{d.status}
          </span>
        </td>
        <td style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn--sm" onClick={() => navigate(`/storage-management/${d.id}`)}>View</button>
            <button className="btn btn--sm" onClick={() => openEdit(d)}>Edit</button>
            <button className="btn btn--sm btn--danger" onClick={() => setDeleteTarget(d)}>Delete</button>
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
                <div className="crumbs"><span>Home</span><span>›</span><span>Storage Management</span></div>
                <h1>Storage Management</h1>
              </div>
              <div className="page-head__actions">
                <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={openAdd}>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                  Add Storage Device
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>TOTAL DEVICES</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#4338ca', marginTop: 6 }}>{counts.total}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>ONLINE</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#15803d', marginTop: 6 }}>{counts.online}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>CRITICAL</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#b91c1c', marginTop: 6 }}>{counts.critical}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>TOTAL CAPACITY USED</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: barColor(counts.usedPct), marginTop: 6 }}>{counts.usedPct}%</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{counts.usedCapacity} / {counts.totalCapacity} GB</div>
              </div>
            </div>

            <div className="card" style={{ padding: '14px 16px', marginBottom: 18, marginLeft: 5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 9, padding: '9px 12px', minWidth: 220, flex: 1, maxWidth: 280 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search name, IP, provider…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%', color: 'var(--ink-900)' }}
                />
              </div>
              <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
                <option value="All">All statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}>
                <option value="All">All types</option>
                {STORAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                {GROUP_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{filtered.length} devices</div>
            </div>

            {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

            {loading ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading storage devices…</div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No storage devices found</div>
                <div style={{ fontSize: 13 }}>{devices.length === 0 ? 'Click "Add Storage Device" to register your first one.' : 'No devices match your filters.'}</div>
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
                        <th>IP Address</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped
                        ? grouped.map(([groupName, rows]) => (
                          <GroupSection key={groupName} groupName={groupName} rows={rows} renderRow={renderRow} />
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
          <StorageForm
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
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This permanently removes the device record and its tracked volumes, snapshots, backups and alerts. This can't be undone.</div>
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

function GroupSection({ groupName, rows, renderRow }) {
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

function StorageForm({ form, setForm, formErrors, editingId, saving, error, providers, onSubmit, onCancel }) {
  const set = (field) => e => setForm(f => ({ ...f, [field]: e.target.value }))
  return (
    <div>
      <div onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-500)', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to Storage Management
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 20px' }}>{editingId ? `Edit Storage Device: ${form.name}` : 'Add Storage Device'}</h1>

      <form onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Basic Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Device Name *</label>
                  <input className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. nas-primary-01" style={formErrors.name ? { borderColor: '#dc2626' } : undefined} />
                  {formErrors.name && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Name is required</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Device ID</label>
                  <input className="form-input mono" value={form.deviceId} onChange={set('deviceId')} placeholder="STG-XXXXXX" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={set('status')}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.type} onChange={set('type')}>
                    {STORAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <input className="form-input" list="storage-provider-list" value={form.provider} onChange={set('provider')} placeholder="e.g. on-prem, AWS S3" />
                  <datalist id="storage-provider-list">{providers.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={form.location} onChange={set('location')} placeholder="e.g. Server Room · Rack 2" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">IP Address</label>
                  <input className="form-input" value={form.ip} onChange={set('ip')} placeholder="e.g. 10.10.1.30" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Attached Servers</label>
                  <input className="form-input" value={form.attachedServers} onChange={set('attachedServers')} placeholder="e.g. app-prod-01, esxi-host-2" />
                </div>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Capacity &amp; Disks</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Total Capacity (GB)</label>
                  <input className="form-input" type="number" value={form.capacityTotalGb} onChange={set('capacityTotalGb')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Used Capacity (GB)</label>
                  <input className="form-input" type="number" value={form.capacityUsedGb} onChange={set('capacityUsedGb')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Disk Type</label>
                  <select className="form-input" value={form.diskType} onChange={set('diskType')}>
                    {DISK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Number of Disks</label>
                  <input className="form-input" type="number" value={form.numDisks} onChange={set('numDisks')} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">RAID Level</label>
                  <input className="form-input" value={form.raidLevel} onChange={set('raidLevel')} placeholder="e.g. RAID 10" />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Performance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">IOPS</label>
                  <input className="form-input" type="number" value={form.iops} onChange={set('iops')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Throughput (MB/s)</label>
                  <input className="form-input" type="number" value={form.throughputMbps} onChange={set('throughputMbps')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Latency (ms)</label>
                  <input className="form-input" type="number" value={form.latencyMs} onChange={set('latencyMs')} />
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
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Storage Device'}
          </button>
        </div>
      </form>
    </div>
  )
}
