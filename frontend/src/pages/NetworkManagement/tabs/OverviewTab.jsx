import { fmtDate, timeAgo } from '../constants'

function Field({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ink-100)', paddingBottom: 10 }}>
      <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>{label}</span>
      <span className={mono ? 'mono' : undefined} style={{ fontSize: 13, fontWeight: 600 }}>{value || '—'}</span>
    </div>
  )
}

export default function OverviewTab({ device: d }) {
  return (
    <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 40px' }}>
      <Field label="Device Name" value={d.name} />
      <Field label="Device ID" value={d.deviceId} mono />
      <Field label="Status" value={d.status} />
      <Field label="Type" value={d.type} />
      <Field label="Manufacturer" value={d.manufacturer} />
      <Field label="Model" value={d.model} />
      <Field label="Serial Number" value={d.serialNumber} mono />
      <Field label="Location" value={d.location} />
      <Field label="IP Address" value={d.ip} mono />
      <Field label="Management VLAN" value={d.managementVlan} />
      <Field label="Port Count" value={d.portCount} />
      <Field label="Uplink Speed" value={d.uplinkSpeed} />
      <Field label="PoE Support" value={d.poeSupported ? 'Supported' : 'Not supported'} />
      <Field label="Firmware Version" value={d.firmwareVersion} />
      <Field label="Created" value={fmtDate(d.createdAt)} />
      <Field label="Last Updated" value={d.updatedAt ? timeAgo(d.updatedAt) : '—'} />
      {d.notes && (
        <div style={{ gridColumn: '1/-1' }}>
          <span style={{ color: 'var(--ink-500)', fontSize: 13, display: 'block', marginBottom: 6 }}>Notes</span>
          <span style={{ fontSize: 13, color: 'var(--ink-800)' }}>{d.notes}</span>
        </div>
      )}
    </div>
  )
}
