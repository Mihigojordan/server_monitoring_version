import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'

const DOMAIN_COLORS = { Equipment: '#4338ca', Servers: '#2563EB', Storage: '#0e7490', Network: '#a21caf' }
const CATEGORY_COLORS = ['#4338ca', '#0e7490', '#7c3aed', '#c2410c', '#a21caf', '#15803d']

function cost(x) {
  return Number(x.purchaseCost) || 0
}

function formatUsd(n) {
  return `$${Math.round(n).toLocaleString()}`
}

function computeValueBySystem(equipment, servers, storageVolumes, networkDevices) {
  const activeEquip = equipment.filter(e => e.status !== 'Retired')
  return [
    { label: 'Equipment', value: activeEquip.reduce((s, e) => s + cost(e), 0), color: DOMAIN_COLORS.Equipment },
    { label: 'Servers', value: servers.reduce((s, x) => s + cost(x), 0), color: DOMAIN_COLORS.Servers },
    { label: 'Storage', value: storageVolumes.reduce((s, x) => s + cost(x), 0), color: DOMAIN_COLORS.Storage },
    { label: 'Network', value: networkDevices.reduce((s, x) => s + cost(x), 0), color: DOMAIN_COLORS.Network },
  ]
}

function computeCategoryValue(equipment) {
  const active = equipment.filter(e => e.status !== 'Retired' && cost(e) > 0)
  const categories = [...new Set(active.map(e => e.category).filter(Boolean))]
  return categories
    .map(cat => ({ label: cat, value: active.filter(e => e.category === cat).reduce((s, e) => s + cost(e), 0) }))
    .sort((a, b) => b.value - a.value)
}

function computeTopAssets(equipment, servers, storageVolumes, networkDevices, n = 10) {
  const all = [
    ...equipment.filter(e => e.status !== 'Retired').map(e => ({ id: e.id, name: e.name, domain: 'Equipment', value: cost(e) })),
    ...servers.map(s => ({ id: s.id, name: s.name, domain: 'Servers', value: cost(s) })),
    ...storageVolumes.map(v => ({ id: v.id, name: v.name, domain: 'Storage', value: cost(v) })),
    ...networkDevices.map(d => ({ id: d.id, name: d.name, domain: 'Network', value: cost(d) })),
  ]
  return all.filter(a => a.value > 0).sort((a, b) => b.value - a.value).slice(0, n)
}

// Real acquisition timeline — one point per actual purchase event (from
// each asset's own purchaseDate or, where that field doesn't exist yet,
// its createdAt as the closest real proxy). Not a fabricated spend curve.
function computeCumulativeSpend(equipment, servers, storageVolumes, networkDevices) {
  const events = []
  equipment.forEach(e => {
    const c = cost(e)
    if (c <= 0) return
    const dateMs = e.purchaseDate ? new Date(`${e.purchaseDate}T00:00:00`).getTime() : e.createdAt?.toDate?.().getTime()
    if (dateMs) events.push({ dateMs, cost: c })
  })
  ;[servers, storageVolumes, networkDevices].forEach(list => {
    list.forEach(x => {
      const c = cost(x)
      if (c <= 0) return
      const dateMs = x.createdAt?.toDate?.().getTime()
      if (dateMs) events.push({ dateMs, cost: c })
    })
  })
  events.sort((a, b) => a.dateMs - b.dateMs)
  let running = 0
  return events.map(e => {
    running += e.cost
    return { dateMs: e.dateMs, cumulative: running, label: new Date(e.dateMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) }
  })
}

// Disclosed straight-line depreciation — 5-year useful life, 20% residual
// floor. An estimate built from real cost + purchase date, not a
// fabricated valuation.
const USEFUL_LIFE_YEARS = 5
const RESIDUAL_FLOOR = 0.2
function bookValue(assetCost, purchaseDate) {
  if (!purchaseDate || !assetCost) return assetCost || 0
  const years = (Date.now() - new Date(`${purchaseDate}T00:00:00`).getTime()) / (365.25 * 86400000)
  const fractionRemaining = Math.max(RESIDUAL_FLOOR, 1 - (years / USEFUL_LIFE_YEARS) * (1 - RESIDUAL_FLOOR))
  return Math.round(assetCost * fractionRemaining)
}

