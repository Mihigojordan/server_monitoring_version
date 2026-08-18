import { useState, useEffect, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import AppShell from '../../components/layout/AppShell'
import StatTile from '../../components/charts/StatTile'
import DonutChart from '../../components/charts/DonutChart'
import BarChart from '../../components/charts/BarChart'
import RadarChart from '../../components/charts/RadarChart'
import ScatterChart from '../../components/charts/ScatterChart'
import RiskGauge from '../../components/charts/RiskGauge'
import { compactNumber } from '../../components/charts/format'
import { statusMeta } from '../../lib/infraShared'

const BAND_COLOR = { critical: 'var(--err)', warning: 'var(--warn)', healthy: 'var(--ok)' }
const BAND_LABEL = { critical: 'Critical', warning: 'Warning', healthy: 'Healthy' }
const BAND_LEGEND = [
  { label: 'Critical', color: 'var(--err)' },
  { label: 'Warning', color: 'var(--warn)' },
  { label: 'Healthy', color: 'var(--ok)' },
]

// Disclosed in backend/src/predictive-analytics/config.ts — duplicated here
// only for the gauge's tick marks, not for any scoring math (that all
// happens server-side against live Firestore data).
const RISK_BANDS = { critical: 70, warning: 40 }

const CATEGORICAL_COLORS = [
  'var(--viz-series-1)', 'var(--viz-series-2)', 'var(--viz-series-3)', 'var(--viz-series-4)',
  'var(--viz-series-5)', 'var(--viz-series-6)', 'var(--viz-series-7)', 'var(--viz-series-8)',
]

const AGE_BUCKETS = [
  { label: '< 1yr', test: (a) => a < 1, color: 'var(--viz-seq-100)' },
  { label: '1-2yr', test: (a) => a >= 1 && a < 2, color: 'var(--viz-seq-250)' },
  { label: '2-4yr', test: (a) => a >= 2 && a < 4, color: 'var(--viz-seq-400)' },
  { label: '4-8yr', test: (a) => a >= 4 && a < 8, color: 'var(--viz-seq-550)' },
  { label: '8yr+', test: (a) => a >= 8, color: 'var(--viz-seq-700)' },
]

// One dedicated page per device type — this table is the only place that
// knows how each type's fields differ. Switches use port utilization (ports
// marked Up in the Ports tab, out of the device's Port Count) as their
// primary metric — the switch analogue of storage capacity — so a device
// with no Port Count set simply has no forecast/radar (handled per-device
// below), not a category-wide cutout.
const CATEGORY_META = {
  servers: {
    label: 'Servers', singular: 'Server', pageTitle: 'Server Predictive Analytics',
    endpoint: '/infra/predictive-analytics/servers', labelKey: 'role',
    forecastTitle: 'CPU Saturation Forecast', forecastNote: 'Projected days until CPU hits its critical threshold',
    forecastDays: (d) => d.cpu.daysToCritical,
    radarColor: 'var(--viz-series-1)',
    radarAxes: (d) => [
      { label: 'CPU', value: (d.cpu.currentPct / d.cpu.criticalThreshold) * 100, display: `${d.cpu.currentPct}%` },
      { label: 'RAM', value: (d.ram.currentPct / d.ram.criticalThreshold) * 100, display: `${d.ram.currentPct}%` },
      { label: 'Disk', value: (d.disk.currentPct / d.disk.criticalThreshold) * 100, display: `${d.disk.currentPct}%` },
      { label: 'Risk', value: d.riskScore, display: `${d.riskScore}` },
    ],
  },
  storage: {
    label: 'Storage', singular: 'Storage Array', pageTitle: 'Storage Predictive Analytics',
    endpoint: '/infra/predictive-analytics/storage', labelKey: 'type',
    forecastTitle: 'Capacity Forecast', forecastNote: 'Projected days until 100% full',
    forecastDays: (d) => d.capacity.daysToCritical,
    radarColor: 'var(--viz-series-1)',
    radarAxes: (d) => [
      { label: 'Capacity', value: (d.capacity.currentPct / d.capacity.criticalThreshold) * 100, display: `${d.capacity.currentPct}%` },
      { label: 'Latency', value: (d.latency.currentPct / d.latency.criticalThreshold) * 100, display: `${d.latency.currentPct}ms` },
      { label: 'Risk', value: d.riskScore, display: `${d.riskScore}` },
    ],
  },
  switches: {
    label: 'Switches', singular: 'Switch', pageTitle: 'Switch Predictive Analytics',
    endpoint: '/infra/predictive-analytics/switches', labelKey: 'model',
    forecastTitle: 'Port Capacity Forecast', forecastNote: 'Projected days until all tracked ports are in use',
    forecastDays: (d) => d.portUtilization?.daysToCritical ?? null,
    radarColor: 'var(--viz-series-1)',
    radarAxes: (d) => d.portUtilization ? [
      { label: 'Port Utilization', value: (d.portUtilization.currentPct / d.portUtilization.criticalThreshold) * 100, display: `${d.portUtilization.currentPct}%` },
      { label: 'Risk', value: d.riskScore, display: `${d.riskScore}` },
    ] : [
      { label: 'Risk', value: d.riskScore, display: `${d.riskScore}` },
    ],
  },
}

const FORECAST_HORIZON_DAYS = 365

function EmptyNote({ text }) {
  return <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--viz-muted)', fontSize: 13 }}>{text}</div>
}

