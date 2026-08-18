import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import StatTile from '../../components/charts/StatTile'
import DonutChart from '../../components/charts/DonutChart'
import RadarChart from '../../components/charts/RadarChart'
import RiskGauge from '../../components/charts/RiskGauge'
import { db } from '../../lib/firebase'

const BAND_COLOR = { critical: 'var(--err)', warning: 'var(--warn)', healthy: 'var(--ok)' }
const BAND_LABEL = { critical: 'Critical', warning: 'Warning', healthy: 'Healthy' }
const RISK_BANDS = { critical: 70, warning: 40 }

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function domainStats(list) {
  if (!list || list.length === 0) return null
  const avgRisk = Math.round(list.reduce((s, d) => s + d.riskScore, 0) / list.length)
  return {
    count: list.length,
    avgRisk,
    health: 100 - avgRisk,
    critical: list.filter((d) => d.riskBand === 'critical').length,
    warning: list.filter((d) => d.riskBand === 'warning').length,
    healthy: list.filter((d) => d.riskBand === 'healthy').length,
  }
}

function BandChip({ band }) {
  return (
    <span style={{ background: `color-mix(in srgb, ${BAND_COLOR[band]} 16%, transparent)`, color: BAND_COLOR[band], padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {BAND_LABEL[band]}
    </span>
  )
}

function EmptyNote({ text }) {
  return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--viz-muted)', fontSize: 13 }}>{text}</div>
}

function DomainCard({ to, label, stats, note }) {
  return (
    <Link to={to} className="card" style={{ padding: 16, display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div style={{ fontSize: 11, letterSpacing: '.05em', color: 'var(--ink-500)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      {stats ? (
        <>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink-900)', marginTop: 6 }}>{stats.count}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {stats.critical > 0 && <BandChip band="critical" />}
            {stats.warning > 0 && <BandChip band="warning" />}
            {stats.critical === 0 && stats.warning === 0 && <BandChip band="healthy" />}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 10 }}>{note ?? 'No data yet'}</div>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--brand-600)', fontWeight: 700, marginTop: 12 }}>View details →</div>
    </Link>
  )
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  return res.json()
}

export default function SystemOverview() {
  const [servers, setServers] = useState(null)
  const [storage, setStorage] = useState(null)
  const [switches, setSwitches] = useState(null)
  const [equipment, setEquipment] = useState(null)
  const [utilization, setUtilization] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [alerts, setAlerts] = useState([])
  const [alertsError, setAlertsError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchJson('/infra/predictive-analytics/servers'),
      fetchJson('/infra/predictive-analytics/storage'),
      fetchJson('/infra/predictive-analytics/switches'),
      fetchJson('/infra/analytics/equipment-risk'),
      fetchJson('/infra/resource-utilization/summary'),
    ])
      .then(([srv, stg, sw, eq, util]) => {
        if (cancelled) return
        setServers(srv); setStorage(stg); setSwitches(sw); setEquipment(eq); setUtilization(util)
        setError(null)
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setAlertsError(null)
    }, (err) => setAlertsError(err.message))
    return unsub
  }, [])

  const serverStats = useMemo(() => domainStats(servers), [servers])
  const storageStats = useMemo(() => domainStats(storage), [storage])
  const switchStats = useMemo(() => domainStats(switches), [switches])
  const equipStats = useMemo(() => domainStats(equipment?.items), [equipment])

  const unackCritical = alerts.filter((a) => !a.ack && a.severity === 'critical').length
  const unackWarning = alerts.filter((a) => !a.ack && a.severity === 'warning').length
  const unackInfo = alerts.filter((a) => !a.ack && a.severity === 'info').length
  // Simple, disclosed heuristic — not hand-tuned per alert: each unacknowledged
  // critical costs more "health" than a warning, floored at 0.
  const alertHealth = clamp(100 - unackCritical * 25 - unackWarning * 8, 0, 100)

  const radarAxes = useMemo(() => {
    const axes = []
    if (serverStats) axes.push({ label: 'Servers', value: serverStats.health, display: `${serverStats.health}` })
    if (storageStats) axes.push({ label: 'Storage', value: storageStats.health, display: `${storageStats.health}` })
    if (switchStats) axes.push({ label: 'Switches', value: switchStats.health, display: `${switchStats.health}` })
    if (equipStats) axes.push({ label: 'Equipment', value: equipStats.health, display: `${equipStats.health}` })
    axes.push({ label: 'Alerts', value: alertHealth, display: `${alertHealth}` })
    return axes
  }, [serverStats, storageStats, switchStats, equipStats, alertHealth])

  const overallRisk = useMemo(() => {
    const values = [serverStats?.avgRisk, storageStats?.avgRisk, switchStats?.avgRisk, equipStats?.avgRisk, 100 - alertHealth].filter((v) => v != null)
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
  }, [serverStats, storageStats, switchStats, equipStats, alertHealth])

  const combinedBand = useMemo(() => {
    const domains = [serverStats, storageStats, switchStats, equipStats].filter(Boolean)
    return {
      critical: domains.reduce((s, d) => s + d.critical, 0),
      warning: domains.reduce((s, d) => s + d.warning, 0),
      healthy: domains.reduce((s, d) => s + d.healthy, 0),
    }
  }, [serverStats, storageStats, switchStats, equipStats])

  const topCritical = useMemo(() => {
    if (!servers) return []
    const all = [
      ...servers.map((d) => ({ ...d, kind: 'Server' })),
      ...(storage ?? []).map((d) => ({ ...d, kind: 'Storage' })),
      ...(switches ?? []).map((d) => ({ ...d, kind: 'Switch' })),
      ...(equipment?.items ?? []).map((d) => ({ ...d, kind: 'Equipment' })),
    ]
    return [...all].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8)
  }, [servers, storage, switches, equipment])

  const totalDevices = (serverStats?.count ?? 0) + (storageStats?.count ?? 0) + (switchStats?.count ?? 0) + (equipStats?.count ?? 0)
  const avgUtilization = useMemo(() => {
    const pcts = []
    if (utilization?.servers.fleet.totalRamTotalGb > 0) pcts.push(utilization.servers.fleet.ramPct)
    if (utilization?.storage.fleet.totalCapacityTotalGb > 0) pcts.push(utilization.storage.fleet.capacityPct)
    return pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null
  }, [utilization])

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Dashboard</span></div>
            <h1>System Overview</h1>
          </div>
        </div>

        {(error || alertsError) && (
          <div className="settings-error" style={{ marginBottom: 16, marginLeft: 5 }}>
            {error && <div>Could not reach the infrastructure backend ({error}). Is the NestJS backend running on port 3001?</div>}
            {alertsError && <div>Could not reach Alerts ({alertsError}).</div>}
          </div>
        )}

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading system-wide status…</div>
        ) : (
          <div style={{ marginLeft: 5 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16, maxWidth: 900 }}>
              A single at-a-glance view across everything this system tracks — servers, storage, switches, equipment
              lifecycle and open alerts — each pulled live from the same real data the dedicated pages use. Click any
              card to drill into that area.
            </div>

            {/* ── Hero: system health radar + overall risk ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
              <div className="card">
                <div className="card__head"><h3>System Health</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>100 − avg risk per domain</span></div>
                <div className="card__body" style={{ display: 'flex', justifyContent: 'center' }}>
                  <RadarChart axes={radarAxes} color="var(--viz-series-1)" />
                </div>
              </div>
              <div className="card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <RiskGauge value={overallRisk} bands={RISK_BANDS} />
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 8, textAlign: 'center' }}>Overall risk — average across all tracked domains</div>
              </div>
            </div>

            {/* ── KPI row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <StatTile label="Devices Monitored" value={totalDevices} sub="Servers · Storage · Switches · Equipment" color="var(--viz-series-1)" />
              <StatTile
                label="Open Alerts" value={unackCritical + unackWarning + unackInfo}
                sub={`${unackCritical} critical · ${unackWarning} warning`}
                color={unackCritical > 0 ? 'var(--err)' : unackWarning > 0 ? 'var(--warn)' : 'var(--ok)'}
              />
              <StatTile
                label="Equipment Needing Attention" value={equipStats ? equipStats.critical + equipStats.warning : 0}
                sub={equipStats ? `of ${equipStats.count} tracked` : 'No equipment yet'}
                color="var(--err)"
              />
              <StatTile
                label="Avg Fleet Utilization" value={avgUtilization != null ? `${avgUtilization}%` : '—'}
                sub="RAM + storage capacity" color="var(--viz-series-6)"
              />
            </div>

            {/* ── Combined risk distribution + domain cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
              <div className="card">
                <div className="card__head"><h3>Combined Risk Distribution</h3></div>
                <div className="card__body">
                  <DonutChart
                    centerLabel={String(totalDevices)}
                    data={[
                      { label: 'Critical', value: combinedBand.critical, color: 'var(--err)' },
                      { label: 'Warning', value: combinedBand.warning, color: 'var(--warn)' },
                      { label: 'Healthy', value: combinedBand.healthy, color: 'var(--ok)' },
                    ]}
                  />
                </div>
              </div>
              <div className="card">
                <div className="card__head"><h3>Areas</h3></div>
                <div className="card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  <DomainCard to="/predictive-analytics/servers" label="Servers" stats={serverStats} />
                  <DomainCard to="/predictive-analytics/storage" label="Storage" stats={storageStats} note="No storage arrays yet" />
                  <DomainCard to="/predictive-analytics/switches" label="Switches" stats={switchStats} />
                  <DomainCard to="/predictive-maintenance" label="Equipment" stats={equipStats} />
                  <DomainCard to="/alerts" label="Alerts" stats={{ count: alerts.length, critical: unackCritical, warning: unackWarning, healthy: 0 }} />
                </div>
              </div>
            </div>

            {/* ── Top critical items across everything ── */}
            <div className="card">
              <div className="card__head"><h3>Top Risks Across All Systems</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>Highest score first</span></div>
              <div className="card__body">
                {topCritical.length === 0 ? <EmptyNote text="Nothing scored yet." /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {topCritical.map((d) => (
                      <div key={`${d.kind}-${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: `color-mix(in srgb, ${BAND_COLOR[d.riskBand]} 6%, transparent)`, borderRadius: 8, fontSize: 13 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: BAND_COLOR[d.riskBand], flexShrink: 0 }} />
                        <span style={{ flex: 1, fontWeight: 600, color: 'var(--ink-900)' }}>{d.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600 }}>{d.kind}</span>
                        <span style={{ fontWeight: 700, color: 'var(--ink-800)', width: 30, textAlign: 'right' }}>{d.riskScore}</span>
                        <BandChip band={d.riskBand} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
