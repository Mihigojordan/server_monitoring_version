import { useState, useEffect } from 'react'
import AppShell from '../../components/layout/AppShell'
import StatTile from '../../components/charts/StatTile'
import DonutChart from '../../components/charts/DonutChart'
import { compactNumber } from '../../components/charts/format'
import { statusMeta } from '../../lib/infraShared'

function meterColor(pct) {
  if (pct == null) return 'var(--viz-muted)'
  if (pct >= 90) return 'var(--err)'
  if (pct >= 70) return 'var(--warn)'
  return 'var(--ok)'
}

function Meter({ label, pctValue, display }) {
  const v = pctValue == null ? null : Math.max(0, Math.min(100, pctValue))
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--viz-text-secondary)', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--viz-text-primary)' }}>{display ?? (v == null ? '—' : `${v}%`)}</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: 'var(--viz-grid)', overflow: 'hidden' }}>
        {v != null && <div style={{ width: `${v}%`, height: '100%', background: meterColor(v), borderRadius: 4 }} />}
      </div>
    </div>
  )
}

function StatusChip({ status }) {
  const meta = statusMeta(status)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: meta.bg, color: meta.text, padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
      {status}
    </span>
  )
}

function DeviceCard({ name, sub, status, children }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--viz-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--viz-muted)', marginTop: 1 }}>{sub}</div>}
        </div>
        <StatusChip status={status} />
      </div>
      {children}
    </div>
  )
}

function EmptyNote({ text }) {
  return <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--viz-muted)', fontSize: 13 }}>{text}</div>
}

