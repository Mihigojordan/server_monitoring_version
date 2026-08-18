import { useState, useEffect, useMemo } from 'react'
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { useApp } from '../../context/AppContext'
import { getLog } from '../../hooks/useActivityLog'

const DAY = 86400000

const ACTION_TYPE_COLORS = { Create: '#22c55e', Update: '#2563EB', Delete: '#ef4444', Export: '#a21caf', Import: '#f59e0b', Submit: '#0e7490', Other: 'var(--ink-400)' }
const CATEGORY_COLORS = ['#4338ca', '#0e7490', '#7c3aed', '#c2410c', '#a21caf', '#15803d', '#b45309', '#0369a1', '#be185d']

const CHECKLIST_ITEMS = [
  { id: 'user-access-review', label: 'Review active user accounts and roles for least-privilege access' },
  { id: 'orphaned-admins', label: 'Confirm no orphaned or unused admin accounts remain' },
  { id: 'firestore-rules', label: 'Verify Firestore security rules are not running in open/test mode' },
  { id: 'ticket-escalations', label: 'Review support ticket escalations for unresolved security issues' },
  { id: 'backup-verification', label: 'Confirm backup jobs completed successfully this period' },
  { id: 'warranty-review', label: 'Review equipment nearing warranty expiration for replacement planning' },
  { id: 'destructive-audit', label: 'Audit recent destructive actions (deletes/clears) for legitimacy' },
  { id: 'after-hours-review', label: 'Confirm after-hours activity aligns with expected maintenance windows' },
]

function actionVerb(action) {
  if (!action) return 'Other'
  if (/^(CREATE|ADD|LOG_)/.test(action)) return 'Create'
  if (/^UPDATE/.test(action)) return 'Update'
  if (/^(DELETE|CLEAR)/.test(action)) return 'Delete'
  if (/^EXPORT/.test(action)) return 'Export'
  if (/^IMPORT/.test(action)) return 'Import'
  if (/^SUBMIT/.test(action)) return 'Submit'
  return 'Other'
}
function isDestructive(action) {
  return /^(DELETE|CLEAR)/.test(action || '')
}
// Business hours defined as weekdays 7am-7pm local time — anything outside
// that window on a real logged timestamp counts as after-hours.
function isAfterHours(ts) {
  const d = new Date(ts)
  const day = d.getDay()
  const hour = d.getHours()
  if (day === 0 || day === 6) return true
  return hour < 7 || hour >= 19
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function computeActionBreakdown(entries) {
  const order = ['Create', 'Update', 'Delete', 'Export', 'Import', 'Submit', 'Other']
  return order.map(label => ({ label, count: entries.filter(e => actionVerb(e.action) === label).length })).filter(d => d.count > 0)
}

function computeCategoryBreakdown(entries) {
  const categories = [...new Set(entries.map(e => e.category).filter(Boolean))]
  return categories
    .map((cat, i) => ({ label: cat, count: entries.filter(e => e.category === cat).length, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
    .sort((a, b) => b.count - a.count)
}

// Real per-day activity + running cumulative total, from each entry's
// actual timestamp — not a fabricated volume curve.
function activitySeries(entries, days = 30) {
  const now = Date.now()
  const dayStart = now - (days - 1) * DAY
  let running = entries.filter(e => e.ts < dayStart).length
  const points = []
  for (let i = 0; i < days; i++) {
    const floor = dayStart + i * DAY
    const ceil = floor + DAY
    const added = entries.filter(e => e.ts >= floor && e.ts < ceil).length
    running += added
    points.push({ added, cumulative: running, label: new Date(floor).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
  }
  return points
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

// Combo chart: bars = activity per day, line = cumulative running total.
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
    return { ...p, xCenter, barX: xCenter - barW / 2, barY: padT + plotH - barH, barH, lineY: padT + plotH - (p.cumulative / cumMax) * plotH }
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
      {coords.map((c, i) => <rect key={`bar-${i}`} x={c.barX} y={c.barY} width={barW} height={Math.max(c.barH, 0)} rx="2" fill="#93c5fd" />)}
      <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <g key={`pt-${i}`}>
          {i % labelStep === 0 && <text x={c.xCenter} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--ink-500)">{c.label}</text>}
          {i === coords.length - 1 && <circle cx={c.xCenter} cy={c.lineY} r="4" fill="#2563EB" />}
        </g>
      ))}
    </svg>
  )
}

function CategoryDonut({ data, total }) {
  const size = 140
  const r = 52
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const segments = data.reduce((acc, d) => {
    const frac = total ? d.count / total : 0
    const dash = frac * circumference
    const prevOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0
    acc.push({ ...d, dash, offset: prevOffset })
    return acc
  }, [])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink-100)" strokeWidth="16" />
      {segments.map(s => (
        <circle
          key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="16"
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--ink-900)">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--ink-500)">events</text>
    </svg>
  )
}

function ActionBars({ data }) {
  if (data.length === 0) return <EmptyNote text="No activity logged yet." />
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 70, fontSize: 12, fontWeight: 600 }}>{d.label}</div>
          <div style={{ flex: 1, height: 14, background: 'var(--ink-100)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.count / max) * 100}%`, background: ACTION_TYPE_COLORS[d.label], borderRadius: 4 }} />
          </div>
          <div style={{ width: 34, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{d.count}</div>
        </div>
      ))}
    </div>
  )
}

