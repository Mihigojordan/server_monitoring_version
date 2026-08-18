import { useState } from 'react'

const W = 680
const ROW_H = 32
const PAD_L = 170
const PAD_R = 20
const PAD_TOP = 28
const PAD_BOTTOM = 28

// One row per item, a dot positioned by real elapsed days along a shared
// date axis — a lollipop timeline. Replaces a mix of a bar chart + a
// separate "already past" list + a footnote with one clean, continuous
// picture: items before "today" just land left of the axis's zero line.
export default function TimelineDotChart({ items, axisStartDays, axisEndDays, zeroLabel = 'Today', legend }) {
  const [hoverId, setHoverId] = useState(null)
  const plotW = W - PAD_L - PAD_R
  const height = PAD_TOP + items.length * ROW_H + PAD_BOTTOM

  const span = axisEndDays - axisStartDays
  const xAt = (days) => PAD_L + ((Math.max(axisStartDays, Math.min(axisEndDays, days)) - axisStartDays) / span) * plotW
  const zeroX = xAt(0)

  const gridStep = span <= 120 ? 30 : span <= 400 ? 90 : 180
  const gridDays = []
  for (let d = Math.ceil(axisStartDays / gridStep) * gridStep; d <= axisEndDays; d += gridStep) gridDays.push(d)
  if (!gridDays.includes(0) && axisStartDays <= 0 && axisEndDays >= 0) gridDays.push(0)

  return (
    <div>
      {legend && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          {legend.map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--viz-text-secondary)' }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
        {gridDays.map((d) => (
          <g key={d}>
            <line x1={xAt(d)} x2={xAt(d)} y1={PAD_TOP - 8} y2={height - PAD_BOTTOM + 4} stroke="var(--viz-grid)" strokeWidth="1" />
            <text x={xAt(d)} y={PAD_TOP - 14} textAnchor="middle" fontSize="10.5" fill="var(--viz-muted)">
              {d === 0 ? zeroLabel : d > 0 ? `+${d}d` : `${d}d`}
            </text>
          </g>
        ))}
        {/* Today/zero line, emphasized */}
        <line x1={zeroX} x2={zeroX} y1={PAD_TOP - 8} y2={height - PAD_BOTTOM + 4} stroke="var(--viz-baseline)" strokeWidth="1.5" />

        {items.map((it, i) => {
          const y = PAD_TOP + i * ROW_H + ROW_H / 2
          const x = xAt(it.days)
          const hovered = hoverId === it.id
          return (
            <g key={it.id}>
              <text x={PAD_L - 12} y={y} textAnchor="end" dominantBaseline="middle" fontSize="12" fontWeight="600" fill="var(--viz-text-primary)">
                {it.label.length > 22 ? `${it.label.slice(0, 21)}…` : it.label}
              </text>
              <line x1={Math.min(zeroX, x)} x2={Math.max(zeroX, x)} y1={y} y2={y} stroke={it.color} strokeWidth="2" opacity="0.4" />
              <circle cx={x} cy={y} r={hovered ? 7 : 5.5} fill={it.color} stroke="var(--viz-surface)" strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'r .1s' }}
                onMouseEnter={() => setHoverId(it.id)} onMouseLeave={() => setHoverId(null)} />
              <text x={x} y={y - 12} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={it.color} opacity={hovered ? 1 : 0.85}>
                {it.days < 0 ? `${Math.abs(it.days)}d ago` : `${it.days}d`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