function BandChip({ band }) {
  return (
    <span style={{ background: `color-mix(in srgb, ${BAND_COLOR[band]} 16%, transparent)`, color: BAND_COLOR[band], padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {BAND_LABEL[band]}
    </span>
  )
}

function StatusChip({ status }) {
  const meta = statusMeta(status)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: meta.bg, color: meta.text, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
      {status}
    </span>
  )
}

function groupCount(list, keyFn) {
  const counts = {}
  list.forEach((d) => {
    const k = keyFn(d) || 'Unknown'
    counts[k] = (counts[k] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  return res.json()
}

export default function PredictiveAnalytics({ category }) {
  const meta = CATEGORY_META[category]
  const hasRadar = !!meta.radarAxes
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deviceId, setDeviceId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchJson(meta.endpoint)
      .then((data) => {
        if (cancelled) return
        setList(data)
        setDeviceId(data[0]?.id ?? null)
        setError(null)
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const selectedDevice = useMemo(() => list?.find((d) => d.id === deviceId) ?? list?.[0] ?? null, [list, deviceId])

  const riskCounts = useMemo(() => {
    if (!list) return { critical: 0, warning: 0, healthy: 0 }
    return {
      critical: list.filter((d) => d.riskBand === 'critical').length,
      warning: list.filter((d) => d.riskBand === 'warning').length,
      healthy: list.filter((d) => d.riskBand === 'healthy').length,
    }
  }, [list])

  const avgRiskScore = useMemo(() => (
    list && list.length ? Math.round(list.reduce((s, d) => s + d.riskScore, 0) / list.length) : null
  ), [list])

  const topRisks = useMemo(() => (
    list ? [...list].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8) : []
  ), [list])

  const forecastAll = useMemo(() => (
    list && meta.forecastDays ? list
      .map((d) => ({ id: d.id, name: d.name, days: meta.forecastDays(d) }))
      .filter((f) => f.days != null)
      .sort((a, b) => a.days - b.days)
      : []
  ), [list, meta])
  // A "0 days until critical" bar has zero width and reads as empty — but
  // 0 means "already there," which isn't a forecast at all. Split it out
  // instead of charting it.
  const alreadyCritical = forecastAll.filter((f) => f.days === 0)
  const forecastNear = forecastAll.filter((f) => f.days > 0 && f.days <= FORECAST_HORIZON_DAYS)
  const stableCount = forecastAll.filter((f) => f.days > FORECAST_HORIZON_DAYS).length

  const forecastColor = (days) => (days < 60 ? 'var(--err)' : days < 180 ? 'var(--warn)' : 'var(--ok)')

  const statusBreakdown = useMemo(() => (
    list ? groupCount(list, (d) => d.status).map(([label, value]) => ({ label, value, color: statusMeta(label).dot })) : []
  ), [list])

  const roleBreakdown = useMemo(() => (
    list ? groupCount(list, (d) => d[meta.labelKey] || d.model).map(([label, value], i) => ({ label, value, color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] })) : []
  ), [list, meta])

  const ageDistribution = useMemo(() => {
    if (!list) return []
    const buckets = AGE_BUCKETS.map((b) => ({ label: b.label, value: 0, color: b.color }))
    let unknown = 0
    list.forEach((d) => {
      if (d.ageYears == null) { unknown++; return }
      const idx = AGE_BUCKETS.findIndex((b) => b.test(d.ageYears))
      if (idx >= 0) buckets[idx].value++
    })
    if (unknown > 0) buckets.push({ label: 'Unknown', value: unknown, color: 'var(--viz-muted)' })
    return buckets.filter((b) => b.value > 0)
  }, [list])

  const riskAgePoints = useMemo(() => (
    list ? list.filter((d) => d.ageYears != null).map((d) => ({ id: d.id, label: d.name, x: d.ageYears, y: d.riskScore, color: BAND_COLOR[d.riskBand] })) : []
  ), [list])

  const roleLabel = meta.labelKey === 'role' ? 'Role' : meta.labelKey === 'type' ? 'Type' : 'Model'

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Predictive Analytics</span><span>›</span><span>{meta.label}</span></div>
            <h1>{meta.pageTitle}</h1>
          </div>
          <div className="tab-bar">
            {Object.entries(CATEGORY_META).map(([key, m]) => (
              <NavLink key={key} to={`/predictive-analytics/${key}`} className={({ isActive }) => isActive ? 'is-active' : ''}>{m.label}</NavLink>
            ))}
          </div>
        </div>

        {error && (
          <div className="settings-error" style={{ marginBottom: 16, marginLeft: 5 }}>
            Could not reach the predictive-analytics backend ({error}). Is the NestJS backend running on port 3001 with real Firebase credentials in backend/.env?
          </div>
        )}

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading {meta.label.toLowerCase()} from Firestore and running the forecast model…</div>
        ) : list && (
          <div style={{ marginLeft: 5 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16, maxWidth: 900 }}>
              Real {meta.label.toLowerCase()} from the same Firestore collection Device Management reads and writes — no
              fabricated inventory. {hasRadar
                ? 'Forecasts are an ordinary-least-squares fit over manually-logged performance snapshots, extended forward.'
                : 'No live utilization telemetry is recorded for switches in Firestore yet, so risk here reflects age and reported status only.'} Risk
              scores blend age (estimated from each record’s creation date, since purchase date isn’t tracked on this
              collection), reported status{hasRadar ? ', current utilization and trend' : ''}. Nothing here is hand-tuned per device.
            </div>

            {list.length === 0 ? <EmptyNote text={`No ${meta.label.toLowerCase()} in Firestore yet — add some in Device Management first.`} /> : (
              <>
                {/* ── KPI row ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
                  <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RiskGauge value={avgRiskScore} bands={RISK_BANDS} />
                  </div>
                  <StatTile
                    label="Critical Assets" value={riskCounts.critical}
                    sub={`of ${list.length} ${meta.label.toLowerCase()}`}
                    color="var(--err)"
                  />
                  <StatTile
                    label={`${meta.label} Monitored`} value={list.length}
                    sub={`${riskCounts.warning} warning · ${riskCounts.healthy} healthy`}
                    color="var(--viz-series-1)"
                  />
                  {hasRadar ? (
                    <StatTile
                      label="Nearest Threshold Crossing"
                      value={alreadyCritical.length > 0 ? `${alreadyCritical.length} now` : forecastNear[0] ? `${forecastNear[0].days}d` : '—'}
                      sub={alreadyCritical.length > 0 ? `${alreadyCritical[0].name}${alreadyCritical.length > 1 ? ` +${alreadyCritical.length - 1} more` : ''} already critical` : forecastNear[0]?.name ?? 'None trending toward critical'}
                      color={alreadyCritical.length > 0 ? 'var(--err)' : forecastNear[0] ? forecastColor(forecastNear[0].days) : undefined}
                    />
                  ) : (
                    <StatTile
                      label="Offline / Critical" value={list.filter((d) => d.status === 'Offline' || d.status === 'Critical').length}
                      sub="By reported status"
                      color="var(--err)"
                    />
                  )}
                </div>

                {/* ── Risk distribution + top risks ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>Risk Distribution</h3></div>
                    <div className="card__body">
                      <DonutChart
                        centerLabel={String(list.length)}
                        data={[
                          { label: 'Critical', value: riskCounts.critical, color: 'var(--err)' },
                          { label: 'Warning', value: riskCounts.warning, color: 'var(--warn)' },
                          { label: 'Healthy', value: riskCounts.healthy, color: 'var(--ok)' },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="card">
                    <div className="card__head"><h3>Top Risks</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>Highest score first</span></div>
                    <div className="card__body">
                      <BarChart
                        labelWidth={140}
                        data={topRisks.map((r) => ({ label: r.name, value: r.riskScore, color: BAND_COLOR[r.riskBand] }))}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Fleet composition ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>Status Breakdown</h3></div>
                    <div className="card__body">
                      <BarChart labelWidth={110} data={statusBreakdown} />
                    </div>
                  </div>
                  <div className="card">
                    <div className="card__head"><h3>By {roleLabel}</h3></div>
                    <div className="card__body">
                      {roleBreakdown.length === 0 ? <EmptyNote text="No data yet." /> : <BarChart labelWidth={140} data={roleBreakdown} />}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>Age Distribution</h3></div>
                    <div className="card__body">
                      {ageDistribution.length === 0 ? <EmptyNote text="No age data yet." /> : <BarChart labelWidth={70} data={ageDistribution} />}
                    </div>
                  </div>
                  <div className="card">
                    <div className="card__head"><h3>Risk vs Age</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>Does risk track with age?</span></div>
                    <div className="card__body">
                      {riskAgePoints.length === 0 ? <EmptyNote text="No age data yet to correlate." /> : (
                        <ScatterChart points={riskAgePoints} xLabel="Age (years)" legend={BAND_LEGEND} />
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Primary-metric forecast ── */}
                {hasRadar && (
                  <div className="card" style={{ marginBottom: 22 }}>
                    <div className="card__head">
                      <h3>{meta.forecastTitle}</h3>
                      <span className="chip chip--plain" style={{ fontSize: 12 }}>{meta.forecastNote}, within a 1-year horizon</span>
                    </div>
                    <div className="card__body">
                      {alreadyCritical.length > 0 && (
                        <div style={{ marginBottom: forecastNear.length > 0 ? 18 : 0 }}>
                          <div style={{ fontSize: 11, letterSpacing: '.05em', color: 'var(--err)', fontWeight: 700, marginBottom: 8 }}>ALREADY PAST CRITICAL</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {alreadyCritical.map((f) => (
                              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'color-mix(in srgb, var(--err) 8%, transparent)', borderRadius: 6, fontSize: 12.5 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--err)', flexShrink: 0 }} />
                                <span style={{ flex: 1, color: 'var(--viz-text-primary)', fontWeight: 600 }}>{f.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {forecastNear.length === 0
                        ? (alreadyCritical.length === 0 && <EmptyNote text={`No ${meta.label.toLowerCase()} trending toward critical within a year (or not enough logged snapshots yet).`} />)
                        : (
                          <BarChart
                            valueFormatter={(v) => `${compactNumber(v)}d`}
                            labelWidth={140}
                            data={forecastNear.map((f) => ({ label: f.name, value: f.days, color: forecastColor(f.days) }))}
                          />
                        )}
                      {stableCount > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--viz-muted)', marginTop: 14 }}>
                          +{stableCount} trending flat — projected beyond a year out, not charted here.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Device snapshot (radar) ── */}
                {hasRadar && (
                  <div className="card" style={{ marginBottom: 22 }}>
                    <div className="card__head">
                      <h3>Device Snapshot</h3>
                      <span className="chip chip--plain" style={{ fontSize: 12 }}>Current values only — no history required</span>
                    </div>
                    <div className="card__body">
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
                        <select className="form-input" style={{ width: 'auto', minWidth: 220 }} value={selectedDevice?.id} onChange={(e) => setDeviceId(e.target.value)}>
                          {list.map((d) => <option key={d.id} value={d.id}>{d.name} — {d[meta.labelKey] || d.model}</option>)}
                        </select>
                        {selectedDevice && <BandChip band={selectedDevice.riskBand} />}
                      </div>

                      {selectedDevice && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
                          <RadarChart axes={meta.radarAxes(selectedDevice)} color={meta.radarColor} />
                          <div className="card" style={{ padding: 16, background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
                            <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700, marginBottom: 6 }}>RISK SCORE</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: BAND_COLOR[selectedDevice.riskBand] }}>{selectedDevice.riskScore}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 10, lineHeight: 1.5 }}>{selectedDevice.recommendation}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 12, borderTop: '1px solid var(--ink-200)', paddingTop: 10 }}>
                              <div>Age: {selectedDevice.ageYears != null ? `${selectedDevice.ageYears} yrs` : '—'}</div>
                              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>Status: <StatusChip status={selectedDevice.status} /></div>
                              <div style={{ marginTop: 4 }}>Location: {selectedDevice.location ?? '—'}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Full ranking table ── */}
                <div className="card">
                  <div className="card__head"><h3>{meta.label} — Full Ranking</h3></div>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>NAME</th>
                          <th>{meta.labelKey.toUpperCase()}</th>
                          <th>AGE</th>
                          <th>STATUS</th>
                          {category === 'servers' && <><th className="num">CPU</th><th className="num">RAM</th></>}
                          {category === 'storage' && <><th className="num">CAPACITY</th><th className="num">LATENCY</th></>}
                          {category === 'switches' && <th className="num">PORT UTIL</th>}
                          <th className="num">RISK</th>
                          <th>BAND</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((d) => (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 600 }}>{d.name}</td>
                            <td style={{ color: 'var(--ink-500)' }}>{d[meta.labelKey] || d.model || '—'}</td>
                            <td>{d.ageYears != null ? `${d.ageYears}yrs` : '—'}</td>
                            <td><StatusChip status={d.status} /></td>
                            {category === 'servers' && <>
                              <td className="num">{d.cpu.currentPct}%</td>
                              <td className="num">{d.ram.currentPct}%</td>
                            </>}
                            {category === 'storage' && <>
                              <td className="num">{d.capacity.currentPct}%</td>
                              <td className="num">{d.latency.currentPct}ms</td>
                            </>}
                            {category === 'switches' && <td className="num">{d.portUtilization ? `${d.portUtilization.currentPct}%` : '—'}</td>}
                            <td className="num" style={{ fontWeight: 700 }}>{d.riskScore}</td>
                            <td><BandChip band={d.riskBand} /></td>
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
