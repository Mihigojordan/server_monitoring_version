import { useState, useMemo } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { PERIODS, pct, fmtDateTime } from '../constants'

function barColor(v) {
  if (v >= 90) return '#ef4444'
  if (v >= 70) return '#f59e0b'
  return '#22c55e'
}

function snapshotsInRange(rows, periodMs) {
  const cutoff = Date.now() - periodMs
  return rows.filter(sn => (sn.createdAt?.toDate?.().getTime() || 0) >= cutoff)
}

// Port utilization is derived live from the Ports tab's real per-port status
// (Up vs total tracked) — not a manually-typed number — then a "Log
// Snapshot" freezes that real value into history so a trend can be fit over
// time, same append-only pattern as Storage Management's Capacity tab.
export default function PerformanceTab({ device: d }) {
  const { rows: ports } = useSubcollection('networkDevices', d.id, 'ports', 'portNumber')
  const { rows: snapshots, add, error, setError } = useSubcollection('networkDevices', d.id, 'perfSnapshots', 'createdAt')
  const [period, setPeriod] = useState('24h')
  const [saving, setSaving] = useState(false)

  const portsTotal = Number(d.portCount) || 0
  const portsUp = ports.filter(p => p.status === 'Up').length
  const usedPct = pct(portsUp, portsTotal)
  const freePorts = Math.max(0, portsTotal - portsUp)
  const canLog = portsTotal > 0

  const periodMeta = PERIODS.find(p => p.value === period)
  const inRange = useMemo(() => snapshotsInRange(snapshots, periodMeta.ms), [snapshots, periodMeta])

  async function handleLog() {
    setSaving(true)
    setError(null)
    try {
      await add({ usedPct, portsUp, portsTotal })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Port Utilization</div>
        <div style={{ display: 'flex', gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{portsTotal || '—'}</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Total Ports</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{portsUp}</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>In Use</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{freePorts}</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Free</div></div>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: 'var(--ink-100)', overflow: 'hidden', marginTop: 14 }}>
          <div style={{ width: `${usedPct}%`, height: '100%', background: barColor(usedPct), borderRadius: 6 }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6 }}>
          {canLog
            ? `Utilization: ${usedPct}% — ${portsUp} of ${portsTotal} configured ports currently marked Up in the Ports tab.`
            : 'Set a Port Count on this device (Edit device) to start tracking utilization.'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>Period:</span>
          <select className="form-input" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={handleLog} disabled={saving || !canLog}>
          {saving ? 'Logging…' : 'Log Snapshot'}
        </button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card__head"><h3>Logged Snapshots — {periodMeta.label}</h3></div>
        <div className="table-wrap">
          {inRange.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>
              No snapshots logged in this period. This app doesn't have a live monitoring agent — click "Log Snapshot" whenever you check the device to build a real port-utilization history over time, which also feeds Switch Predictive Analytics.
            </div>
          ) : (
            <table className="data">
              <thead><tr><th>Logged At</th><th>Utilization</th><th>Ports In Use</th></tr></thead>
              <tbody>
                {inRange.map(sn => (
                  <tr key={sn.id}>
                    <td>{fmtDateTime(sn.createdAt)}</td>
                    <td>{sn.usedPct ?? '—'}%</td>
                    <td>{sn.portsUp ?? '—'} / {sn.portsTotal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
