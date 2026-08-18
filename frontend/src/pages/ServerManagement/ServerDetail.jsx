import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { logActivity } from '../../hooks/useActivityLog'
import { statusMeta, envMeta, timeAgo } from './constants'

import OverviewTab from './tabs/OverviewTab'
import HardwareTab from './tabs/HardwareTab'
import PerformanceTab from './tabs/PerformanceTab'
import IssuesTab from './tabs/IssuesTab'
import ServicesTab from './tabs/ServicesTab'
import LogsTab from './tabs/LogsTab'
import SecurityTab from './tabs/SecurityTab'
import BackupsTab from './tabs/BackupsTab'
import DeploymentsTab from './tabs/DeploymentsTab'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'hardware', label: 'Hardware & Config' },
  { key: 'performance', label: 'Performance' },
  { key: 'issues', label: 'Issues & Health' },
  { key: 'services', label: 'Services' },
  { key: 'logs', label: 'Logs' },
  { key: 'security', label: 'Security & Access' },
  { key: 'backups', label: 'Backups' },
  { key: 'deployments', label: 'Deployments' },
]

export default function ServerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [server, setServer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [showActions, setShowActions] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [error, setError] = useState(null)
  const actionsRef = useRef(null)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'servers', id), snap => {
      setServer(snap.exists() ? { id: snap.id, ...snap.data() } : null)
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
      await updateDoc(doc(db, 'servers', id), { status, updatedAt: serverTimestamp() })
      logActivity({ action: 'SERVER_STATUS_CHANGE', category: 'Server Management', summary: `${label}: ${server.name}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setShowActions(false)
    }
  }

  async function runHealthCheck() {
    try {
      await updateDoc(doc(db, 'servers', id), { lastHealthCheck: serverTimestamp() })
      logActivity({ action: 'SERVER_HEALTH_CHECK', category: 'Server Management', summary: `Ran health check: ${server.name}` })
    } catch (err) {
      setError(err.message)
    } finally {
      setShowActions(false)
    }
  }

  async function confirmDelete() {
    try {
      await deleteDoc(doc(db, 'servers', id))
      logActivity({ action: 'DELETE_SERVER', category: 'Server Management', summary: `Deleted server: ${server.name}` })
      navigate('/server-management')
    } catch (err) {
      setError(err.message)
      setDeleteConfirm(false)
    }
  }

  if (loading) {
    return <AppShell><div className="page"><div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>Loading server…</div></div></AppShell>
  }
  if (!server) {
    return (
      <AppShell>
        <div className="page">
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
            <div style={{ marginBottom: 12 }}>This server no longer exists.</div>
            <button className="btn btn--primary" onClick={() => navigate('/server-management')}>Back to Server Management</button>
          </div>
        </div>
      </AppShell>
    )
  }

  const sm = statusMeta(server.status)
  const em = envMeta(server.environment)

  return (
    <AppShell>
      <div className="page">
        <div onClick={() => navigate('/server-management')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-500)', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg> Back to Server Management
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{server.name}</h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: sm.bg, color: sm.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot }} />{server.status}
              </span>
              <span style={{ background: em.bg, color: em.text, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{server.environment || '—'}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
              {server.serverId || '—'} · {server.ip || '—'} · {server.provider || '—'}
              {server.lastHealthCheck ? ` · Last health check ${timeAgo(server.lastHealthCheck)}` : ''}
            </div>
          </div>
          <div className="profile-menu" ref={actionsRef}>
            <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={() => setShowActions(s => !s)}>
              Actions
              <svg viewBox="0 0 16 16" fill="none" width="12" height="12" style={{ marginLeft: 6 }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {showActions && (
              <div className="profile-dropdown" style={{ minWidth: 220 }}>
                <button className="profile-dropdown__item" onClick={() => { setShowActions(false); navigate('/server-management') }}>Edit server</button>
                <button className="profile-dropdown__item" onClick={() => setStatus('Maintenance', 'Marked as rebooting')}>Restart server</button>
                <button className="profile-dropdown__item" onClick={() => setStatus('Offline', 'Marked as shut down')}>Shutdown</button>
                <button className="profile-dropdown__item" onClick={() => setStatus('Maintenance', 'Marked as rebooting')}>Reboot</button>
                <button className="profile-dropdown__item" onClick={() => setStatus('Maintenance', 'Put into maintenance')}>Put into maintenance</button>
                <button className="profile-dropdown__item" onClick={runHealthCheck}>Run health check</button>
                <div className="profile-dropdown__divider" />
                <button className="profile-dropdown__item" onClick={() => { setTab('backups'); setShowActions(false) }}>Create backup</button>
                <button className="profile-dropdown__item" onClick={() => { setTab('logs'); setShowActions(false) }}>View logs</button>
                <button className="profile-dropdown__item" onClick={() => { setTab('services'); setShowActions(false) }}>Manage services</button>
                <button className="profile-dropdown__item" onClick={() => { setTab('security'); setShowActions(false) }}>Manage firewall</button>
                <div className="profile-dropdown__divider" />
                <button className="profile-dropdown__item profile-dropdown__item--danger" onClick={() => { setDeleteConfirm(true); setShowActions(false) }}>Delete server</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 14, marginTop: -6 }}>
          Actions update this tracking record and are logged to Activity — this system does not have live remote access to your physical infrastructure.
        </div>

        {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="tab-bar" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab server={server} />}
        {tab === 'hardware' && <HardwareTab server={server} />}
        {tab === 'performance' && <PerformanceTab server={server} />}
        {tab === 'issues' && <IssuesTab serverId={id} />}
        {tab === 'services' && <ServicesTab serverId={id} />}
        {tab === 'logs' && <LogsTab serverId={id} server={server} />}
        {tab === 'security' && <SecurityTab server={server} />}
        {tab === 'backups' && <BackupsTab serverId={id} />}
        {tab === 'deployments' && <DeploymentsTab serverId={id} />}
      </div>

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__body" style={{ padding: 26 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Delete {server.name}?</div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20 }}>This permanently removes the server and all its tracked issues, services, logs, backups and deployments. This can't be undone.</div>
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
