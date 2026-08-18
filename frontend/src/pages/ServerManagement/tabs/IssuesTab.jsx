import { useState } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import {
  ISSUE_SEVERITIES, issueSeverityMeta, ISSUE_STATUSES, issueStatusMeta, fmtDateTime,
} from '../constants'
import { serverTimestamp } from 'firebase/firestore'

const EMPTY = { title: '', severity: 'Medium', description: '', status: 'Open', assignedTo: '', resolution: '' }

export default function IssuesTab({ serverId }) {
  const { rows, loading, error, setError, add, update, remove } = useSubcollection('servers', serverId, 'issues', 'createdAt')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function openAdd() { setEditingId(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(row) { setEditingId(row.id); setForm({ ...EMPTY, ...row }); setShowForm(true) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
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

  async function resolve(row) {
    try {
      await update(row.id, { status: 'Resolved', resolution: row.resolution || 'Marked resolved', resolvedAt: serverTimestamp() })
    } catch (err) {
      setError(err.message)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try { await remove(deleteTarget.id) } catch (err) { setError(err.message) } finally { setDeleteTarget(null) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={openAdd}>Report Issue</button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No issues reported for this server.</div>
          ) : (
            <table className="data">
              <thead>
                <tr><th>Issue</th><th>Severity</th><th>Status</th><th>Assigned</th><th>Detected</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const sev = issueSeverityMeta(row.severity)
                  const st = issueStatusMeta(row.status)
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.title}</td>
                      <td><span style={{ background: sev.bg, color: sev.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{row.severity}</span></td>
                      <td><span style={{ background: st.bg, color: st.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{row.status}</span></td>
                      <td>{row.assignedTo || '—'}</td>
                      <td>{fmtDateTime(row.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {row.status !== 'Resolved' && <button className="btn btn--sm" onClick={() => resolve(row)}>Resolve</button>}
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
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal__head"><h3>{editingId ? 'Edit Issue' : 'Report Issue'}</h3>
              <button className="modal__close" onClick={() => setShowForm(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Issue Title *</label>
                  <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. High CPU usage sustained" />
                </div>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                    {ISSUE_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {ISSUE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Description</label>
                  <textarea className="form-input form-input--textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Assigned Person</label>
                  <input className="form-input" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Resolution</label>
                  <input className="form-input" value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} placeholder="How it was / will be resolved" />
                </div>
              </div>
              <div className="modal__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>{saving ? 'Saving…' : 'Save Issue'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete issue?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>"{deleteTarget.title}" will be permanently removed.</div>
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
