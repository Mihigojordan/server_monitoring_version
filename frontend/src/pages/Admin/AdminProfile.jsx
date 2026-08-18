import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminShell from '../../components/layout/AdminShell'
import Toggle from '../../components/ui/Toggle'
import { Section, SettingRow, SaveBtn } from '../../components/ui/SettingsCard'
import { useApp } from '../../context/AppContext'
import { useFirestoreDoc } from '../../hooks/useFirestoreDoc'
import { getAdminId } from '../../lib/adminIdentity'
import { logActivity, getLog } from '../../hooks/useActivityLog'
import { adminApi } from '../../api/admin'

const DEFAULT_PROFILE = {
  // 1. Profile Information
  fullName: '', profilePicture: '', employeeId: '', jobTitle: '',
  email: '', phoneNumber: '', officeLocation: '', username: '', bio: '',
  // 2. Account Settings (personal preferences — distinct from system-wide Settings)
  language: 'en', timezone: 'Africa/Kigali', dateTimeFormat: 'DD/MM/YYYY HH:mm', theme: 'light',
  // 3. Security
  twoFactorEnabled: false, recoveryEmail: '', securityQuestion: '', securityAnswer: '',
  apiKeys: [], trustedDevices: [],
  // 4. Permissions & Roles
  teamsManaged: '', approvalRights: true,
  // 5. Notifications
  notifyEmail: true, notifySms: false, notifyPush: true,
  notifySystemAlerts: true, notifyMaintenance: true, notifyIncidents: true,
  // 7. Organization Information (Department intentionally omitted)
  companyName: 'InfraMonitor', officeBranch: '', manager: '', teamMembers: '', employeeStatus: 'Active',
  // 8. Infrastructure Preferences
  defaultDashboard: 'Overview', favoriteServers: '', defaultProject: '',
  preferredMonitoringView: 'Grid', alertThresholdPref: 'Default', reportPreference: 'PDF',
  // 9. Connected Services
  svc: { github: false, gitlab: false, azure: false, aws: false, gcp: false, slack: false, teams: false, ldap: false },
  // 10. Documents
  employmentIdDoc: '', certifications: '', accessAgreements: '', uploadedDocuments: [],
}

const SECTIONS = [
  'Profile Information', 'Account Settings', 'Security', 'Permissions & Roles',
  'Notifications', 'Activity Logs', 'Organization Information', 'Infrastructure Preferences',
  'Connected Services', 'Documents', 'Support', 'Admin Statistics', 'Account Management',
]

const SERVICES = [
  { key: 'github', label: 'GitHub' }, { key: 'gitlab', label: 'GitLab' },
  { key: 'azure', label: 'Azure' }, { key: 'aws', label: 'AWS' },
  { key: 'gcp', label: 'Google Cloud' }, { key: 'slack', label: 'Slack' },
  { key: 'teams', label: 'Microsoft Teams' }, { key: 'ldap', label: 'LDAP / Active Directory' },
]

function humanizeKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
}

