import { pct } from '../constants'

function barColor(v) {
  if (v >= 90) return '#ef4444'
  if (v >= 70) return '#f59e0b'
  return '#22c55e'
}

function UsageBar({ pct: v }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: 8, borderRadius: 5, background: 'var(--ink-100)', overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: barColor(v), borderRadius: 5 }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6 }}>Usage: {v}%</div>
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: 'var(--ink-500)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}

export default function HardwareTab({ server: s }) {
  const ramPct = pct(s.ramUsedGb, s.ramTotalGb)
  const ramAvail = Math.max(0, (Number(s.ramTotalGb) || 0) - (Number(s.ramUsedGb) || 0))
  const storagePct = pct(s.storageUsedGb, s.storageTotalGb)
  const storageAvail = Math.max(0, (Number(s.storageTotalGb) || 0) - (Number(s.storageUsedGb) || 0))
  const cpuUsage = Math.max(0, Math.min(100, Number(s.cpuUsage) || 0))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>CPU</div>
        <StatRow label="Model" value={s.cpuModel || '—'} />
        <StatRow label="Cores" value={s.cpuCores || '—'} />
        <StatRow label="Threads" value={s.cpuThreads || '—'} />
        <StatRow label="Current Usage" value={`${cpuUsage}%`} />
        <StatRow label="Average Usage" value={s.cpuUsageAvg ? `${s.cpuUsageAvg}%` : '—'} />
        <StatRow label="Peak Usage" value={s.cpuUsagePeak ? `${s.cpuUsagePeak}%` : '—'} />
        <UsageBar pct={cpuUsage} />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>RAM</div>
        <StatRow label="Total" value={s.ramTotalGb ? `${s.ramTotalGb} GB` : '—'} />
        <StatRow label="Used" value={s.ramUsedGb ? `${s.ramUsedGb} GB` : '—'} />
        <StatRow label="Available" value={`${ramAvail} GB`} />
        <UsageBar pct={ramPct} />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Storage</div>
        <StatRow label="Total" value={s.storageTotalGb ? `${s.storageTotalGb} GB` : '—'} />
        <StatRow label="Used" value={s.storageUsedGb ? `${s.storageUsedGb} GB` : '—'} />
        <StatRow label="Available" value={`${storageAvail} GB`} />
        <StatRow label="Disk Type" value={s.diskType || '—'} />
        <StatRow label="Number of Disks" value={s.diskCount || '—'} />
        <UsageBar pct={storagePct} />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Network</div>
        <StatRow label="Download Speed" value={s.netDownloadMbps ? `${s.netDownloadMbps} Mbps` : '—'} />
        <StatRow label="Upload Speed" value={s.netUploadMbps ? `${s.netUploadMbps} Mbps` : '—'} />
        <StatRow label="Bandwidth Usage" value={s.netBandwidthUsagePct ? `${s.netBandwidthUsagePct}%` : '—'} />
        <StatRow label="Interface" value={s.netInterface || '—'} />
        <StatRow label="Public IP" value={s.publicIp || '—'} />
        <StatRow label="Private IP" value={s.privateIp || '—'} />
        <StatRow label="Network Status" value={s.netStatus || '—'} />
        <StatRow label="Packets Sent" value={s.packetsSent || '—'} />
        <StatRow label="Packets Received" value={s.packetsReceived || '—'} />
      </div>
    </div>
  )
}
