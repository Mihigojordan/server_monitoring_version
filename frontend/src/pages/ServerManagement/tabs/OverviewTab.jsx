import { fmtDate, fmtDateTime, timeAgo } from '../constants'

function Field({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
      <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>{label}</span>
      <span className={mono ? 'mono' : undefined} style={{ fontSize: 13, fontWeight: 600 }}>{value || '—'}</span>
    </div>
  )
}

export default function OverviewTab({ server: s }) {
  return (
    <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 40px' }}>
      <Field label="Server Name" value={s.name} />
      <Field label="Server ID" value={s.serverId} mono />
      <Field label="Status" value={s.status} />
      <Field label="Server Type" value={s.type} />
      <Field label="Provider" value={s.provider} />
      <Field label="Location / Datacenter" value={s.location} />
      <Field label="IP Address" value={s.ip} mono />
      <Field label="Public IP" value={s.publicIp} mono />
      <Field label="Private IP" value={s.privateIp} mono />
      <Field label="Operating System" value={s.os} />
      <Field label="OS Version" value={s.osVersion} />
      <Field label="Hostname" value={s.hostname} mono />
      <Field label="Domain" value={s.domain} mono />
      <Field label="Server Role" value={s.role} />
      <Field label="Environment" value={s.environment} />
      <Field label="Created" value={fmtDate(s.createdAt)} />
      <Field label="Last Updated" value={s.updatedAt ? timeAgo(s.updatedAt) : '—'} />
      <Field label="Last Health Check" value={s.lastHealthCheck ? fmtDateTime(s.lastHealthCheck) : 'Never'} />
      <Field label="Uptime" value={s.uptimeDays ? `${s.uptimeDays} days` : '—'} />
      {s.notes && (
        <div style={{ gridColumn: '1/-1' }}>
          <span style={{ color: 'var(--ink-500)', fontSize: 13, display: 'block', marginBottom: 6 }}>Notes</span>
          <span style={{ fontSize: 13, color: 'var(--ink-800)' }}>{s.notes}</span>
        </div>
      )}
    </div>
  )
}
