import { useState } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { DEPLOYMENT_STATUSES, deploymentStatusMeta, ENVIRONMENTS, fmtDateTime } from '../constants'

const EMPTY = { application: '', version: '', status: 'Running', developer: '', branch: '', commit: '', environment: 'Production', logs: '', rollbackAvailable: true }

export default function DeploymentsTab({ serverId }) {
  const { rows, loading, error, setError, add, update, remove } = useSubcollection('servers', serverId, 'deployments', 'createdAt')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [logsTarget, setLogsTarget] = useState(null)

  function openAdd() { setEditingId(null); setForm(EMPTY); setShowForm(true) }
  function openEdit(row) { setEditingId(row.id); setForm({ ...EMPTY, ...row }); setShowForm(true) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.application.trim()) return
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

  async function rollback(row) {
    try { await update(row.id, { status: 'Rolled Back' }) } catch (err) { setError(err.message) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try { await remove(deleteTarget.id) } catch (err) { setError(err.message) } finally { setDeleteTarget(null) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={openAdd}>Log Deployment</button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No deployments tracked for this server yet.</div>
          ) : (
            <table className="data">
              <thead>
                <tr><th>Application</th><th>Version</th><th>Environment</th><th>Status</th><th>Branch / Commit</th><th>Developer</th><th>Deployed</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const dm = deploymentStatusMeta(row.status)
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.application}</td>
                      <td className="mono">{row.version || '—'}</td>
                      <td>{row.environment}</td>
                      <td><span style={{ background: dm.bg, color: dm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{row.status}</span></td>
                      <td className="mono" style={{ fontSize: 12 }}>{row.branch || '—'}{row.commit ? ` @ ${row.commit.slice(0, 7)}` : ''}</td>
                      <td>{row.developer || '—'}</td>
                      <td>{fmtDateTime(row.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {row.rollbackAvailable && row.status !== 'Rolled Back' && <button className="btn btn--sm" onClick={() => rollback(row)}>Rollback</button>}
                          {row.logs && <button className="btn btn--sm" onClick={() => setLogsTarget(row)}>Logs</button>}
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
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal__head"><h3>{editingId ? 'Edit Deployment' : 'Log Deployment'}</h3>
              <button className="modal__close" onClick={() => setShowForm(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Application *</label>
                  <input className="form-input" value={form.application} onChange={e => setForm(f => ({ ...f, application: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Version</label>
                  <input className="form-input" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="e.g. v2.4.1" />
                </div>
                <div className="form-group">
                  <label className="form-label">Environment</label>
                  <select className="form-input" value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}>
                    {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {DEPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Developer</label>
                  <input className="form-input" value={form.developer} onChange={e => setForm(f => ({ ...f, developer: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input className="form-input" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} placeholder="e.g. main" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Commit</label>
                  <input className="form-input mono" value={form.commit} onChange={e => setForm(f => ({ ...f, commit: e.target.value }))} placeholder="commit hash" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Deployment Logs</label>
                  <textarea className="form-input form-input--textarea" value={form.logs} onChange={e => setForm(f => ({ ...f, logs: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Rollback Available</label>
                  <select className="form-input" value={String(form.rollbackAvailable)} onChange={e => setForm(f => ({ ...f, rollbackAvailable: e.target.value === 'true' }))}>
                    <option value="true">Yes</option><option value="false">No</option>
                  </select>
                </div>
              </div>
              <div className="modal__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>{saving ? 'Saving…' : 'Save Deployment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {logsTarget && (
        <div className="modal-backdrop" onClick={() => setLogsTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal__head"><h3>Deployment Logs — {logsTarget.application}</h3>
              <button className="modal__close" onClick={() => setLogsTarget(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="modal__body" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, background: '#0b1120', color: '#d1d5db', borderRadius: 8, padding: 14, whiteSpace: 'pre-wrap', maxHeight: 360, overflowY: 'auto' }}>
              {logsTarget.logs}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete deployment record?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>"{deleteTarget.application} {deleteTarget.version}" will be permanently removed.</div>
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
