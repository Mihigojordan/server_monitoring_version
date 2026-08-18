import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'

const DAY = 86400000

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']
const CATEGORIES = ['Technical', 'Billing', 'Access Request', 'Bug Report', 'Feature Request', 'Other']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const STATUS_COLOR = { Open: '#3b82f6', 'In Progress': '#f59e0b', Resolved: '#22c55e', Closed: 'var(--ink-400)' }
const CATEGORY_COLORS = ['#4338ca', '#0e7490', '#7c3aed', '#c2410c', '#a21caf', '#15803d']
function categoryColor(c) {
  const i = CATEGORIES.indexOf(c)
  return i >= 0 ? CATEGORY_COLORS[i] : '#475569'
}
const PRIORITY_COLOR = { Low: 'var(--ink-400)', Medium: '#3b82f6', High: '#f59e0b', Critical: '#dc2626' }

// Legacy tickets predate the status/category/priority workflow — normalize
// them into the current enum rather than dropping or guessing their history.
function normalizeStatus(status) {
  return STATUSES.includes(status) ? status : 'Open'
}
function normalizeCategory(category) {
  return CATEGORIES.includes(category) ? category : 'Other'
}
function normalizePriority(priority) {
  return PRIORITIES.includes(priority) ? priority : 'Medium'
}

