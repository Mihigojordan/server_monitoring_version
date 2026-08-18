import { useState, useMemo } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { PERIODS, pct, fmtDateTime } from '../constants'

function barColor(v) {
  if (v >= 90) return '#ef4444'
  if (v >= 70) return '#f59e0b'
  return '#22c55e'
}

function Gauge({ label, value, suffix = '%', color }) {
  const v = Math.max(0, Number(value) || 0)
  const clamped = suffix === '%' ? Math.min(100, v) : v
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: color || barColor(clamped) }}>{v}{suffix}</div>
      {suffix === '%' && (
        <div style={{ height: 8, borderRadius: 5, background: 'var(--ink-100)', overflow: 'hidden', marginTop: 10 }}>
          <div style={{ width: `${clamped}%`, height: '100%', background: barColor(clamped), borderRadius: 5 }} />
        </div>
      )}
    </div>
  )
}

const EMPTY_SNAPSHOT = { usedPct: '', iops: '', throughputMbps: '', latencyMs: '' }

function snapshotsInRange(rows, periodMs) {
  const cutoff = Date.now() - periodMs
  return rows.filter(sn => (sn.createdAt?.toDate?.().getTime() || 0) >= cutoff)
}

export default function CapacityTab({ device: d }) {
  const { rows: snapshots, add, error, setError } = useSubcollection('storageDevices', d.id, 'perfSnapshots', 'createdAt')
  const [period, setPeriod] = useState('24h')
  const [showLog, setShowLog] = useState(false)
  const [form, setForm] = useState(EMPTY_SNAPSHOT)
  const [saving, setSaving] = useState(false)

  const usedPct = pct(d.capacityUsedGb, d.capacityTotalGb)
  const availableGb = Math.max(0, (Number(d.capacityTotalGb) || 0) - (Number(d.capacityUsedGb) || 0))

  const periodMeta = PERIODS.find(p => p.value === period)
  const inRange = useMemo(() => snapshotsInRange(snapshots, periodMeta.ms), [snapshots, periodMeta])

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
      <div className="card" style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Capacity</div>
        <div style={{ display: 'flex', gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{d.capacityTotalGb || '—'} GB</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Total</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{d.capacityUsedGb || 0} GB</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Used</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 800 }}>{availableGb} GB</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Available</div></div>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: 'var(--ink-100)', overflow: 'hidden', marginTop: 14 }}>
          <div style={{ width: `${usedPct}%`, height: '100%', background: barColor(usedPct), borderRadius: 6 }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6 }}>Usage: {usedPct}%</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <Gauge label="IOPS" value={d.iops || 0} suffix="" color="#4338ca" />
        <Gauge label="Throughput" value={d.throughputMbps || 0} suffix=" MB/s" color="#0e7490" />
        <Gauge label="Latency" value={d.latencyMs || 0} suffix=" ms" color="#c2410c" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>Period:</span>
          <select className="form-input" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <button className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={() => setShowLog(true)}>Log Snapshot</button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card__head"><h3>Logged Snapshots — {periodMeta.label}</h3></div>
        <div className="table-wrap">
          {inRange.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>
              No snapshots logged in this period. This app doesn't have a live monitoring agent — click "Log Snapshot" whenever you check the device to build a real usage history over time.
            </div>
          ) : (
            <table className="data">
              <thead><tr><th>Logged At</th><th>Used %</th><th>IOPS</th><th>Throughput</th><th>Latency</th></tr></thead>
              <tbody>
                {inRange.map(sn => (
                  <tr key={sn.id}>
                    <td>{fmtDateTime(sn.createdAt)}</td>
                    <td>{sn.usedPct || '—'}%</td>
                    <td>{sn.iops || '—'}</td>
                    <td>{sn.throughputMbps ? `${sn.throughputMbps} MB/s` : '—'}</td>
                    <td>{sn.latencyMs ? `${sn.latencyMs} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showLog && (
        <div className="modal-backdrop" onClick={() => setShowLog(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal__head"><h3>Log Capacity/Performance Snapshot</h3>
              <button className="modal__close" onClick={() => setShowLog(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleLog}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group"><label className="form-label">Used %</label><input className="form-input" type="number" value={form.usedPct} onChange={e => setForm(f => ({ ...f, usedPct: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">IOPS</label><input className="form-input" type="number" value={form.iops} onChange={e => setForm(f => ({ ...f, iops: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Throughput (MB/s)</label><input className="form-input" type="number" value={form.throughputMbps} onChange={e => setForm(f => ({ ...f, throughputMbps: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Latency (ms)</label><input className="form-input" type="number" value={form.latencyMs} onChange={e => setForm(f => ({ ...f, latencyMs: e.target.value }))} /></div>
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
