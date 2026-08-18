import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'

function ageYears(purchaseDate) {
  if (!purchaseDate) return null
  const ms = Date.now() - new Date(`${purchaseDate}T00:00:00`).getTime()
  return ms > 0 ? ms / (365.25 * 86400000) : null
}

function warrantyState(warrantyExpiry) {
  if (!warrantyExpiry) return 'unknown'
  const days = Math.round((new Date(`${warrantyExpiry}T00:00:00`).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'expired'
  if (days <= 90) return 'expiring'
  return 'active'
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.round((new Date(`${dateStr}T00:00:00`).getTime() - Date.now()) / 86400000)
}

// Real lifecycle stage counts — every bucket is derived from each item's
// own purchase/warranty/retired fields, not an assumed distribution.
function computeStageFlow(equipment) {
  const active = equipment.filter(e => e.status !== 'Retired')
  const retired = equipment.filter(e => e.status === 'Retired')
  return [
    { label: 'Under Warranty', count: active.filter(e => warrantyState(e.warrantyExpiry) === 'active').length, color: '#22c55e' },
    { label: 'Expiring Soon (≤90d)', count: active.filter(e => warrantyState(e.warrantyExpiry) === 'expiring').length, color: '#f59e0b' },
    { label: 'Warranty Expired', count: active.filter(e => warrantyState(e.warrantyExpiry) === 'expired').length, color: '#dc2626' },
    { label: 'No Warranty Data', count: active.filter(e => warrantyState(e.warrantyExpiry) === 'unknown').length, color: 'var(--ink-400)' },
    { label: 'Retired', count: retired.length, color: '#64748b' },
  ]
}

// Real replacements per quarter, from each retired item's actual retiredAt.
function computeReplacementsByQuarter(equipment, quarters = 6) {
  const retired = equipment.filter(e => e.status === 'Retired' && e.retiredAt?.toDate)
  const now = new Date()
  const buckets = []
  for (let i = quarters - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1)
    const qStartMonth = Math.floor(d.getMonth() / 3) * 3
    const qStart = new Date(d.getFullYear(), qStartMonth, 1)
    const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1)
    buckets.push({
      label: `Q${qStartMonth / 3 + 1} '${String(qStart.getFullYear()).slice(2)}`,
      start: qStart.getTime(), end: qEnd.getTime(), count: 0,
    })
  }
  retired.forEach(e => {
    const t = e.retiredAt.toDate().getTime()
    const bucket = buckets.find(b => t >= b.start && t < b.end)
    if (bucket) bucket.count++
  })
  return buckets
}

function computeCategoryAverageAge(equipment) {
  const categories = [...new Set(equipment.map(e => e.category).filter(Boolean))]
  return categories.map(cat => {
    const subset = equipment.filter(e => e.category === cat && e.status !== 'Retired' && ageYears(e.purchaseDate) != null)
    if (subset.length === 0) return null
    const avg = subset.reduce((s, e) => s + ageYears(e.purchaseDate), 0) / subset.length
    return { label: cat, years: Math.round(avg * 10) / 10, count: subset.length }
  }).filter(Boolean).sort((a, b) => b.years - a.years)
}

function computeOldestActive(equipment, n = 8) {
  return equipment
    .filter(e => e.status !== 'Retired' && ageYears(e.purchaseDate) != null)
    .map(e => ({ id: e.id, name: e.name, years: Math.round(ageYears(e.purchaseDate) * 10) / 10 }))
    .sort((a, b) => b.years - a.years)
    .slice(0, n)
}

function computeWarrantyWatchlist(equipment, n = 10) {
  return equipment
    .filter(e => e.status !== 'Retired' && ['expiring', 'expired'].includes(warrantyState(e.warrantyExpiry)))
    .map(e => ({ id: e.id, name: e.name, category: e.category, days: daysUntil(e.warrantyExpiry) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, n)
}

function computeFleetStats(equipment) {
  const active = equipment.filter(e => e.status !== 'Retired')
  const retired = equipment.filter(e => e.status === 'Retired')
  const ages = active.map(e => ageYears(e.purchaseDate)).filter(a => a != null)
  const avgAge = ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null
  const watchlistCount = active.filter(e => ['expiring', 'expired'].includes(warrantyState(e.warrantyExpiry))).length
  return { activeCount: active.length, retiredCount: retired.length, avgAge, watchlistCount }
}

function StatCard({ label, value, valueColor, sub }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--ink-500)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: valueColor || 'var(--ink-900)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function EmptyNote({ text }) {
  return <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>{text}</div>
}

function StageFlowBars({ data }) {
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 150, fontSize: 12, fontWeight: 600 }}>{d.label}</div>
          <div style={{ flex: 1, height: 16, background: 'var(--ink-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: d.color, borderRadius: 4 }} />
          </div>
          <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{d.count}</div>
        </div>
      ))}
    </div>
  )
}

