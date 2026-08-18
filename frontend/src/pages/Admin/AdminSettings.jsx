import { useState } from 'react'
import AdminShell from '../../components/layout/AdminShell'
import { logActivity } from '../../hooks/useActivityLog'
import { useFirestoreDoc } from '../../hooks/useFirestoreDoc'
import { Section, SettingRow, SaveBtn } from '../../components/ui/SettingsCard'

const TABS = [
  'General', 'SMTP', 'LDAP', 'SNMP', 'Machine Learning',
  'Notifications', 'Thresholds', 'Integrations', 'Backup & Restore',
]

const TAB_SUBTITLES = {
  'General': 'Platform identity and locale',
  'SMTP': 'Outbound mail server for alerts and reports',
  'LDAP': 'Directory server used for admin sign-in',
  'SNMP': 'How devices are polled across the datacenter',
  'Machine Learning': 'Forecasting and predictive maintenance models',
  'Notifications': 'Where alerts are routed by severity',
  'Thresholds': 'Levels that trigger a warning or critical alert',
  'Integrations': 'Outbound webhook and API access',
  'Backup & Restore': 'Configuration and log backup schedule',
}

const FIELDS = {
  'General': [
    { key: 'platformName', label: 'Platform name' },
    { key: 'timezone', label: 'Timezone' },
    { key: 'defaultCurrency', label: 'Default currency' },
  ],
  'SMTP': [
    { key: 'smtpHost', label: 'SMTP host' },
    { key: 'smtpPort', label: 'Port' },
    { key: 'senderAddress', label: 'Sender address' },
  ],
  'LDAP': [
    { key: 'ldapUrl', label: 'LDAP server URL' },
    { key: 'bindDn', label: 'Bind DN' },
  ],
  'SNMP': [
    { key: 'communityString', label: 'Community string', placeholder: 'public', secret: true },
    { key: 'pollingInterval', label: 'Polling interval (sec)' },
  ],
  'Machine Learning': [
    { key: 'modelRefresh', label: 'Model refresh interval' },
    { key: 'forecastHorizon', label: 'Forecast horizon (days)' },
  ],
  'Notifications': [
    { key: 'criticalChannel', label: 'Critical alert channel' },
    { key: 'warningChannel', label: 'Warning alert channel' },
  ],
  'Thresholds': [
    { key: 'cpuWarning', label: 'CPU warning threshold (%)' },
    { key: 'memCritical', label: 'Memory critical threshold (%)' },
  ],
  'Integrations': [
    { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://…' },
    { key: 'apiKey', label: 'API key', secret: true },
  ],
  'Backup & Restore': [
    { key: 'backupSchedule', label: 'Backup schedule' },
    { key: 'retentionDays', label: 'Retention (days)' },
  ],
}

const DEFAULTS = {
  platformName: 'InfraMonitor', timezone: 'Africa/Kigali', defaultCurrency: 'RWF',
  smtpHost: 'smtp.rra.gov.rw', smtpPort: '587', senderAddress: 'alerts@rra.gov.rw',
  ldapUrl: 'ldap://dc1.rra.local', bindDn: 'cn=admin,dc=rra,dc=local',
  communityString: '', pollingInterval: '60',
  modelRefresh: 'Daily', forecastHorizon: '30',
  criticalChannel: 'Email + SMS', warningChannel: 'Email',
  cpuWarning: '70', memCritical: '90',
  webhookUrl: '', apiKey: '••••••••••',
  backupSchedule: 'Daily at 02:00', retentionDays: '30',
}

export default function AdminSettings() {
  const { value: config, setValue: setConfig, save } = useFirestoreDoc('adminSettings', 'config', DEFAULTS)
  const [tab, setTab] = useState('General')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await save(config)
    setSaving(false)
    setSaved(true)
    logActivity({
      action: 'UPDATE_SETTINGS', category: 'System', summary: `Updated ${tab} settings`,
      status: ok ? 'ok' : 'error',
      detail: ok ? '' : 'Firestore write failed — change kept locally only',
    })
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <AdminShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Admin</span><span>›</span><span>Settings</span></div>
            <h1>Settings</h1>
          </div>
        </div>

        <div className="tab-bar" style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <Section title={tab} subtitle={TAB_SUBTITLES[tab]}>
          {FIELDS[tab].map(f => (
            <SettingRow key={f.key} label={f.label}>
              <input
                className="form-input form-input--sm input--mono"
                style={{ width: 280 }}
                type={f.secret ? 'password' : 'text'}
                placeholder={f.placeholder}
                value={config[f.key]}
                onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
              />
            </SettingRow>
          ))}
          <SaveBtn saving={saving} saved={saved} onClick={handleSave} />
        </Section>
      </div>
    </AdminShell>
  )
}