function fmtGb(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}TB` : `${compactNumber(v)}GB`
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  return res.json()
}

export default function ResourceUtilization() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchJson('/infra/resource-utilization/summary')
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Resource Utilization</span></div>
            <h1>Resource Utilization</h1>
          </div>
        </div>

        {error && (
          <div className="settings-error" style={{ marginBottom: 16, marginLeft: 5 }}>
            Could not reach the resource-utilization backend ({error}). Is the NestJS backend running on port 3001 with real Firebase credentials in backend/.env?
          </div>
        )}

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading current usage from Firestore…</div>
        ) : data && (
          <div style={{ marginLeft: 5 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16, maxWidth: 900 }}>
              Live current-usage snapshot — same Firestore collections Device Management reads and writes. This is "how full
              is the fleet right now" in real units (GB, IOPS, ports); for risk scoring and trend forecasting, see Predictive Analytics.
            </div>

            {/* ── Fleet KPI row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <StatTile
                label="Avg CPU Load" value={data.servers.fleet.avgCpuPct != null ? `${data.servers.fleet.avgCpuPct}%` : '—'}
                sub={`${data.servers.fleet.count} servers`} color={meterColor(data.servers.fleet.avgCpuPct)}
              />
              <StatTile
                label="RAM Utilization" value={`${data.servers.fleet.ramPct}%`}
                sub={`${fmtGb(data.servers.fleet.totalRamUsedGb)} of ${fmtGb(data.servers.fleet.totalRamTotalGb)}`}
                color={meterColor(data.servers.fleet.ramPct)}
              />
              <StatTile
                label="Storage Capacity" value={data.storage.fleet.count > 0 ? `${data.storage.fleet.capacityPct}%` : '—'}
                sub={data.storage.fleet.count > 0 ? `${fmtGb(data.storage.fleet.totalCapacityUsedGb)} of ${fmtGb(data.storage.fleet.totalCapacityTotalGb)}` : 'No storage arrays yet'}
                color={meterColor(data.storage.fleet.capacityPct)}
              />
              <StatTile
                label="Switch Port Utilization" value={data.switches.fleet.portPct != null ? `${data.switches.fleet.portPct}%` : '—'}
                sub={data.switches.fleet.portPct != null ? `${data.switches.fleet.totalPortsUp} of ${data.switches.fleet.totalPorts} ports` : 'No Port Count logged yet'}
                color={meterColor(data.switches.fleet.portPct)}
              />
            </div>

            {/* ══ SERVERS ══ */}
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '4px 0 12px', color: 'var(--ink-800)' }}>Servers</h2>
            {data.servers.devices.length === 0 ? (
              <div className="card" style={{ marginBottom: 22 }}><EmptyNote text="No servers in Firestore yet." /></div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>RAM — Used vs Free</h3></div>
                    <div className="card__body">
                      <DonutChart
                        valueFormatter={fmtGb}
                        centerLabel={`${data.servers.fleet.ramPct}%`}
                        data={[
                          { label: 'Used', value: data.servers.fleet.totalRamUsedGb, color: meterColor(data.servers.fleet.ramPct) },
                          { label: 'Free', value: Math.max(0, data.servers.fleet.totalRamTotalGb - data.servers.fleet.totalRamUsedGb), color: 'var(--viz-grid)' },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="card">
                    <div className="card__head"><h3>Disk — Used vs Free</h3></div>
                    <div className="card__body">
                      <DonutChart
                        valueFormatter={fmtGb}
                        centerLabel={`${data.servers.fleet.diskPct}%`}
                        data={[
                          { label: 'Used', value: data.servers.fleet.totalDiskUsedGb, color: meterColor(data.servers.fleet.diskPct) },
                          { label: 'Free', value: Math.max(0, data.servers.fleet.totalDiskTotalGb - data.servers.fleet.totalDiskUsedGb), color: 'var(--viz-grid)' },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 18, padding: 18 }}>
                  <div style={gridStyle}>
                    {data.servers.devices.map((d) => (
                      <DeviceCard key={d.id} name={d.name} sub={d.role} status={d.status}>
                        <Meter label="CPU" pctValue={d.cpuPct} />
                        <Meter label="RAM" pctValue={d.ramTotalGb > 0 ? d.ramPct : null} display={d.ramTotalGb > 0 ? `${fmtGb(d.ramUsedGb)} / ${fmtGb(d.ramTotalGb)}` : undefined} />
                        <Meter label="Disk" pctValue={d.diskTotalGb > 0 ? d.diskPct : null} display={d.diskTotalGb > 0 ? `${fmtGb(d.diskUsedGb)} / ${fmtGb(d.diskTotalGb)}` : undefined} />
                      </DeviceCard>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 22 }}>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr><th>NAME</th><th>ROLE</th><th>STATUS</th><th className="num">CPU</th><th className="num">RAM</th><th className="num">DISK</th></tr>
                      </thead>
                      <tbody>
                        {data.servers.devices.map((d) => (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 600 }}>{d.name}</td>
                            <td style={{ color: 'var(--ink-500)' }}>{d.role ?? '—'}</td>
                            <td><StatusChip status={d.status} /></td>
                            <td className="num">{d.cpuPct}%</td>
                            <td className="num">{d.ramTotalGb > 0 ? `${fmtGb(d.ramUsedGb)} / ${fmtGb(d.ramTotalGb)}` : '—'}</td>
                            <td className="num">{d.diskTotalGb > 0 ? `${fmtGb(d.diskUsedGb)} / ${fmtGb(d.diskTotalGb)}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ══ STORAGE ══ */}
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '4px 0 12px', color: 'var(--ink-800)' }}>Storage</h2>
            {data.storage.devices.length === 0 ? (
              <div className="card" style={{ marginBottom: 22 }}><EmptyNote text="No storage arrays in Firestore yet — add some in Device Management first." /></div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 18, marginBottom: 18, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>Capacity — Used vs Free</h3></div>
                    <div className="card__body">
                      <DonutChart
                        valueFormatter={fmtGb}
                        centerLabel={`${data.storage.fleet.capacityPct}%`}
                        data={[
                          { label: 'Used', value: data.storage.fleet.totalCapacityUsedGb, color: meterColor(data.storage.fleet.capacityPct) },
                          { label: 'Free', value: Math.max(0, data.storage.fleet.totalCapacityTotalGb - data.storage.fleet.totalCapacityUsedGb), color: 'var(--viz-grid)' },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="card">
                    <div className="card__head"><h3>I/O Totals</h3></div>
                    <div className="card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                      <StatTile label="Avg Latency" value={data.storage.fleet.avgLatencyMs != null ? `${data.storage.fleet.avgLatencyMs}ms` : '—'} color="var(--viz-series-4)" />
                      <StatTile label="Total IOPS" value={compactNumber(data.storage.fleet.totalIops)} color="var(--viz-series-1)" />
                      <StatTile label="Total Throughput" value={`${compactNumber(data.storage.fleet.totalThroughputMbps)} MB/s`} color="var(--viz-series-6)" />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 18, padding: 18 }}>
                  <div style={gridStyle}>
                    {data.storage.devices.map((d) => (
                      <DeviceCard key={d.id} name={d.name} sub={d.type} status={d.status}>
                        <Meter label="Capacity" pctValue={d.capacityTotalGb > 0 ? d.capacityPct : null} display={d.capacityTotalGb > 0 ? `${fmtGb(d.capacityUsedGb)} / ${fmtGb(d.capacityTotalGb)}` : undefined} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--viz-text-secondary)', marginTop: 8 }}>
                          <span>Latency: <strong style={{ color: 'var(--viz-text-primary)' }}>{d.latencyMs}ms</strong></span>
                          <span>IOPS: <strong style={{ color: 'var(--viz-text-primary)' }}>{compactNumber(d.iops)}</strong></span>
                        </div>
                      </DeviceCard>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 22 }}>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr><th>NAME</th><th>TYPE</th><th>STATUS</th><th className="num">CAPACITY</th><th className="num">LATENCY</th><th className="num">IOPS</th><th className="num">THROUGHPUT</th></tr>
                      </thead>
                      <tbody>
                        {data.storage.devices.map((d) => (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 600 }}>{d.name}</td>
                            <td style={{ color: 'var(--ink-500)' }}>{d.type ?? '—'}</td>
                            <td><StatusChip status={d.status} /></td>
                            <td className="num">{d.capacityTotalGb > 0 ? `${fmtGb(d.capacityUsedGb)} / ${fmtGb(d.capacityTotalGb)}` : '—'}</td>
                            <td className="num">{d.latencyMs}ms</td>
                            <td className="num">{compactNumber(d.iops)}</td>
                            <td className="num">{compactNumber(d.throughputMbps)} MB/s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ══ SWITCHES ══ */}
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '4px 0 12px', color: 'var(--ink-800)' }}>Switches</h2>
            {data.switches.devices.length === 0 ? (
              <div className="card"><EmptyNote text="No switches in Firestore yet — add some in Device Management first." /></div>
            ) : (
              <>
                <div className="card" style={{ marginBottom: 18, padding: 18 }}>
                  <div style={gridStyle}>
                    {data.switches.devices.map((d) => (
                      <DeviceCard key={d.id} name={d.name} sub={d.model} status={d.status}>
                        {d.portCount > 0 ? (
                          <Meter label="Ports" pctValue={d.portPct} display={`${d.portsUp} / ${d.portCount}`} />
                        ) : (
                          <div style={{ fontSize: 11.5, color: 'var(--viz-muted)' }}>No Port Count logged in Device Management.</div>
                        )}
                      </DeviceCard>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr><th>NAME</th><th>MODEL</th><th>STATUS</th><th className="num">PORTS</th></tr>
                      </thead>
                      <tbody>
                        {data.switches.devices.map((d) => (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 600 }}>{d.name}</td>
                            <td style={{ color: 'var(--ink-500)' }}>{d.model || '—'}</td>
                            <td><StatusChip status={d.status} /></td>
                            <td className="num">{d.portCount > 0 ? `${d.portsUp} / ${d.portCount}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
