import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { logActivity } from '../../hooks/useActivityLog'
import { statusMeta, pct } from './constants'

import OverviewTab from './tabs/OverviewTab'
import CapacityTab from './tabs/CapacityTab'
import VolumesTab from './tabs/VolumesTab'
import SnapshotsTab from './tabs/SnapshotsTab'
import BackupsTab from './tabs/BackupsTab'
import AlertsTab from './tabs/AlertsTab'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'capacity', label: 'Capacity & Performance' },
  { key: 'volumes', label: 'Volumes & Partitions' },
  { key: 'snapshots', label: 'Snapshots' },
  { key: 'backups', label: 'Backups' },
  { key: 'alerts', label: 'Alerts & Health' },
]

export default function StorageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [device, setDevice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [showActions, setShowActions] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [error, setError] = useState(null)
  const actionsRef = useRef(null)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'storageDevices', id), snap => {
      setDevice(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [id])

  useEffect(() => {
    function handler(e) { if (actionsRef.current && !actionsRef.current.contains(e.target)) setShowActions(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function setStatus(status, label) {
    try {
      await updateDoc(doc(db, 'storageDevices', id), { status, updatedAt: serverTimestamp() })
      logActivity({ action: 'STORAGE_STATUS_CHANGE', category: 'Storage Management', summary: `${label}: ${device.name}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setShowActions(false)
    }
  }

  async function confirmDelete() {
    try {
      await deleteDoc(doc(db, 'storageDevices', id))
      logActivity({ action: 'DELETE_STORAGE_DEVICE', category: 'Storage Management', summary: `Deleted storage device: ${device.name}` })
      navigate('/storage-management')
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  if (loading) {
    return <AppShell><div className="page"><div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>Loading storage device…</div></div></AppShell>
  }
  if (!device) {
    return (
      <AppShell>
        <div className="page">
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
            <div style={{ marginBottom: 12 }}>This storage device no longer exists.</div>
            <button className="btn btn--primary" onClick={() => navigate('/storage-management')}>Back to Storage Management</button>
          </div>
        </div>
      </AppShell>
    )
  }

  const sm = statusMeta(device.status)
  const usedPct = pct(device.capacityUsedGb, device.capacityTotalGb)

  return (
    <AppShell>
      <div className="page">
        <div onClick={() => navigate('/storage-management')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-500)', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to Storage Management
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{device.name}</h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sm.bg, color: sm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot }} />{device.status}
              </span>
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{device.type || '—'}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
              {device.deviceId || '—'} · {device.ip || '—'} · {device.provider || '—'} · {usedPct}% capacity used
            </div>
          </div>
          <div className="profile-menu" ref={actionsRef}>
            <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={() => setShowActions(s => !s)}>
              Actions
              <svg viewBox="0 0 16 16" fill="none" width="12" height="12" style={{ marginLeft: 6 }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {showActions && (
              <div className="profile-dropdown" style={{ minWidth: 200 }}>
                <button className="profile-dropdown__item" onClick={() => { setShowActions(false); navigate('/storage-management') }}>Edit device</button>
                <button className="profile-dropdown__item" onClick={() => setStatus('Maintenance', 'Put into maintenance')}>Put into maintenance</button>
                <button className="profile-dropdown__item" onClick={() => setStatus('Offline', 'Marked as offline')}>Mark offline</button>
                <div className="profile-dropdown__divider" />
                <button className="profile-dropdown__item" onClick={() => { setTab('snapshots'); setShowActions(false) }}>Create snapshot</button>
                <button className="profile-dropdown__item" onClick={() => { setTab('backups'); setShowActions(false) }}>Create backup</button>
                <button className="profile-dropdown__item" onClick={() => { setTab('volumes'); setShowActions(false) }}>Manage volumes</button>
                <div className="profile-dropdown__divider" />
                <button className="profile-dropdown__item profile-dropdown__item--danger" onClick={() => { setDeleteConfirm(true); setShowActions(false) }}>Delete device</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 14, marginTop: -6 }}>
          Actions update this tracking record and are logged to Activity — this system does not have live remote access to your physical storage hardware.
        </div>

        {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="tab-bar" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab device={device} />}
        {tab === 'capacity' && <CapacityTab device={device} />}
        {tab === 'volumes' && <VolumesTab deviceId={id} />}
        {tab === 'snapshots' && <SnapshotsTab deviceId={id} />}
        {tab === 'backups' && <BackupsTab deviceId={id} device={device} />}
        {tab === 'alerts' && <AlertsTab deviceId={id} />}
      </div>

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete {device.name}?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This permanently removes the device and all its tracked volumes, snapshots, backups and alerts. This can't be undone.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                <button className="btn btn--danger" onClick={confirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
