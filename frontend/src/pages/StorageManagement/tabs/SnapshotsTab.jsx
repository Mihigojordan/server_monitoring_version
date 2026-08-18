import { useState } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { snapshotStatusMeta, SNAPSHOT_STATUSES, fmtDateTime } from '../constants'

const EMPTY = { name: '', sizeGb: '', retentionDays: '30', status: 'Completed' }

export default function SnapshotsTab({ deviceId }) {
  const { rows, loading, error, setError, add, remove } = useSubcollection('storageDevices', deviceId, 'snapshots', 'createdAt')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await add(form)
      setShowForm(false)
      setForm(EMPTY)
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
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={() => setShowForm(true)}>Create Snapshot</button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No snapshots recorded for this device yet.</div>
          ) : (
            <table className="data">
              <thead><tr><th>Name</th><th>Created</th><th>Size</th><th>Retention</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {rows.map(row => {
                  const sm = snapshotStatusMeta(row.status)
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td>{fmtDateTime(row.createdAt)}</td>
                      <td>{row.sizeGb ? `${row.sizeGb} GB` : '—'}</td>
                      <td>{row.retentionDays ? `${row.retentionDays} days` : '—'}</td>
                      <td><span style={{ background: sm.bg, color: sm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{row.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn--sm btn--danger" onClick={() => setDeleteTarget(row)}>Delete</button>
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
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal__head"><h3>Create Snapshot</h3>
              <button className="modal__close" onClick={() => setShowForm(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Snapshot Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. pre-upgrade-2026-08" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {SNAPSHOT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Size (GB)</label>
                  <input className="form-input" type="number" value={form.sizeGb} onChange={e => setForm(f => ({ ...f, sizeGb: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Retention (days)</label>
                  <input className="form-input" type="number" value={form.retentionDays} onChange={e => setForm(f => ({ ...f, retentionDays: e.target.value }))} />
                </div>
              </div>
              <div className="modal__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>{saving ? 'Saving…' : 'Create Snapshot'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete snapshot?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This removes the record from your tracking history — it doesn't delete any actual snapshot data.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn--danger" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