function HoursDonut({ business, afterHours }) {
  const total = business + afterHours
  const size = 140
  const r = 52
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const segs = [
    { key: 'business', count: business, color: '#22c55e' },
    { key: 'after', count: afterHours, color: '#f59e0b' },
  ].filter(s => s.count > 0).reduce((acc, s) => {
    const frac = total ? s.count / total : 0
    const dash = frac * circumference
    const prevOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0
    acc.push({ ...s, dash, offset: prevOffset })
    return acc
  }, [])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink-100)" strokeWidth="16" />
      {segs.map(s => (
        <circle
          key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="16"
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--ink-900)">{total ? Math.round((afterHours / total) * 100) : 0}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--ink-500)">after-hours</text>
    </svg>
  )
}

export default function ComplianceAudit() {
  const { user } = useApp()
  const [entries] = useState(() => getLog())
  const [checklist, setChecklist] = useState({})
  const [checklistLoading, setChecklistLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'complianceChecklist'))
    const unsub = onSnapshot(
      q,
      snap => {
        const state = {}
        snap.docs.forEach(d => { state[d.id] = d.data() })
        setChecklist(state)
        setChecklistLoading(false)
      },
      err => { setError(err.message); setChecklistLoading(false) }
    )
    return unsub
  }, [])

  const series = useMemo(() => activitySeries(entries, 30), [entries])
  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(entries), [entries])
  const actionBreakdown = useMemo(() => computeActionBreakdown(entries), [entries])
  const destructiveActions = useMemo(() => [...entries].filter(e => isDestructive(e.action)).sort((a, b) => b.ts - a.ts).slice(0, 15), [entries])

  const hoursCounts = useMemo(() => {
    let business = 0, afterHours = 0
    entries.forEach(e => { if (isAfterHours(e.ts)) afterHours++; else business++ })
    return { business, afterHours }
  }, [entries])

  const errorCount = entries.filter(e => e.status === 'error').length
  const errorRate = entries.length ? Math.round((errorCount / entries.length) * 100) : null
  const destructiveCount = entries.filter(e => isDestructive(e.action)).length

  const checkedCount = CHECKLIST_ITEMS.filter(item => checklist[item.id]?.checked).length

  async function toggleChecklistItem(item) {
    const current = checklist[item.id]
    try {
      await setDoc(doc(db, 'complianceChecklist', item.id), {
        checked: !current?.checked,
        checkedBy: !current?.checked ? (user?.name || 'Operator') : '',
        checkedAt: !current?.checked ? serverTimestamp() : null,
      })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Compliance & Security Audit</span></div>
            <h1>Compliance & Security Audit</h1>
          </div>
        </div>

        {error && <div className="settings-error" style={{ marginBottom: 16, marginLeft: 5 }}>{error}</div>}

        <div style={{ marginLeft: 5 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16, maxWidth: 780 }}>
            Built entirely from the real activity log on Log Audit — no new tracking added. Note: the log is stored per-browser and every entry's actor is the current admin session, so this reflects activity from this device, not a distinguishable multi-user breakdown.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 22 }}>
            <StatCard label="TOTAL ACTIVITY" value={entries.length} sub="All logged events on this device" />
            <StatCard label="ERROR RATE" value={errorRate != null ? `${errorRate}%` : '—'} valueColor={errorRate != null && errorRate > 5 ? '#b91c1c' : undefined} />
            <StatCard label="AFTER-HOURS EVENTS" value={hoursCounts.afterHours} sub="Outside weekday 7am-7pm" />
            <StatCard label="DESTRUCTIVE ACTIONS" value={destructiveCount} valueColor={destructiveCount ? '#b45309' : undefined} sub="Delete / Clear operations" />
          </div>

          <div className="card" style={{ padding: 24, marginBottom: 22 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Activity Volume Trend</div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 10 }}>Logged events per day (bars) and cumulative total (line) over the last 30 days</div>
            {entries.length === 0 ? <EmptyNote text="No activity logged yet." /> : <GrowthChart points={series} />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Activity by Category</div>
              {categoryBreakdown.length === 0 ? <EmptyNote text="No activity yet." /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                  <CategoryDonut data={categoryBreakdown} total={entries.length} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, maxHeight: 150, overflowY: 'auto' }}>
                    {categoryBreakdown.map(c => (
                      <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--ink-700)' }}>{c.label}</span>
                        <span style={{ fontWeight: 700 }}>{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Activity by Action Type</div>
              <ActionBars data={actionBreakdown} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 18, marginBottom: 22, alignItems: 'stretch' }}>
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Business Hours vs After-Hours</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Weekday 7am-7pm counted as business hours</div>
              {entries.length === 0 ? <EmptyNote text="No activity yet." /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                  <HoursDonut business={hoursCounts.business} afterHours={hoursCounts.afterHours} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, fontSize: 12.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e' }} /><span style={{ flex: 1 }}>Business hours</span><strong>{hoursCounts.business}</strong></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b' }} /><span style={{ flex: 1 }}>After-hours</span><strong>{hoursCounts.afterHours}</strong></div>
                  </div>
                </div>
              )}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Recent Destructive Actions ({destructiveActions.length})</div>
              {destructiveActions.length === 0 ? (
                <EmptyNote text="No delete or clear actions logged." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {destructiveActions.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, border: '1px solid var(--ink-200)', borderRadius: 8, padding: '8px 12px', gap: 8 }}>
                      <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</span>
                      <span style={{ color: 'var(--ink-500)' }}>{e.category}</span>
                      <span style={{ color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{timeAgo(e.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Periodic Access Review Checklist</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{checkedCount} / {CHECKLIST_ITEMS.length} complete</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Real, persisted checklist — check items off as you complete each review</div>
            {checklistLoading ? (
              <EmptyNote text="Loading checklist…" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CHECKLIST_ITEMS.map(item => {
                  const state = checklist[item.id]
                  return (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--ink-200)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!state?.checked} onChange={() => toggleChecklistItem(item)} style={{ width: 16, height: 16 }} />
                      <span style={{ flex: 1, fontSize: 13, color: state?.checked ? 'var(--ink-500)' : 'var(--ink-900)', textDecoration: state?.checked ? 'line-through' : 'none' }}>{item.label}</span>
                      {state?.checked && <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{state.checkedBy}</span>}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
