import { useState, useEffect, useMemo } from 'react'
import AppShell from '../../components/layout/AppShell'
import StatTile from '../../components/charts/StatTile'
import DonutChart from '../../components/charts/DonutChart'
import BarChart from '../../components/charts/BarChart'
import RiskGauge from '../../components/charts/RiskGauge'
import TimelineDotChart from '../../components/charts/TimelineDotChart'

const BAND_COLOR = { critical: 'var(--err)', warning: 'var(--warn)', healthy: 'var(--ok)' }
const BAND_LABEL = { critical: 'Critical', warning: 'Warning', healthy: 'Healthy' }
const RISK_BANDS = { critical: 70, warning: 40 }
const WARRANTY_LABEL = { expired: 'Expired', expiring: 'Expiring ≤ 90d', active: 'Active', unknown: 'Unknown' }
const WARRANTY_COLOR = { expired: 'var(--err)', expiring: 'var(--warn)', active: 'var(--ok)', unknown: 'var(--viz-muted)' }
const HORIZON_DAYS = 365

const CATEGORICAL_COLORS = [
  'var(--viz-series-1)', 'var(--viz-series-2)', 'var(--viz-series-3)', 'var(--viz-series-4)',
  'var(--viz-series-5)', 'var(--viz-series-6)', 'var(--viz-series-7)', 'var(--viz-series-8)',
]

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

