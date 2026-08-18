import { compactNumber } from './format'

// 12-point sparkline: prior points in the de-emphasis (muted) tone, current
// period in the accent — per marks-and-anatomy.md's stat-tile trend contract.
function Sparkline({ points, color }) {
  if (!points || points.length < 2) return null
  const w = 72, h = 24, pad = 2
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const stepX = (w - pad * 2) / (points.length - 1)
  const coords = points.map((p, i) => [
    pad + i * stepX,
    h - pad - ((p - min) / range) * (h - pad * 2),
  ])
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={path} fill="none" stroke="var(--viz-muted)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} stroke="var(--viz-surface)" strokeWidth="2" />
    </svg>
  )
}

// Stat-tile contract (marks-and-anatomy.md): label · value · optional signed
// delta (color = direction × whether up is good) · optional trend sparkline.
export default function StatTile({ label, value, sub, delta, deltaGood = true, trend, color = 'var(--viz-series-1)' }) {
  const hasDelta = delta !== undefined && delta !== null && delta !== ''
  const deltaUp = typeof delta === 'number' ? delta > 0 : String(delta).trim().startsWith('+')
  const deltaColor = hasDelta ? ((deltaUp === deltaGood) ? 'var(--ok)' : 'var(--err)') : undefined

  return (
    <div className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--viz-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, marginTop: 4, color: 'var(--viz-text-primary)', fontVariantNumeric: 'proportional-nums' }}>
          {typeof value === 'number' ? compactNumber(value) : value}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, minHeight: 16 }}>
          {sub && <span style={{ fontSize: 12, color: 'var(--viz-muted)' }}>{sub}</span>}
          {hasDelta && (
            <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>
              {deltaUp ? '↑' : '↓'} {typeof delta === 'number' ? `${Math.abs(delta)}%` : delta}
            </span>
          )}
        </div>
      </div>
      {trend && <Sparkline points={trend} color={color} />}
    </div>
  )
}