function formatDate(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

// Real per-day ticket submissions + running cumulative total, built from
// each ticket's actual createdAt — not a fabricated growth curve.
function growthSeries(tickets, days = 30) {
  const now = Date.now()
  const dayStart = now - (days - 1) * DAY
  const addedAt = t => t.createdAt?.toDate?.().getTime()
  let running = tickets.filter(t => addedAt(t) && addedAt(t) < dayStart).length
  const points = []
  for (let i = 0; i < days; i++) {
    const dayFloor = dayStart + i * DAY
    const dayCeil = dayFloor + DAY
    const added = tickets.filter(t => { const ts = addedAt(t); return ts && ts >= dayFloor && ts < dayCeil }).length
    running += added
    points.push({
      added,
      cumulative: running,
      label: new Date(dayFloor).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })
  }
  return points
}

// Combo chart: bars = tickets submitted that day, line = cumulative running total.
function GrowthChart({ points }) {
  const w = 960
  const h = 260
  const padL = 34
  const padR = 12
  const padT = 16
  const padB = 30
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const barAreaH = plotH * 0.55
  const barMax = Math.max(1, ...points.map(p => p.added))
  const cumMax = Math.max(1, ...points.map(p => p.cumulative))
  const slot = points.length > 0 ? plotW / points.length : plotW
  const barW = Math.max(2, slot * 0.5)
  const coords = points.map((p, i) => {
    const xCenter = padL + slot * i + slot / 2
    const barH = (p.added / barMax) * barAreaH
    return {
      ...p,
      xCenter,
      barX: xCenter - barW / 2,
      barY: padT + plotH - barH,
      barH,
      lineY: padT + plotH - (p.cumulative / cumMax) * plotH,
    }
  })
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.xCenter.toFixed(1)},${c.lineY.toFixed(1)}`).join(' ')
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
  const labelStep = Math.ceil(points.length / 7)
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      {gridLines.map(g => {
        const y = padT + plotH - g * plotH
        return (
          <g key={g}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--ink-100)" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--ink-500)">{Math.round(g * cumMax)}</text>
          </g>
        )
      })}
      {coords.map((c, i) => (
        <rect key={`bar-${i}`} x={c.barX} y={c.barY} width={barW} height={Math.max(c.barH, 0)} rx="2" fill="#93c5fd" />
      ))}
      <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <g key={`pt-${i}`}>
          {i % labelStep === 0 && (
            <text x={c.xCenter} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--ink-500)">{c.label}</text>
          )}
          {i === coords.length - 1 && <circle cx={c.xCenter} cy={c.lineY} r="4" fill="#2563EB" />}
        </g>
      ))}
    </svg>
  )
}

function computeCategoryBreakdown(tickets) {
  return CATEGORIES.map(c => ({ type: c, count: tickets.filter(t => t.category === c).length, color: categoryColor(c) }))
    .filter(c => c.count > 0)
}

function DonutChart({ data, total, unit }) {
  const size = 140
  const r = 52
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const segments = data.reduce((acc, d) => {
    const frac = total ? d.count / total : 0
    const dash = frac * circumference
    const prevOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0
    acc.push({ type: d.type, color: d.color, dash, offset: prevOffset })
    return acc
  }, [])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink-100)" strokeWidth="16" />
      {segments.map(s => (
        <circle
          key={s.type}
          cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="16"
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--ink-900)">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--ink-500)">{unit}</text>
    </svg>
  )
}

function computePriorityBreakdown(tickets) {
  return PRIORITIES.map(p => ({ priority: p, count: tickets.filter(t => t.priority === p).length }))
}

function PriorityBars({ data }) {
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map(d => (
        <div key={d.priority} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 70, fontSize: 12, fontWeight: 600 }}>{d.priority}</div>
          <div style={{ flex: 1, height: 14, background: 'var(--ink-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: PRIORITY_COLOR[d.priority], borderRadius: 4 }} />
          </div>
          <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{d.count}</div>
        </div>
      ))}
    </div>
  )
}

function computeStatusBreakdown(tickets) {
  return STATUSES.map(s => ({ status: s, count: tickets.filter(t => t.status === s).length }))
}

function StatusStackedBar({ data, total }) {
  return (
    <div>
      <div style={{ height: 20, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'var(--ink-100)', marginBottom: 14 }}>
        {total > 0 && data.map(d => (
          d.count > 0 && <div key={d.status} style={{ width: `${(d.count / total) * 100}%`, background: STATUS_COLOR[d.status] }} title={`${d.status}: ${d.count}`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map(d => (
          <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[d.status], flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--ink-700)' }}>{d.status}</span>
            <span style={{ fontWeight: 700 }}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Real backlog aging — how long each currently-open/in-progress ticket has
// been waiting, bucketed from its actual createdAt.
function computeBacklogAging(tickets) {
  const now = Date.now()
  const buckets = [
    { label: '0-1 day', min: 0, max: 1, count: 0 },
    { label: '1-3 days', min: 1, max: 3, count: 0 },
    { label: '3-7 days', min: 3, max: 7, count: 0 },
    { label: '7+ days', min: 7, max: Infinity, count: 0 },
  ]
  tickets
    .filter(t => t.status === 'Open' || t.status === 'In Progress')
    .forEach(t => {
      const created = t.createdAt?.toDate?.().getTime()
      if (!created) return
      const ageDays = (now - created) / DAY
      const bucket = buckets.find(b => ageDays >= b.min && ageDays < b.max) || buckets[buckets.length - 1]
      bucket.count++
    })
  return buckets
}

function BacklogBars({ data }) {
  const max = Math.max(1, ...data.map(d => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) {
    return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No open backlog right now.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 80, fontSize: 12, fontWeight: 600 }}>{d.label}</div>
          <div style={{ flex: 1, height: 14, background: 'var(--ink-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: d.label === '7+ days' ? '#dc2626' : d.label === '3-7 days' ? '#f59e0b' : '#2563EB', borderRadius: 4 }} />
          </div>
          <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{d.count}</div>
        </div>
      ))}
    </div>
  )
}

function computeTopSubmitters(tickets, n = 8) {
  const counts = {}
  tickets.forEach(t => { const name = t.createdBy || 'Unknown'; counts[name] = (counts[name] || 0) + 1 })
  return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, n)
}

function SubmitterBars({ data }) {
  if (data.length === 0) {
    return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No tickets yet.</div>
  }
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 140, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
          <div style={{ flex: 1, height: 14, background: 'var(--ink-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: '#7c3aed', borderRadius: 4 }} />
          </div>
          <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{d.count}</div>
        </div>
      ))}
    </div>
  )
}

// Real resolution time per resolved ticket — resolvedAt minus createdAt.
// Tickets without a resolvedAt (never closed) are excluded, not estimated.
function computeResolutionTimes(tickets) {
  return tickets
    .filter(t => (t.status === 'Resolved' || t.status === 'Closed') && t.resolvedAt?.toDate && t.createdAt?.toDate)
    .map(t => Math.max(0, (t.resolvedAt.toDate().getTime() - t.createdAt.toDate().getTime()) / DAY))
}

function avgResolutionDays(tickets) {
  const times = computeResolutionTimes(tickets)
  if (times.length === 0) return null
  return Math.round((times.reduce((s, x) => s + x, 0) / times.length) * 10) / 10
}

export default function SupportUtilization() {
  const [rawTickets, setRawTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setRawTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [])

  const tickets = useMemo(() => rawTickets.map(t => ({
    ...t,
    status: normalizeStatus(t.status),
    category: normalizeCategory(t.category),
    priority: normalizePriority(t.priority),
  })), [rawTickets])

  const counts = useMemo(() => ({
    total: tickets.length,
    active: tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
  }), [tickets])

  const growth = useMemo(() => growthSeries(tickets, 30), [tickets])
  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(tickets), [tickets])
  const priorityBreakdown = useMemo(() => computePriorityBreakdown(tickets), [tickets])
  const statusBreakdown = useMemo(() => computeStatusBreakdown(tickets), [tickets])
  const backlogAging = useMemo(() => computeBacklogAging(tickets), [tickets])
  const topSubmitters = useMemo(() => computeTopSubmitters(tickets, 8), [tickets])
  const avgResolution = useMemo(() => avgResolutionDays(tickets), [tickets])
  const oldestOpen = useMemo(() => {
    const openTickets = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress')
    if (openTickets.length === 0) return null
    return [...openTickets].sort((a, b) => (a.createdAt?.toDate?.().getTime() || 0) - (b.createdAt?.toDate?.().getTime() || 0))[0]
  }, [tickets])

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Support Utilization</span></div>
            <h1>Support Utilization</h1>
          </div>
        </div>

        {error && <div className="settings-error" style={{ marginBottom: 16, marginLeft: 5 }}>{error}</div>}

        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)', marginLeft: 5 }}>Loading support tickets…</div>
        ) : (
          <div style={{ marginLeft: 5 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
              <StatCard label="TOTAL TICKETS" value={counts.total} sub="All time" />
              <StatCard label="ACTIVE" value={counts.active} valueColor={counts.active ? '#1d4ed8' : undefined} sub="Open + In Progress" />
              <StatCard label="RESOLVED / CLOSED" value={counts.resolved} valueColor="#15803d" sub={counts.total ? `${Math.round((counts.resolved / counts.total) * 100)}% of total` : '—'} />
              <StatCard label="AVG RESOLUTION TIME" value={avgResolution != null ? `${avgResolution}d` : '—'} sub={avgResolution != null ? 'From open to resolved/closed' : 'No resolved tickets yet'} />
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 22 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Ticket Volume</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10 }}>Tickets submitted per day (bars) and cumulative total (line) over the last 30 days</div>
              {tickets.length === 0 ? (
                <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No tickets yet.</div>
              ) : (
                <GrowthChart points={growth} />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Tickets by Category</div>
                {categoryBreakdown.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No tickets yet.</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                    <DonutChart data={categoryBreakdown} total={counts.total} unit="tickets" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {categoryBreakdown.map(c => (
                        <div key={c.type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: 'var(--ink-700)' }}>{c.type}</span>
                          <span style={{ fontWeight: 700 }}>{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Tickets by Priority</div>
                <PriorityBars data={priorityBreakdown} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Status Breakdown</div>
                <StatusStackedBar data={statusBreakdown} total={counts.total} />
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Backlog Aging</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>
                  How long currently open/in-progress tickets have been waiting
                  {oldestOpen && ` — oldest is "${oldestOpen.subject}" since ${formatDate(oldestOpen.createdAt)}`}
                </div>
                <BacklogBars data={backlogAging} />
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Top Submitters</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Who's filing the most support tickets</div>
              <SubmitterBars data={topSubmitters} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