function WarrantyChip({ state }) {
  return (
    <span style={{ background: `color-mix(in srgb, ${WARRANTY_COLOR[state]} 16%, transparent)`, color: WARRANTY_COLOR[state], padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {WARRANTY_LABEL[state]}
    </span>
  )
}

function groupCount(list, keyFn) {
  const counts = {}
  list.forEach((d) => {
    const k = keyFn(d) || 'Uncategorized'
    counts[k] = (counts[k] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  return res.json()
}

export default function PredictiveMaintenance() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchJson('/infra/analytics/equipment-risk')
      .then((data) => { if (!cancelled) { setReport(data); setError(null) } })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const items = useMemo(() => report?.items ?? [], [report])

  const warrantyAll = useMemo(() => (
    items
      .filter((i) => i.daysUntilWarrantyExpiry != null)
      .map((i) => ({ id: i.id, name: i.name, days: i.daysUntilWarrantyExpiry }))
      .sort((a, b) => a.days - b.days)
  ), [items])
  const expiryColor = (days) => (days < 30 ? 'var(--err)' : days < 90 ? 'var(--warn)' : 'var(--ok)')
  const warrantyChartable = warrantyAll.filter((w) => w.days <= HORIZON_DAYS)
  const stableCount = warrantyAll.filter((w) => w.days > HORIZON_DAYS).length
  const unknownCount = items.length - warrantyAll.length
  const timelineAxisStart = warrantyChartable.length
    ? Math.max(-180, Math.min(-14, Math.min(...warrantyChartable.map((w) => w.days)) - 5))
    : -30

  const categoryBreakdown = useMemo(() => (
    groupCount(items, (i) => i.category).map(([label, value], idx) => ({ label, value, color: CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length] }))
  ), [items])

  const topRisks = useMemo(() => [...items].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8), [items])

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Predictive Maintenance</span></div>
            <h1>Predictive Maintenance</h1>
          </div>
        </div>

        {error && (
          <div className="settings-error" style={{ marginBottom: 16, marginLeft: 5 }}>
            Could not reach the predictive-maintenance backend ({error}). Is the NestJS backend running on port 3001 with real Firebase credentials in backend/.env?
          </div>
        )}

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading equipment lifecycle data from Firestore…</div>
        ) : report && (
          <div style={{ marginLeft: 5 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16, maxWidth: 900 }}>
              Real equipment from the Firestore <code>equipment</code> collection — purchase date, warranty expiry and cost as
              recorded, not fabricated. Distinct from Predictive Analytics (which trends live server/storage/switch metrics):
              this is about hardware lifecycle — when equipment ages out or its warranty runs out, so replacement and renewal
              can be planned ahead of time. Retired equipment is excluded.
            </div>

            {items.length === 0 ? <EmptyNote text="No active equipment in Firestore yet." /> : (
              <>
                {/* ── KPI row ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
                  <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RiskGauge value={report.fleet.avgRiskScore} bands={RISK_BANDS} />
                  </div>
                  <StatTile label="Active Equipment" value={report.fleet.activeCount} color="var(--viz-series-1)" />
                  <StatTile label="Critical" value={report.fleet.criticalCount} sub="Risk score ≥ 70" color="var(--err)" />
                  <StatTile
                    label="Expiring / Expired"
                    value={warrantyAll.filter((w) => w.days <= 90).length}
                    sub="Warranty within 90 days or past"
                    color="var(--err)"
                  />
                </div>

                {/* ── Risk distribution + top risks ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
                  <div className="card">
                    <div className="card__head"><h3>Risk Distribution</h3></div>
                    <div className="card__body">
                      <DonutChart
                        centerLabel={String(items.length)}
                        data={[
                          { label: 'Critical', value: report.fleet.criticalCount, color: 'var(--err)' },
                          { label: 'Warning', value: report.fleet.warningCount, color: 'var(--warn)' },
                          { label: 'Healthy', value: report.fleet.healthyCount, color: 'var(--ok)' },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="card">
                    <div className="card__head"><h3>Top Risks</h3><span className="chip chip--plain" style={{ fontSize: 12 }}>Highest score first</span></div>
                    <div className="card__body">
                      <BarChart
                        labelWidth={160}
                        data={topRisks.map((r) => ({ label: r.name, value: r.riskScore, color: BAND_COLOR[r.riskBand] }))}
                      />
                    </div>
                  </div>
                </div>

                {/* ── By category ── */}
                <div className="card" style={{ marginBottom: 22 }}>
                  <div className="card__head"><h3>By Category</h3></div>
                  <div className="card__body">
                    {categoryBreakdown.length === 0 ? <EmptyNote text="No category data yet." /> : <BarChart labelWidth={140} data={categoryBreakdown} />}
                  </div>
                </div>

                {/* ── Warranty expiry timeline ── */}
                <div className="card" style={{ marginBottom: 22 }}>
                  <div className="card__head">
                    <h3>Warranty Expiry Timeline</h3>
                    <span className="chip chip--plain" style={{ fontSize: 12 }}>Days until warranty expiry, within a 1-year horizon</span>
                  </div>
                  <div className="card__body">
                    {warrantyChartable.length === 0 ? <EmptyNote text="No equipment warranty expiring within a year." /> : (
                      <TimelineDotChart
                        items={warrantyChartable.map((w) => ({ id: w.id, label: w.name, days: w.days, color: expiryColor(w.days) }))}
                        axisStartDays={timelineAxisStart}
                        axisEndDays={HORIZON_DAYS}
                        legend={[
                          { label: '< 30 days / expired', color: 'var(--err)' },
                          { label: '< 90 days', color: 'var(--warn)' },
                          { label: 'Healthy', color: 'var(--ok)' },
                        ]}
                      />
                    )}
                    {(stableCount > 0 || unknownCount > 0) && (
                      <div style={{ fontSize: 12, color: 'var(--viz-muted)', marginTop: 14 }}>
                        {stableCount > 0 && <>+{stableCount} with warranty beyond a year out, not charted here.</>}
                        {stableCount > 0 && unknownCount > 0 && ' '}
                        {unknownCount > 0 && <>+{unknownCount} with no warranty date recorded.</>}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Full ranking table ── */}
                <div className="card">
                  <div className="card__head"><h3>Equipment — Full Ranking</h3></div>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>NAME</th>
                          <th>CATEGORY</th>
                          <th>AGE</th>
                          <th>WARRANTY EXPIRY</th>
                          <th>WARRANTY</th>
                          <th className="num">RISK</th>
                          <th>BAND</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.id}>
                            <td style={{ fontWeight: 600 }}>{i.name}</td>
                            <td style={{ color: 'var(--ink-500)' }}>{i.category ?? '—'}</td>
                            <td>{i.ageYears != null ? `${i.ageYears}yrs` : '—'}</td>
                            <td>{i.warrantyExpiry ?? '—'}</td>
                            <td><WarrantyChip state={i.warrantyState} /></td>
                            <td className="num" style={{ fontWeight: 700 }}>{i.riskScore}</td>
                            <td><BandChip band={i.riskBand} /></td>
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
