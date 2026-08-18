import { useState } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { volumeStatusMeta, VOLUME_STATUSES } from '../constants'

const EMPTY = { name: '', kind: 'Volume', sizeGb: '', mountPath: '', filesystem: '', status: 'Attached' }

export default function VolumesTab({ deviceId }) {
  const { rows, loading, error, setError, add, update, remove } = useSubcollection('storageDevices', deviceId, 'volumes', 'name')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function openAdd() { setEditingId(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(row) { setEditingId(row.id); setForm({ ...EMPTY, ...row }); setShowForm(true) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (editingId) await update(editingId, form)
      else await add(form)
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try { await remove(deleteTarget.id) } catch (err) { setError(err.message) } finally { setDeleteTarget(null) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={openAdd}>Add Volume</button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No volumes or partitions tracked for this device yet.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Name</th><th>Kind</th><th>Size</th><th>Mount Path</th><th>Filesystem</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {rows.map(row => {
                  const vm = volumeStatusMeta(row.status)
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td>{row.kind}</td>
                      <td>{row.sizeGb ? `${row.sizeGb} GB` : '—'}</td>
                      <td className="mono">{row.mountPath || '—'}</td>
                      <td>{row.filesystem || '—'}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: vm.bg, color: vm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: vm.dot }} />{row.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn--sm" onClick={() => openEdit(row)}>Edit</button>
                          <button className="btn btn--sm btn--danger" onClick={() => setDeleteTarget(row)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal__head"><h3>{editingId ? 'Edit Volume' : 'Add Volume'}</h3>
              <button className="modal__close" onClick={() => setShowForm(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. data-vol-01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Kind</label>
                  <select className="form-input" value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}>
                    <option>Volume</option><option>Partition</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {VOLUME_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Size (GB)</label>
                  <input className="form-input" type="number" value={form.sizeGb} onChange={e => setForm(f => ({ ...f, sizeGb: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Filesystem</label>
                  <input className="form-input" value={form.filesystem} onChange={e => setForm(f => ({ ...f, filesystem: e.target.value }))} placeholder="e.g. ext4, NTFS, ZFS" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Mount Path</label>
                  <input className="form-input mono" value={form.mountPath} onChange={e => setForm(f => ({ ...f, mountPath: e.target.value }))} placeholder="e.g. /mnt/data" />
                </div>
              </div>
              <div className="modal__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>{saving ? 'Saving…' : 'Save Volume'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Remove volume?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>"{deleteTarget.name}" will no longer be tracked on this device.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn--danger" onClick={confirmDelete}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