function computeEquipmentDepreciation(equipment, n = 6) {
  return equipment
    .filter(e => e.status !== 'Retired' && cost(e) > 0 && e.purchaseDate)
    .map(e => ({ id: e.id, name: e.name, cost: cost(e), book: bookValue(cost(e), e.purchaseDate) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, n)
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

function ValueDonut({ data, total }) {
  const size = 150
  const r = 55
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const segments = data.filter(d => d.value > 0).reduce((acc, d) => {
    const frac = total ? d.value / total : 0
    const dash = frac * circumference
    const prevOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0
    acc.push({ ...d, dash, offset: prevOffset })
    return acc
  }, [])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink-100)" strokeWidth="18" />
      {segments.map(s => (
        <circle
          key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="18"
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--ink-900)">{formatUsd(total)}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="var(--ink-500)">total value</text>
    </svg>
  )
}

function CategoryBars({ data }) {
  if (data.length === 0) return <EmptyNote text="No priced equipment yet." />
  const w = Math.max(320, data.length * 100)
  const h = 190
  const padT = 22
  const padB = 30
  const plotH = h - padT - padB
  const max = Math.max(1, ...data.map(d => d.value))
  const slot = w / data.length
  const barW = Math.max(24, slot * 0.5)
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const barH = (d.value / max) * plotH
          const x = i * slot + (slot - barW) / 2
          const y = padT + plotH - barH
          const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length]
          const label = d.label.length > 13 ? `${d.label.slice(0, 12)}…` : d.label
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barW} height={barH} rx="4" fill={color} />
              <text x={x + barW / 2} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink-900)">{formatUsd(d.value)}</text>
              <text x={x + barW / 2} y={h - 10} textAnchor="middle" fontSize="10" fill="var(--ink-500)">{label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TopAssetsBars({ data }) {
  if (data.length === 0) return <EmptyNote text="No priced assets yet." />
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={`${d.domain}-${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
            <div style={{ fontSize: 10.5, color: DOMAIN_COLORS[d.domain] }}>{d.domain}</div>
          </div>
          <div style={{ flex: 1, height: 14, background: 'var(--ink-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.value / max) * 100}%`, background: DOMAIN_COLORS[d.domain], borderRadius: 4 }} />
          </div>
          <div style={{ width: 80, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{formatUsd(d.value)}</div>
        </div>
      ))}
    </div>
  )
}

// The one line chart on this page — cumulative spend over time is exactly
// what a line is for. Every point is a real acquisition event.
function SpendTrendChart({ points }) {
  if (points.length === 0) return <EmptyNote text="No priced assets with a known acquisition date yet." />
  const w = 900
  const h = 220
  const padL = 60
  const padR = 12
  const padT = 16
  const padB = 30
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const minDate = points[0].dateMs
  const maxDate = points[points.length - 1].dateMs
  const range = Math.max(1, maxDate - minDate)
  const maxVal = Math.max(1, ...points.map(p => p.cumulative))
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
  const coords = points.map(p => ({
    x: padL + ((p.dateMs - minDate) / range) * plotW,
    y: padT + plotH - (p.cumulative / maxVal) * plotH,
    ...p,
  }))
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const labelStep = Math.max(1, Math.ceil(coords.length / 6))
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      {gridLines.map(g => {
        const y = padT + plotH - g * plotH
        return (
          <g key={g}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--ink-100)" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--ink-500)">{formatUsd(g * maxVal)}</text>
          </g>
        )
      })}
      <path d={path} fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <g key={i}>
          {i % labelStep === 0 && <text x={c.x} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--ink-500)">{c.label}</text>}
          {i === coords.length - 1 && <circle cx={c.x} cy={c.y} r="4" fill="#15803d" />}
        </g>
      ))}
    </svg>
  )
}