export default function AdminProfile() {
  const { firebaseUser, logout, user } = useApp()
  const adminId = getAdminId(firebaseUser)
  const { value: profile, setValue: setProfile, save } = useFirestoreDoc('adminProfiles', adminId, DEFAULT_PROFILE)

  const [section, setSection] = useState('Profile Information')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    adminApi.stats()
      .then((data) => setStats(data && typeof data === 'object' ? data : null))
      .catch(() => setStatsError(true))
  }, [])

  async function persist(logMsg) {
    setSaving(true)
    const ok = await save(profile)
    setSaving(false)
    setSaved(true)
    logActivity({
      action: 'UPDATE_PROFILE', category: 'System', summary: logMsg,
      status: ok ? 'ok' : 'error',
      detail: ok ? '' : 'Firestore write failed — change kept locally only',
    })
    setTimeout(() => setSaved(false), 2500)
  }

  function set(field) {
    return (e) => setProfile((p) => ({ ...p, [field]: e.target.value }))
  }
  function setToggle(field) {
    return (v) => setProfile((p) => ({ ...p, [field]: v }))
  }

  function exportPersonalData() {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `infra-profile-${adminId}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    logActivity({ action: 'EXPORT_PROFILE', category: 'System', summary: 'Exported personal profile data' })
  }

  function downloadAuditLogs() {
    const entries = getLog()
    const header = 'Time,Actor,Category,Action,Summary,Status\n'
    const rows = entries.map((e) => [
      new Date(e.ts).toISOString(), e.actor, e.category, e.action, `"${(e.summary || '').replace(/"/g, '""')}"`, e.status,
    ].join(','))
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `infra-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function addApiKey() {
    const key = `ik_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
    const entry = { id: Date.now(), label: `Key ${profile.apiKeys.length + 1}`, key: `${key.slice(0, 8)}••••••••••••`, created: new Date().toISOString() }
    setProfile((p) => ({ ...p, apiKeys: [...p.apiKeys, entry] }))
  }
  function removeApiKey(id) {
    setProfile((p) => ({ ...p, apiKeys: p.apiKeys.filter((k) => k.id !== id) }))
  }

  const recentActivity = getLog().slice(0, 6)
  const lastLogin = firebaseUser?.metadata?.lastSignInTime || null

  return (
    <AdminShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Admin</span><span>›</span><span>Profile</span></div>
            <h1>My Profile</h1>
          </div>
        </div>

        <div className="profile-header">
          <div className="profile-header__avatar">
            {profile.profilePicture || firebaseUser?.photoURL
              ? <img src={profile.profilePicture || firebaseUser.photoURL} alt="" />
              : (profile.fullName || user?.name || 'A').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--ink-900)' }}>
              {profile.fullName || user?.name || 'Administrator'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
              {profile.jobTitle || 'Infrastructure Administrator'} · {profile.email || firebaseUser?.email || '—'}
            </div>
          </div>
          <span className="chip chip--brand" style={{ marginLeft: 'auto' }}>Administrator</span>
        </div>

        <div className="profile-layout">
          <nav className="profile-nav">
            {SECTIONS.map((s) => (
              <button key={s} type="button" className={section === s ? 'is-active' : ''} onClick={() => setSection(s)}>
                {s}
              </button>
            ))}
          </nav>

          <div>
            {/* 1. Profile Information */}
            {section === 'Profile Information' && (
              <Section title="Profile Information" subtitle="How you appear across InfraMonitor">
                <SettingRow label="Full Name">
                  <input className="form-input form-input--sm" style={{ width: 240 }} value={profile.fullName} onChange={set('fullName')} placeholder="Jane Mukamana" />
                </SettingRow>
                <SettingRow label="Profile Picture" sub="Image URL">
                  <input className="form-input form-input--sm" style={{ width: 280 }} value={profile.profilePicture} onChange={set('profilePicture')} placeholder="https://…" />
                </SettingRow>
                <SettingRow label="Employee ID">
                  <input className="form-input form-input--sm input--mono" style={{ width: 160 }} value={profile.employeeId} onChange={set('employeeId')} placeholder="EMP-0042" />
                </SettingRow>
                <SettingRow label="Job Title">
                  <input className="form-input form-input--sm" style={{ width: 220 }} value={profile.jobTitle} onChange={set('jobTitle')} placeholder="Infrastructure Administrator" />
                </SettingRow>
                <SettingRow label="Email Address">
                  <input className="form-input form-input--sm" type="email" style={{ width: 260 }} value={profile.email} onChange={set('email')} placeholder="you@company.rw" />
                </SettingRow>
                <SettingRow label="Phone Number">
                  <input className="form-input form-input--sm" style={{ width: 180 }} value={profile.phoneNumber} onChange={set('phoneNumber')} placeholder="+250 7xx xxx xxx" />
                </SettingRow>
                <SettingRow label="Office Location">
                  <input className="form-input form-input--sm" style={{ width: 220 }} value={profile.officeLocation} onChange={set('officeLocation')} placeholder="Kigali HQ" />
                </SettingRow>
                <SettingRow label="Username">
                  <input className="form-input form-input--sm input--mono" style={{ width: 200 }} value={profile.username} onChange={set('username')} placeholder="jane.m" />
                </SettingRow>
                <SettingRow label="Biography / About">
                  <textarea className="form-input form-input--textarea" style={{ width: 320 }} value={profile.bio} onChange={set('bio')} placeholder="A short bio…" />
                </SettingRow>
                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated profile information')} />
              </Section>
            )}

            {/* 2. Account Settings */}
            {section === 'Account Settings' && (
              <Section title="Account Settings" subtitle="Personal preferences for your own session">
                <SettingRow label="Change Password" sub="Password changes are handled by your sign-in provider">
                  <Link className="btn btn--ghost" to="/login">Go to sign-in</Link>
                </SettingRow>
                <SettingRow label="Change Email">
                  <input className="form-input form-input--sm" type="email" style={{ width: 240 }} value={profile.email} onChange={set('email')} />
                </SettingRow>
                <SettingRow label="Update Phone Number">
                  <input className="form-input form-input--sm" style={{ width: 180 }} value={profile.phoneNumber} onChange={set('phoneNumber')} />
                </SettingRow>
                <SettingRow label="Language Selection">
                  <select className="form-input form-input--sm" style={{ width: 160 }} value={profile.language} onChange={set('language')}>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="rw">Kinyarwanda</option>
                  </select>
                </SettingRow>
                <SettingRow label="Time Zone">
                  <select className="form-input form-input--sm" style={{ width: 200 }} value={profile.timezone} onChange={set('timezone')}>
                    <option value="Africa/Kigali">Africa/Kigali (CAT)</option>
                    <option value="UTC">UTC</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                  </select>
                </SettingRow>
                <SettingRow label="Date & Time Format">
                  <select className="form-input form-input--sm" style={{ width: 200 }} value={profile.dateTimeFormat} onChange={set('dateTimeFormat')}>
                    <option value="DD/MM/YYYY HH:mm">DD/MM/YYYY HH:mm</option>
                    <option value="MM/DD/YYYY hh:mm A">MM/DD/YYYY hh:mm A</option>
                    <option value="YYYY-MM-DD HH:mm">YYYY-MM-DD HH:mm</option>
                  </select>
                </SettingRow>
                <SettingRow label="Theme" sub="Light or dark mode">
                  <select className="form-input form-input--sm" style={{ width: 140 }} value={profile.theme}
                    onChange={(e) => {
                      setProfile((p) => ({ ...p, theme: e.target.value }))
                      document.documentElement.setAttribute('data-theme', e.target.value)
                      localStorage.setItem('admin-theme', e.target.value)
                    }}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </SettingRow>
                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated account settings')} />
              </Section>
            )}

            {/* 3. Security */}
            {section === 'Security' && (
              <Section title="Security" subtitle="Protect your account">
                <SettingRow label="Two-Factor Authentication (2FA)">
                  <Toggle value={profile.twoFactorEnabled} onChange={setToggle('twoFactorEnabled')} />
                </SettingRow>
                <SettingRow label="Recovery Email">
                  <input className="form-input form-input--sm" type="email" style={{ width: 240 }} value={profile.recoveryEmail} onChange={set('recoveryEmail')} />
                </SettingRow>
                <SettingRow label="Security Question">
                  <input className="form-input form-input--sm" style={{ width: 240 }} value={profile.securityQuestion} onChange={set('securityQuestion')} placeholder="e.g. First school attended" />
                </SettingRow>
                <SettingRow label="Security Answer">
                  <input className="form-input form-input--sm" type="password" style={{ width: 240 }} value={profile.securityAnswer} onChange={set('securityAnswer')} />
                </SettingRow>
                <SettingRow label="Password Strength" sub="Based on sign-in method">
                  <span className="chip chip--ok">{firebaseUser ? 'Managed by Google' : 'Backend-managed'}</span>
                </SettingRow>

                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--ink-100)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>API Keys</div>
                    <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={addApiKey} type="button">+ Generate key</button>
                  </div>
                  {profile.apiKeys.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>No API keys yet.</div>}
                  <ul className="profile-list">
                    {profile.apiKeys.map((k) => (
                      <li key={k.id}>
                        <span className="k">{k.label} · <span className="input--mono" style={{ fontFamily: 'var(--font-mono)' }}>{k.key}</span></span>
                        <span className="v" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {new Date(k.created).toLocaleDateString()}
                          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => removeApiKey(k.id)} type="button" title="Revoke">✕</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--ink-100)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Active Session / Trusted Device</div>
                  <ul className="profile-list">
                    <li><span className="k">This browser</span><span className="v">{navigator.userAgent.slice(0, 42)}…</span></li>
                    <li><span className="k">Last sign-in</span><span className="v">{lastLogin ? new Date(lastLogin).toLocaleString() : 'Not tracked for this session type'}</span></li>
                  </ul>
                </div>

                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated security settings')} />
              </Section>
            )}

            {/* 4. Permissions & Roles */}
            {section === 'Permissions & Roles' && (
              <Section title="Permissions & Roles" subtitle="What this account can do">
                <SettingRow label="Current Role">
                  <span className="chip chip--brand">Administrator</span>
                </SettingRow>
                <SettingRow label="Access Level">
                  <span className="chip chip--ok">Full access</span>
                </SettingRow>
                <SettingRow label="Assigned Permissions">
                  <span style={{ fontSize: 12.5, color: 'var(--ink-600)' }}>Users · Branches · Tax Config · EBM Tools · Settings</span>
                </SettingRow>
                <SettingRow label="Teams Managed">
                  <input className="form-input form-input--sm" style={{ width: 220 }} value={profile.teamsManaged} onChange={set('teamsManaged')} placeholder="IT Operations, NOC" />
                </SettingRow>
                <SettingRow label="Approval Rights" sub="Can approve configuration and financial changes">
                  <Toggle value={profile.approvalRights} onChange={setToggle('approvalRights')} />
                </SettingRow>
                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated permissions preferences')} />
              </Section>
            )}

            {/* 5. Notifications */}
            {section === 'Notifications' && (
              <Section title="Notifications" subtitle="How you want to hear about system events">
                <SettingRow label="Email Notifications"><Toggle value={profile.notifyEmail} onChange={setToggle('notifyEmail')} /></SettingRow>
                <SettingRow label="SMS Notifications"><Toggle value={profile.notifySms} onChange={setToggle('notifySms')} /></SettingRow>
                <SettingRow label="Push Notifications"><Toggle value={profile.notifyPush} onChange={setToggle('notifyPush')} /></SettingRow>
                <SettingRow label="System Alerts"><Toggle value={profile.notifySystemAlerts} onChange={setToggle('notifySystemAlerts')} /></SettingRow>
                <SettingRow label="Maintenance Notifications"><Toggle value={profile.notifyMaintenance} onChange={setToggle('notifyMaintenance')} /></SettingRow>
                <SettingRow label="Infrastructure Incident Alerts"><Toggle value={profile.notifyIncidents} onChange={setToggle('notifyIncidents')} /></SettingRow>
                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated notification preferences')} />
              </Section>
            )}

            {/* 6. Activity Logs */}
            {section === 'Activity Logs' && (
              <Section title="Activity Logs" subtitle="Recent account and system activity" action={<Link className="btn btn--ghost" to="/admin/logs">View full log</Link>}>
                <ul className="profile-list">
                  <li><span className="k">Last Login</span><span className="v">{lastLogin ? new Date(lastLogin).toLocaleString() : 'Not tracked for this session type'}</span></li>
                  <li><span className="k">Login Location / IP</span><span className="v">Not tracked by this client</span></li>
                </ul>
                <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Recent Actions</div>
                {recentActivity.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 8 }}>No activity recorded yet.</div>}
                <ul className="profile-list">
                  {recentActivity.map((e) => (
                    <li key={e.id}>
                      <span className="k">{e.summary || e.action}</span>
                      <span className="v" style={{ fontWeight: 400, color: 'var(--ink-500)' }}>{new Date(e.ts).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* 7. Organization Information */}
            {section === 'Organization Information' && (
              <Section title="Organization Information" subtitle="Where this account sits in the org">
                <SettingRow label="Company Name">
                  <input className="form-input form-input--sm" style={{ width: 240 }} value={profile.companyName} onChange={set('companyName')} />
                </SettingRow>
                <SettingRow label="Office Branch">
                  <input className="form-input form-input--sm" style={{ width: 220 }} value={profile.officeBranch} onChange={set('officeBranch')} placeholder="Kigali HQ" />
                </SettingRow>
                <SettingRow label="Manager">
                  <input className="form-input form-input--sm" style={{ width: 220 }} value={profile.manager} onChange={set('manager')} />
                </SettingRow>
                <SettingRow label="Team Members">
                  <input className="form-input form-input--sm" style={{ width: 260 }} value={profile.teamMembers} onChange={set('teamMembers')} placeholder="Comma-separated names" />
                </SettingRow>
                <SettingRow label="Employee Status">
                  <select className="form-input form-input--sm" style={{ width: 160 }} value={profile.employeeStatus} onChange={set('employeeStatus')}>
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Contractor">Contractor</option>
                  </select>
                </SettingRow>
                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated organization information')} />
              </Section>
            )}

            {/* 8. Infrastructure Preferences */}
            {section === 'Infrastructure Preferences' && (
              <Section title="Infrastructure Preferences" subtitle="Defaults used across the monitoring platform" action={<Link className="btn btn--ghost" to="/admin/settings">System-wide settings</Link>}>
                <SettingRow label="Default Dashboard">
                  <select className="form-input form-input--sm" style={{ width: 200 }} value={profile.defaultDashboard} onChange={set('defaultDashboard')}>
                    <option>Overview</option><option>Server Monitoring</option><option>Storage Monitoring</option><option>Network Monitoring</option>
                  </select>
                </SettingRow>
                <SettingRow label="Favorite Servers" sub="Comma-separated device names">
                  <input className="form-input form-input--sm" style={{ width: 260 }} value={profile.favoriteServers} onChange={set('favoriteServers')} placeholder="ESXi-Host-01, Storage-01" />
                </SettingRow>
                <SettingRow label="Default Project">
                  <input className="form-input form-input--sm" style={{ width: 220 }} value={profile.defaultProject} onChange={set('defaultProject')} />
                </SettingRow>
                <SettingRow label="Preferred Monitoring View">
                  <select className="form-input form-input--sm" style={{ width: 160 }} value={profile.preferredMonitoringView} onChange={set('preferredMonitoringView')}>
                    <option>Grid</option><option>List</option><option>Topology</option>
                  </select>
                </SettingRow>
                <SettingRow label="Alert Threshold Preferences">
                  <select className="form-input form-input--sm" style={{ width: 160 }} value={profile.alertThresholdPref} onChange={set('alertThresholdPref')}>
                    <option>Default</option><option>Conservative</option><option>Aggressive</option>
                  </select>
                </SettingRow>
                <SettingRow label="Report Preferences" sub="Preferred export format">
                  <select className="form-input form-input--sm" style={{ width: 140 }} value={profile.reportPreference} onChange={set('reportPreference')}>
                    <option>PDF</option><option>Excel</option><option>CSV</option>
                  </select>
                </SettingRow>
                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated infrastructure preferences')} />
              </Section>
            )}

            {/* 9. Connected Services */}
            {section === 'Connected Services' && (
              <Section title="Connected Services" subtitle="Link external tools (connection state only — OAuth setup not wired up)">
                {SERVICES.map((s) => (
                  <SettingRow key={s.key} label={s.label} sub={profile.svc[s.key] ? 'Connected' : 'Not connected'}>
                    <Toggle value={profile.svc[s.key]} onChange={(v) => setProfile((p) => ({ ...p, svc: { ...p.svc, [s.key]: v } }))} />
                  </SettingRow>
                ))}
                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated connected services')} />
              </Section>
            )}

            {/* 10. Documents */}
            {section === 'Documents' && (
              <Section title="Documents" subtitle="Reference links — file storage isn't wired up yet, so these are URLs/notes">
                <SettingRow label="Employment ID">
                  <input className="form-input form-input--sm" style={{ width: 260 }} value={profile.employmentIdDoc} onChange={set('employmentIdDoc')} placeholder="Link or reference number" />
                </SettingRow>
                <SettingRow label="Certifications">
                  <input className="form-input form-input--sm" style={{ width: 260 }} value={profile.certifications} onChange={set('certifications')} placeholder="e.g. CCNA, AWS SysOps" />
                </SettingRow>
                <SettingRow label="Access Agreements">
                  <input className="form-input form-input--sm" style={{ width: 260 }} value={profile.accessAgreements} onChange={set('accessAgreements')} placeholder="Signed date / link" />
                </SettingRow>
                <SaveBtn saving={saving} saved={saved} onClick={() => persist('Updated documents')} />
              </Section>
            )}

            {/* 11. Support */}
            {section === 'Support' && (
              <Section title="Support" subtitle="Get help">
                <SettingRow label="Help Center"><Link className="btn btn--ghost" to="/about">Visit</Link></SettingRow>
                <SettingRow label="Contact IT Support"><Link className="btn btn--ghost" to="/contact">Contact us</Link></SettingRow>
                <SettingRow label="Report a Problem"><Link className="btn btn--ghost" to="/contact">Report</Link></SettingRow>
                <SettingRow label="Feature Requests"><Link className="btn btn--ghost" to="/contact">Suggest</Link></SettingRow>
                <SettingRow label="System Documentation"><Link className="btn btn--ghost" to="/">Docs</Link></SettingRow>
              </Section>
            )}

            {/* 12. Admin Statistics */}
            {section === 'Admin Statistics' && (
              <Section title="Admin Statistics" subtitle={stats ? 'Live from the backend' : statsError ? 'Backend unavailable — showing no data' : 'Loading…'}>
                {stats ? (
                  <div className="kpi-grid">
                    {Object.entries(stats).slice(0, 8).map(([k, v]) => (
                      <div className="kpi" key={k}>
                        <div className="kpi__label">{humanizeKey(k)}</div>
                        <div className="kpi__value">{typeof v === 'number' ? v.toLocaleString() : String(v)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
                    {statsError ? 'Could not reach /admin/stats — start the backend to see live figures.' : 'Loading statistics…'}
                  </div>
                )}
              </Section>
            )}

            {/* 13. Account Management */}
            {section === 'Account Management' && (
              <Section title="Account Management" subtitle="Data export and session control">
                <SettingRow label="Export Personal Data" sub="Download your profile as JSON">
                  <button className="btn btn--ghost" onClick={exportPersonalData} type="button">Export</button>
                </SettingRow>
                <SettingRow label="Download Audit Logs" sub="CSV of this browser's activity log">
                  <button className="btn btn--ghost" onClick={downloadAuditLogs} type="button">Download</button>
                </SettingRow>
                <SettingRow label="Logout from All Devices" sub="Ends this session everywhere it's signed in">
                  <button className="btn btn--ghost" onClick={logout} type="button">Log out</button>
                </SettingRow>
                <SettingRow label="Deactivate Account" sub="Contact an owner to deactivate this admin account">
                  <button className="btn" disabled title="Contact support to deactivate an admin account">Deactivate</button>
                </SettingRow>
                <SettingRow label="Delete Account" sub="Contact an owner to permanently delete this account">
                  <button className="btn btn--danger" disabled title="Contact support to delete an admin account">Delete</button>
                </SettingRow>
              </Section>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
