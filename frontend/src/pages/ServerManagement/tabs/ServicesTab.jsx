import { useState } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { serviceStatusMeta, fmtDateTime } from '../constants'

const EMPTY = { name: '', version: '', status: 'Running', port: '', cpuUsage: '', ramUsage: '', autoStart: true }
const COMMON_SERVICES = ['Nginx', 'Apache', 'Node.js', 'PM2', 'MySQL', 'PostgreSQL', 'Redis', 'Docker', 'SSH', 'Firewall']

export default function ServicesTab({ serverId }) {
  const { rows, loading, error, setError, add, update, remove } = useSubcollection('servers', serverId, 'services', 'name')
  const { rows: logs } = useSubcollection('servers', serverId, 'logs', 'createdAt')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewLogsFor, setViewLogsFor] = useState(null)

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

  async function setStatus(row, status) {
    try {
      await update(row.id, { status, lastRestart: status === 'Restarting' || status === 'Running' ? new Date().toISOString() : row.lastRestart })
    } catch (err) { setError(err.message) }
  }

  async function toggleAutoStart(row) {
    try { await update(row.id, { autoStart: !row.autoStart }) } catch (err) { setError(err.message) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try { await remove(deleteTarget.id) } catch (err) { setError(err.message) } finally { setDeleteTarget(null) }
  }

  const filteredLogs = viewLogsFor ? logs.filter(l => (l.service || '').toLowerCase() === viewLogsFor.name.toLowerCase()) : []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={openAdd}>Add Service</button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No services tracked for this server yet.</div>
          ) : (
            <table className="data">
              <thead>
                <tr><th>Service</th><th>Version</th><th>Port</th><th>Status</th><th>CPU</th><th>RAM</th><th>Auto-start</th><th>Last Restart</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const sm = serviceStatusMeta(row.status)
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.name}</td>
                      <td className="mono">{row.version || '—'}</td>
                      <td className="mono">{row.port || '—'}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sm.bg, color: sm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot }} />{row.status}
                        </span>
                      </td>
                      <td>{row.cpuUsage ? `${row.cpuUsage}%` : '—'}</td>
                      <td>{row.ramUsage ? `${row.ramUsage}%` : '—'}</td>
                      <td>
                        <button className="btn btn--sm" onClick={() => toggleAutoStart(row)}>{row.autoStart ? 'Enabled' : 'Disabled'}</button>
                      </td>
                      <td style={{ fontSize: 12 }}>{row.lastRestart ? new Date(row.lastRestart).toLocaleString() : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {row.status !== 'Running' && <button className="btn btn--sm" onClick={() => setStatus(row, 'Running')}>Start</button>}
                          {row.status === 'Running' && <button className="btn btn--sm" onClick={() => setStatus(row, 'Stopped')}>Stop</button>}
                          <button className="btn btn--sm" onClick={() => setStatus(row, 'Restarting')}>Restart</button>
                          <button className="btn btn--sm" onClick={() => setViewLogsFor(row)}>Logs</button>
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
            <div className="modal__head"><h3>{editingId ? 'Edit Service' : 'Add Service'}</h3>
              <button className="modal__close" onClick={() => setShowForm(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Service Name *</label>
                  <input className="form-input" list="service-list" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Nginx" />
                  <datalist id="service-list">{COMMON_SERVICES.map(s => <option key={s} value={s} />)}</datalist>
                </div>
                <div className="form-group"><label className="form-label">Version</label><input className="form-input" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Port</label><input className="form-input" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">CPU Usage %</label><input className="form-input" type="number" value={form.cpuUsage} onChange={e => setForm(f => ({ ...f, cpuUsage: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">RAM Usage %</label><input className="form-input" type="number" value={form.ramUsage} onChange={e => setForm(f => ({ ...f, ramUsage: e.target.value }))} /></div>
              </div>
              <div className="modal__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>{saving ? 'Saving…' : 'Save Service'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewLogsFor && (
        <div className="modal-backdrop" onClick={() => setViewLogsFor(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal__head"><h3>Logs — {viewLogsFor.name}</h3>
              <button className="modal__close" onClick={() => setViewLogsFor(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="modal__body" style={{ maxHeight: 360, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12.5, background: 'var(--ink-900, #0b1120)', color: '#d1d5db', borderRadius: 8, padding: 14 }}>
              {filteredLogs.length === 0 ? (
                <div style={{ color: '#9ca3af' }}>No log entries tagged to service "{viewLogsFor.name}" yet. Add entries from the Logs tab with this service selected.</div>
              ) : filteredLogs.map(l => (
                <div key={l.id} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#6b7280' }}>[{fmtDateTime(l.createdAt)}]</span> <span style={{ fontWeight: 700 }}>{l.severity}</span> — {l.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Remove service?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>"{deleteTarget.name}" will no longer be tracked on this server.</div>
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
