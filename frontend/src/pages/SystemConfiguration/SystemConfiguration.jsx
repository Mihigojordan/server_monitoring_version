import { useState } from 'react'
import { useFirestoreDoc } from '../../hooks/useFirestoreDoc'
import AppShell from '../../components/layout/AppShell'
import { logActivity } from '../../hooks/useActivityLog'

const CONFIG_TABS = [
  {
    slug: 'general', label: 'General',
    fields: [
      { key: 'platformName', label: 'Platform name', placeholder: 'InfraMonitor' },
      { key: 'timezone', label: 'Timezone', placeholder: 'Africa/Kigali' },
      { key: 'currency', label: 'Default currency', placeholder: 'RWF' },
    ],
  },
  {
    slug: 'smtp', label: 'SMTP',
    fields: [
      { key: 'host', label: 'SMTP host', placeholder: 'smtp.example.com' },
      { key: 'port', label: 'Port', placeholder: '587' },
      { key: 'sender', label: 'Sender address', placeholder: 'alerts@example.com' },
    ],
  },
  {
    slug: 'ldap', label: 'LDAP',
    fields: [
      { key: 'serverUrl', label: 'LDAP server URL', placeholder: 'ldap://dc1.local' },
      { key: 'bindDn', label: 'Bind DN', placeholder: 'cn=admin,dc=local' },
    ],
  },
  {
    slug: 'snmp', label: 'SNMP',
    fields: [
      { key: 'community', label: 'Community string', placeholder: 'public' },
      { key: 'pollingInterval', label: 'Polling interval (sec)', placeholder: '60' },
    ],
  },
  {
    slug: 'ml', label: 'Machine Learning',
    fields: [
      { key: 'refreshInterval', label: 'Model refresh interval', placeholder: 'Daily' },
      { key: 'forecastHorizon', label: 'Forecast horizon (days)', placeholder: '30' },
    ],
  },
  {
    slug: 'notifications', label: 'Notifications',
    fields: [
      { key: 'criticalChannel', label: 'Critical alert channel', placeholder: 'Email + SMS' },
      { key: 'warningChannel', label: 'Warning alert channel', placeholder: 'Email' },
    ],
  },
  {
    slug: 'thresholds', label: 'Thresholds',
    fields: [
      { key: 'cpuWarning', label: 'CPU warning threshold (%)', placeholder: '70' },
      { key: 'memCritical', label: 'Memory critical threshold (%)', placeholder: '90' },
    ],
  },
  {
    slug: 'integrations', label: 'Integrations',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://…' },
      { key: 'apiKey', label: 'API key', placeholder: '••••••••••' },
    ],
  },
  {
    slug: 'backup', label: 'Backup & Restore',
    fields: [
      { key: 'schedule', label: 'Backup schedule', placeholder: 'Daily at 02:00' },
      { key: 'retentionDays', label: 'Retention (days)', placeholder: '30' },
    ],
  },
]

function ConfigTabPanel({ tab }) {
  const emptyValues = Object.fromEntries(tab.fields.map(f => [f.key, '']))
  const { value, setValue, loading, error, save } = useFirestoreDoc('systemConfig', tab.slug, emptyValues)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const ok = await save(value)
    setSaving(false)
    if (ok) {
      setSaved(true)
      logActivity({ action: 'UPDATE_SYSTEM_CONFIG', category: 'System', summary: `Updated ${tab.label} configuration` })
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 560 }}>
      {loading ? (
        <div style={{ color: 'var(--ink-500)', fontSize: 13 }}>Loading…</div>
      ) : (
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab.fields.map(f => (
              <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{f.label}</label>
                <input
                  className="form-input"
                  value={value[f.key] || ''}
                  placeholder={f.placeholder}
                  onChange={e => setValue(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {error && <div className="settings-error" style={{ marginTop: 14 }}>Couldn't reach the server — changes are saved locally on this device for now.</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {saved && <span style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>Saved</span>}
          </div>
        </form>
      )}
    </div>
  )
}

export default function SystemConfiguration() {
  const [activeTab, setActiveTab] = useState(CONFIG_TABS[0].slug)
  const tab = CONFIG_TABS.find(t => t.slug === activeTab)

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>System Configuration</span></div>
            <h1>System Configuration</h1>
          </div>
        </div>

        <div className="tab-bar" style={{ marginBottom: 14, marginLeft: 5, flexWrap: 'wrap' }}>
          {CONFIG_TABS.map(t => (
            <button key={t.slug} className={activeTab === t.slug ? 'is-active' : ''} onClick={() => setActiveTab(t.slug)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 5 }}>
          <ConfigTabPanel key={tab.slug} tab={tab} />
        </div>
      </div>
    </AppShell>
  )
}
