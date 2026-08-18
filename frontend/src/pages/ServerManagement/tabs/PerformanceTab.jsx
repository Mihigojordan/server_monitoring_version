import { useState, useMemo } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { PERIODS, pct, fmtDateTime } from '../constants'

function barColor(v) {
  if (v >= 90) return '#ef4444'
  if (v >= 70) return '#f59e0b'
  return '#22c55e'
}

function Gauge({ label, value, suffix = '%' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: barColor(v) }}>{v}{suffix}</div>
      <div style={{ height: 8, borderRadius: 5, background: 'var(--ink-100)', overflow: 'hidden', marginTop: 10 }}>
        <div style={{ width: `${v}%`, height: '100%', background: barColor(v), borderRadius: 5 }} />
      </div>
    </div>
  )
}

const EMPTY_SNAPSHOT = { cpuPct: '', ramPct: '', diskPct: '', networkPct: '', responseTimeMs: '', serverLoad: '' }

function snapshotsInRange(snapshots, periodMs) {
  const cutoff = Date.now() - periodMs
  return snapshots.filter(sn => (sn.createdAt?.toDate?.().getTime() || 0) >= cutoff)
}

export default function PerformanceTab({ server: s }) {
  const { rows: snapshots, add, error, setError } = useSubcollection('servers', s.id, 'perfSnapshots', 'createdAt')
  const [period, setPeriod] = useState('24h')
  const [showLog, setShowLog] = useState(false)
  const [form, setForm] = useState(EMPTY_SNAPSHOT)
  const [saving, setSaving] = useState(false)

  const ramPct = pct(s.ramUsedGb, s.ramTotalGb)
  const storagePct = pct(s.storageUsedGb, s.storageTotalGb)
  const cpuUsage = Math.max(0, Math.min(100, Number(s.cpuUsage) || 0))
  const netUsage = Math.max(0, Math.min(100, Number(s.netBandwidthUsagePct) || 0))

  const periodMeta = PERIODS.find(p => p.value === period)
  const inRange = useMemo(() => snapshotsInRange(snapshots, periodMeta.ms), [snapshots, periodMeta])

  const latest = snapshots[0]

  async function handleLog(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await add({ ...form })
      setShowLog(false)
      setForm(EMPTY_SNAPSHOT)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>Period:</span>
          <select className="form-input" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={() => setShowLog(true)}>Log Snapshot</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <Gauge label="CPU Usage" value={cpuUsage} />
        <Gauge label="RAM Usage" value={ramPct} />
        <Gauge label="Storage" value={storagePct} />
        <Gauge label="Network" value={netUsage} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>UPTIME</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{s.uptimeDays ? `${s.uptimeDays} days` : '—'}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>LATEST RESPONSE TIME</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{latest?.responseTimeMs ? `${latest.responseTimeMs} ms` : '—'}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>LATEST SERVER LOAD</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{latest?.serverLoad || '—'}</div>
        </div>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card__head"><h3>Logged Snapshots — {periodMeta.label}</h3></div>
        <div className="table-wrap">
          {inRange.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>
              No snapshots logged in this period. This app doesn't have a live monitoring agent — click "Log Snapshot" whenever you check the server to build a real usage history over time.
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Logged At</th><th>CPU</th><th>RAM</th><th>Disk</th><th>Network</th><th>Response Time</th><th>Server Load</th>
                </tr>
              </thead>
              <tbody>
                {inRange.map(sn => (
                  <tr key={sn.id}>
                    <td>{fmtDateTime(sn.createdAt)}</td>
                    <td>{sn.cpuPct || '—'}%</td>
                    <td>{sn.ramPct || '—'}%</td>
                    <td>{sn.diskPct || '—'}%</td>
                    <td>{sn.networkPct || '—'}%</td>
                    <td>{sn.responseTimeMs ? `${sn.responseTimeMs} ms` : '—'}</td>
                    <td>{sn.serverLoad || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showLog && (
        <div className="modal-backdrop" onClick={() => setShowLog(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal__head"><h3>Log Performance Snapshot</h3>
              <button className="modal__close" onClick={() => setShowLog(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleLog}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group"><label className="form-label">CPU %</label><input className="form-input" type="number" value={form.cpuPct} onChange={e => setForm(f => ({ ...f, cpuPct: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">RAM %</label><input className="form-input" type="number" value={form.ramPct} onChange={e => setForm(f => ({ ...f, ramPct: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Disk %</label><input className="form-input" type="number" value={form.diskPct} onChange={e => setForm(f => ({ ...f, diskPct: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Network %</label><input className="form-input" type="number" value={form.networkPct} onChange={e => setForm(f => ({ ...f, networkPct: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Response Time (ms)</label><input className="form-input" type="number" value={form.responseTimeMs} onChange={e => setForm(f => ({ ...f, responseTimeMs: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Server Load</label><input className="form-input" value={form.serverLoad} onChange={e => setForm(f => ({ ...f, serverLoad: e.target.value }))} placeholder="e.g. 0.85, 1.02, 1.10" /></div>
              </div>
              <div className="modal__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowLog(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>{saving ? 'Saving…' : 'Log Snapshot'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
