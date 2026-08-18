import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { backupStatusMeta, fmtDateTime } from '../constants'

const EMPTY = { status: 'Success', sizeGb: '', location: '', type: 'Manual', notes: '' }

function nextScheduled(lastBackup, frequency) {
  if (!lastBackup?.toDate) return null
  const days = { Hourly: 1 / 24, Daily: 1, Weekly: 7, Monthly: 30 }[frequency] ?? 1
  return new Date(lastBackup.toDate().getTime() + days * 86400000)
}

export default function BackupsTab({ serverId, server: s }) {
  const { rows, loading, error, setError, add, remove } = useSubcollection('servers', serverId, 'backups', 'createdAt')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [schedule, setSchedule] = useState({
    backupEnabled: s?.backupEnabled ?? true,
    backupFrequency: s?.backupFrequency || 'Daily',
    backupRetentionDays: s?.backupRetentionDays || '30',
  })
  const [savingSchedule, setSavingSchedule] = useState(false)

  const last = rows[0]
  const next = last ? nextScheduled(last.createdAt, schedule.backupFrequency) : null

  async function handleCreate(e) {
    e.preventDefault()
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

  async function saveSchedule() {
    setSavingSchedule(true)
    try {
      await updateDoc(doc(db, 'servers', serverId), schedule)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSchedule(false)
    }
  }

  function download(row) {
    const text = `Backup record\nServer: ${s?.name}\nCreated: ${fmtDateTime(row.createdAt)}\nStatus: ${row.status}\nSize: ${row.sizeGb || '—'} GB\nLocation: ${row.location || '—'}\nType: ${row.type}\nNotes: ${row.notes || '—'}\n`
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-${row.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try { await remove(deleteTarget.id) } catch (err) { setError(err.message) } finally { setDeleteTarget(null) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>LAST BACKUP</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{last ? fmtDateTime(last.createdAt) : 'Never'}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>NEXT SCHEDULED</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{schedule.backupEnabled && next ? next.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>RESTORE POINTS</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{rows.filter(r => r.status === 'Success').length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Backup Schedule Configuration</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Backups Enabled</label>
            <select className="form-input" value={String(schedule.backupEnabled)} onChange={e => setSchedule(f => ({ ...f, backupEnabled: e.target.value === 'true' }))}>
              <option value="true">Enabled</option><option value="false">Disabled</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Frequency</label>
            <select className="form-input" value={schedule.backupFrequency} onChange={e => setSchedule(f => ({ ...f, backupFrequency: e.target.value }))}>
              <option>Hourly</option><option>Daily</option><option>Weekly</option><option>Monthly</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Retention (days)</label>
            <input className="form-input" type="number" value={schedule.backupRetentionDays} onChange={e => setSchedule(f => ({ ...f, backupRetentionDays: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={saveSchedule} disabled={savingSchedule}>{savingSchedule ? 'Saving…' : 'Save Schedule'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={() => setShowForm(true)}>Create Backup</button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)' }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No backups recorded for this server yet.</div>
          ) : (
            <table className="data">
              <thead>
                <tr><th>Created</th><th>Type</th><th>Status</th><th>Size</th><th>Location</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const bm = backupStatusMeta(row.status)
                  return (
                    <tr key={row.id}>
                      <td>{fmtDateTime(row.createdAt)}</td>
                      <td>{row.type}</td>
                      <td><span style={{ background: bm.bg, color: bm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{row.status}</span></td>
                      <td>{row.sizeGb ? `${row.sizeGb} GB` : '—'}</td>
                      <td>{row.location || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn--sm" onClick={() => setRestoreTarget(row)}>Restore</button>
                          <button className="btn btn--sm" onClick={() => download(row)}>Download</button>
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
            <div className="modal__head"><h3>Create Backup Record</h3>
              <button className="modal__close" onClick={() => setShowForm(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option>Success</option><option>Failed</option><option>Running</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option>Manual</option><option>Scheduled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Size (GB)</label>
                  <input className="form-input" type="number" value={form.sizeGb} onChange={e => setForm(f => ({ ...f, sizeGb: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. S3, NAS, offsite" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input form-input--textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="modal__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>{saving ? 'Saving…' : 'Create Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {restoreTarget && (
        <div className="modal-backdrop" onClick={() => setRestoreTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Restore from {fmtDateTime(restoreTarget.createdAt)}?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>
                This system doesn't have live access to run an actual restore on your physical server — this only records that a restore from this backup was performed, for your tracking history.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setRestoreTarget(null)}>Cancel</button>
                <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={() => setRestoreTarget(null)}>Record Restore</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete backup record?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This removes the record from your tracking history — it doesn't delete any actual backup files.</div>
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