function QuarterlyBars({ buckets }) {
  const max = Math.max(1, ...buckets.map(b => b.count))
  const total = buckets.reduce((s, b) => s + b.count, 0)
  if (total === 0) return <EmptyNote text="No equipment has been retired yet." />
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 140 }}>
      {buckets.map(b => (
        <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>{b.count}</div>
          <div style={{ width: '100%', maxWidth: 44, height: Math.max(3, (b.count / max) * 96), background: '#c2410c', borderRadius: '4px 4px 0 0' }} />
          <div style={{ fontSize: 10, color: 'var(--ink-500)' }}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

function AgeBars({ data, unit = 'yrs' }) {
  if (data.length === 0) return <EmptyNote text="No purchase-date data recorded yet." />
  const max = Math.max(1, ...data.map(d => d.years))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 130, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</div>
          <div style={{ flex: 1, height: 12, background: 'var(--ink-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.years / max) * 100}%`, background: '#4338ca', borderRadius: 4 }} />
          </div>
          <div style={{ width: 44, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{d.years}{unit}</div>
        </div>
      ))}
    </div>
  )
}

function OldestBars({ data }) {
  if (data.length === 0) return <EmptyNote text="No purchase-date data recorded yet." />
  const max = Math.max(1, ...data.map(d => d.years))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 150, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
          <div style={{ flex: 1, height: 14, background: 'var(--ink-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.years / max) * 100}%`, background: d.years > 5 ? '#dc2626' : '#0e7490', borderRadius: 4 }} />
          </div>
          <div style={{ width: 50, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{d.years}yrs</div>
        </div>
      ))}
    </div>
  )
}

export default function EquipmentLifecycle() {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'equipment'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setEquipment(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [])

  const stats = useMemo(() => computeFleetStats(equipment), [equipment])
  const stageFlow = useMemo(() => computeStageFlow(equipment), [equipment])
  const quarterlyReplacements = useMemo(() => computeReplacementsByQuarter(equipment, 6), [equipment])
  const categoryAges = useMemo(() => computeCategoryAverageAge(equipment), [equipment])
  const oldestActive = useMemo(() => computeOldestActive(equipment, 8), [equipment])
  const warrantyWatchlist = useMemo(() => computeWarrantyWatchlist(equipment, 10), [equipment])

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Equipment Lifecycle</span></div>
            <h1>Equipment Lifecycle</h1>
          </div>
        </div>

        {error && <div className="settings-error" style={{ marginBottom: 16, marginLeft: 5 }}>{error}</div>}

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading equipment lifecycle data…</div>
        ) : (
          <div style={{ marginLeft: 5 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16, maxWidth: 780 }}>
              Built from each equipment item's own purchase date, warranty expiry, and retirement fields — set them on Equipment Details to populate this page.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <StatCard label="ACTIVE EQUIPMENT" value={stats.activeCount} />
              <StatCard label="RETIRED" value={stats.retiredCount} sub="All-time" />
              <StatCard label="WARRANTY WATCHLIST" value={stats.watchlistCount} valueColor={stats.watchlistCount ? '#b45309' : undefined} sub="Expiring within 90 days or already expired" />
              <StatCard label="AVG FLEET AGE" value={stats.avgAge != null ? `${stats.avgAge}yrs` : '—'} sub="Active equipment with a recorded purchase date" />
            </div>

            <div className="card" style={{ padding: 20, marginBottom: 22 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Lifecycle Stage Flow</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Where every piece of equipment currently sits, from fresh warranty to retired</div>
              {equipment.length === 0 ? <EmptyNote text="No equipment yet." /> : <StageFlowBars data={stageFlow} />}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Replacements Per Quarter</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Equipment retired, by quarter, over the last 18 months</div>
                <QuarterlyBars buckets={quarterlyReplacements} />
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Average Age by Category</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Active equipment only</div>
                <AgeBars data={categoryAges} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Oldest Equipment Still in Service</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Candidates to plan for replacement</div>
                <OldestBars data={oldestActive} />
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Warranty Watchlist ({warrantyWatchlist.length})</div>
                {warrantyWatchlist.length === 0 ? (
                  <EmptyNote text="Nothing expiring soon." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {warrantyWatchlist.map(w => (
                      <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, border: '1px solid var(--ink-200)', borderRadius: 8, padding: '8px 12px', gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{w.name}</span>
                        <span style={{ color: 'var(--ink-500)' }}>{w.category || '—'}</span>
                        <span style={{ fontWeight: 700, color: w.days < 0 ? '#b91c1c' : '#b45309' }}>
                          {w.days < 0 ? `Expired ${Math.abs(w.days)}d ago` : `${w.days}d left`}
                        </span>
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
