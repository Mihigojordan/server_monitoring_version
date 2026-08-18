import { useState } from 'react'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useSubcollection } from '../../../hooks/useSubcollection'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

export default function SecurityTab({ server: s }) {
  const [form, setForm] = useState({
    sshStatus: s.sshStatus || 'Enabled',
    sshPort: s.sshPort || '22',
    firewallStatus: s.firewallStatus || 'Enabled',
    openPorts: s.openPorts || '',
    activeConnections: s.activeConnections || '',
    failedLoginAttempts: s.failedLoginAttempts || '',
    sslExpiry: s.sslExpiry || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [newUser, setNewUser] = useState({ name: '', role: '' })
  const [newKey, setNewKey] = useState({ label: '', fingerprint: '' })

  const { rows: securityLogs } = useSubcollection('servers', s.id, 'logs', 'createdAt')
  const secEvents = securityLogs.filter(l => l.source === 'Security').slice(0, 10)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'servers', s.id), form)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addAccessUser(e) {
    e.preventDefault()
    if (!newUser.name.trim()) return
    try {
      await updateDoc(doc(db, 'servers', s.id), { accessUsers: arrayUnion({ ...newUser, addedAt: new Date().toISOString() }) })
      setNewUser({ name: '', role: '' })
    } catch (err) { setError(err.message) }
  }
  async function removeAccessUser(entry) {
    try { await updateDoc(doc(db, 'servers', s.id), { accessUsers: arrayRemove(entry) }) } catch (err) { setError(err.message) }
  }
  async function addSshKey(e) {
    e.preventDefault()
    if (!newKey.label.trim()) return
    try {
      await updateDoc(doc(db, 'servers', s.id), { sshKeys: arrayUnion({ ...newKey, addedAt: new Date().toISOString() }) })
      setNewKey({ label: '', fingerprint: '' })
    } catch (err) { setError(err.message) }
  }
  async function removeSshKey(entry) {
    try { await updateDoc(doc(db, 'servers', s.id), { sshKeys: arrayRemove(entry) }) } catch (err) { setError(err.message) }
  }

  const sslDays = daysUntil(form.sslExpiry)
  const accessUsers = s.accessUsers || []
  const sshKeys = s.sshKeys || []

  return (
    <div>
      {sslDays !== null && sslDays <= 30 && (
        <div className="settings-error" style={{ marginBottom: 16 }}>
          ⚠ SSL certificate {sslDays < 0 ? 'expired' : `expires in ${sslDays} day${sslDays === 1 ? '' : 's'}`} — renew soon.
        </div>
      )}
      {form.failedLoginAttempts > 0 && (
        <div className="settings-error" style={{ marginBottom: 16 }}>
          ⚠ {form.failedLoginAttempts} failed login attempt{Number(form.failedLoginAttempts) === 1 ? '' : 's'} recorded — review access logs.
        </div>
      )}
      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Access Configuration</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">SSH Status</label>
              <select className="form-input" value={form.sshStatus} onChange={e => setForm(f => ({ ...f, sshStatus: e.target.value }))}>
                <option>Enabled</option><option>Disabled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">SSH Port</label>
              <input className="form-input" value={form.sshPort} onChange={e => setForm(f => ({ ...f, sshPort: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Firewall Status</label>
              <select className="form-input" value={form.firewallStatus} onChange={e => setForm(f => ({ ...f, firewallStatus: e.target.value }))}>
                <option>Enabled</option><option>Disabled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Active Connections</label>
              <input className="form-input" type="number" value={form.activeConnections} onChange={e => setForm(f => ({ ...f, activeConnections: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Failed Login Attempts</label>
              <input className="form-input" type="number" value={form.failedLoginAttempts} onChange={e => setForm(f => ({ ...f, failedLoginAttempts: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">SSL Certificate Expiry</label>
              <input className="form-input" type="date" value={form.sslExpiry} onChange={e => setForm(f => ({ ...f, sslExpiry: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Open Ports</label>
              <input className="form-input" value={form.openPorts} onChange={e => setForm(f => ({ ...f, openPorts: e.target.value }))} placeholder="e.g. 22, 80, 443, 3306" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Security Settings'}</button>
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent Security Events</div>
          {secEvents.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>No security events logged. Add entries with source "Security" from the Logs tab.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {secEvents.map(l => (
                <div key={l.id} style={{ fontSize: 12.5, borderBottom: '1px solid var(--ink-100)', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 700 }}>{l.severity}</span> — {l.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Access Users</div>
          {accessUsers.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 12 }}>No access users recorded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {accessUsers.map((u, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--ink-200)', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}>
                  <span>{u.name} <span style={{ color: 'var(--ink-500)' }}>· {u.role || 'user'}</span></span>
                  <button className="btn btn--sm btn--danger" onClick={() => removeAccessUser(u)}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addAccessUser} style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" style={{ flex: 1 }} placeholder="Name" value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} />
            <input className="form-input" style={{ flex: 1 }} placeholder="Role" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))} />
            <button type="submit" className="btn btn--sm">Add</button>
          </form>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>SSH Keys</div>
          {sshKeys.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 12 }}>No SSH keys recorded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {sshKeys.map((k, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--ink-200)', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}>
                  <span>{k.label} <span className="mono" style={{ color: 'var(--ink-500)', fontSize: 11.5 }}>{k.fingerprint}</span></span>
                  <button className="btn btn--sm btn--danger" onClick={() => removeSshKey(k)}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addSshKey} style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" style={{ flex: 1 }} placeholder="Label" value={newKey.label} onChange={e => setNewKey(k => ({ ...k, label: e.target.value }))} />
            <input className="form-input" style={{ flex: 1 }} placeholder="Fingerprint" value={newKey.fingerprint} onChange={e => setNewKey(k => ({ ...k, fingerprint: e.target.value }))} />
            <button type="submit" className="btn btn--sm">Add</button>
          </form>
        </div>
      </div>
    </div>
  )
}