function DepreciationBars({ data }) {
  if (data.length === 0) return <EmptyNote text="No equipment has both a purchase date and cost recorded yet." />
  const w = Math.max(360, data.length * 110)
  const h = 200
  const padL = 50
  const padR = 12
  const padT = 10
  const padB = 34
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const max = Math.max(1, ...data.map(d => d.cost))
  const perGroupW = plotW / data.length
  const barGap = 5
  const barW = Math.max(8, (perGroupW - barGap * 3) / 2)
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 11.5, color: 'var(--ink-500)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ink-300)' }} />Original Cost</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#4338ca' }} />Est. Book Value</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
          {gridLines.map(g => {
            const y = padT + plotH - g * plotH
            return (
              <g key={g}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--ink-100)" strokeWidth="1" />
                <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--ink-500)">{formatUsd(g * max)}</text>
              </g>
            )
          })}
          {data.map((d, gi) => {
            const groupX = padL + gi * perGroupW
            const costH = (d.cost / max) * plotH
            const bookH = (d.book / max) * plotH
            const label = d.name.length > 12 ? `${d.name.slice(0, 11)}…` : d.name
            return (
              <g key={d.id}>
                <rect x={groupX + barGap} y={padT + plotH - costH} width={barW} height={costH} rx="2" fill="var(--ink-300)" />
                <rect x={groupX + barGap * 2 + barW} y={padT + plotH - bookH} width={barW} height={bookH} rx="2" fill="#4338ca" />
                <text x={groupX + perGroupW / 2} y={h - 12} textAnchor="middle" fontSize="10.5" fill="var(--ink-500)">{label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default function CostReporting() {
  const [equipment, setEquipment] = useState([])
  const [servers, setServers] = useState([])
  const [storageVolumes, setStorageVolumes] = useState([])
  const [networkDevices, setNetworkDevices] = useState([])
  const [error, setError] = useState(null)

  const [eqReady, setEqReady] = useState(false)
  const [srvReady, setSrvReady] = useState(false)
  const [stgReady, setStgReady] = useState(false)
  const [netReady, setNetReady] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'equipment'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => { setEquipment(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setEqReady(true) }, err => { setError(err.message); setEqReady(true) })
    return unsub
  }, [])
  useEffect(() => {
    const q = query(collection(db, 'servers'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => { setServers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setSrvReady(true) }, err => { setError(err.message); setSrvReady(true) })
    return unsub
  }, [])
  useEffect(() => {
    const q = query(collection(db, 'storageVolumes'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => { setStorageVolumes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setStgReady(true) }, err => { setError(err.message); setStgReady(true) })
    return unsub
  }, [])
  useEffect(() => {
    const q = query(collection(db, 'networkDevices'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => { setNetworkDevices(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setNetReady(true) }, err => { setError(err.message); setNetReady(true) })
    return unsub
  }, [])

  const loading = !(eqReady && srvReady && stgReady && netReady)

  const valueBySystem = useMemo(() => computeValueBySystem(equipment, servers, storageVolumes, networkDevices), [equipment, servers, storageVolumes, networkDevices])
  const totalValue = useMemo(() => valueBySystem.reduce((s, d) => s + d.value, 0), [valueBySystem])
  const categoryValue = useMemo(() => computeCategoryValue(equipment), [equipment])
  const topAssets = useMemo(() => computeTopAssets(equipment, servers, storageVolumes, networkDevices, 10), [equipment, servers, storageVolumes, networkDevices])
  const spendTrend = useMemo(() => computeCumulativeSpend(equipment, servers, storageVolumes, networkDevices), [equipment, servers, storageVolumes, networkDevices])
  const depreciation = useMemo(() => computeEquipmentDepreciation(equipment, 6), [equipment])

  const allPriced = useMemo(() => computeTopAssets(equipment, servers, storageVolumes, networkDevices, 100000), [equipment, servers, storageVolumes, networkDevices])
  const avgCost = allPriced.length ? totalValue / allPriced.length : null
  const totalOriginalCost = useMemo(() => depreciation.reduce((s, d) => s + d.cost, 0), [depreciation])
  const totalBookValue = useMemo(() => depreciation.reduce((s, d) => s + d.book, 0), [depreciation])

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Cost & TCO Reporting</span></div>
            <h1>Cost & TCO Reporting</h1>
          </div>
        </div>

        {error && <div className="settings-error" style={{ marginBottom: 16, marginLeft: 5 }}>{error}</div>}

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading cost data…</div>
        ) : (
          <div style={{ marginLeft: 5 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16, maxWidth: 780 }}>
              Built from each asset's own recorded Purchase Cost across Equipment, Servers, Storage, and Network. Equipment book value below is a disclosed straight-line estimate (5-year useful life, 20% residual floor) — not a fabricated valuation.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <StatCard label="TOTAL INFRASTRUCTURE VALUE" value={formatUsd(totalValue)} sub={`Across ${allPriced.length} priced assets`} />
              <StatCard label="AVG COST PER ASSET" value={avgCost != null ? formatUsd(avgCost) : '—'} />
              <StatCard label="EQUIPMENT ORIGINAL COST" value={formatUsd(totalOriginalCost)} sub={`${depreciation.length} equipment items with cost + purchase date`} />
              <StatCard label="EQUIPMENT EST. BOOK VALUE" value={formatUsd(totalBookValue)} valueColor="#4338ca" sub={totalOriginalCost ? `${Math.round((totalBookValue / totalOriginalCost) * 100)}% of original cost` : undefined} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Infrastructure Value by System</div>
                {totalValue === 0 ? <EmptyNote text="No priced assets yet." /> : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                    <ValueDonut data={valueBySystem} total={totalValue} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {valueBySystem.map(d => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: 'var(--ink-700)' }}>{d.label}</span>
                          <span style={{ fontWeight: 700 }}>{formatUsd(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Value by Equipment Category</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Active equipment only</div>
                <CategoryBars data={categoryValue} />
              </div>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 22 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Cumulative Spend Over Time</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10 }}>One point per real acquisition (purchase date where recorded, otherwise the record's created date)</div>
              <SpendTrendChart points={spendTrend} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Top 10 Highest-Value Assets</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Across all systems</div>
                <TopAssetsBars data={topAssets} />
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Equipment: Cost vs Book Value</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Top 6 by original cost — estimated depreciation shown transparently</div>
                <DepreciationBars data={depreciation} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
