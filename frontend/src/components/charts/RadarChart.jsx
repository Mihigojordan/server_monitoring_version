import { useState } from 'react'

const SIZE = 240
const CX = SIZE / 2
const CY = SIZE / 2 - 6
const R = 78
const RINGS = [25, 50, 75, 100]

function pointAt(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// Multi-axis snapshot of a single device's *current* values, each already
// normalized to 0-100 (e.g. currentPct / criticalThreshold) so metrics with
// different native units (%, ms) sit on one shared scale. Needs no history —
// unlike a trend line, this works for a device with zero logged snapshots.
export default function RadarChart({ axes, color = 'var(--viz-series-1)' }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const n = axes.length
  const angleStep = 360 / n

  const vertex = (i, r) => pointAt(CX, CY, r, i * angleStep)
  const dataPoints = axes.map((a, i) => vertex(i, (Math.max(0, Math.min(100, a.value)) / 100) * R))
  const polygonPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }}>
        {/* Grid rings */}
        {RINGS.map((ring) => {
          const ringPts = axes.map((_, i) => vertex(i, (ring / 100) * R))
          const d = ringPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
          return <path key={ring} d={d} fill="none" stroke="var(--viz-grid)" strokeWidth="1" />
        })}
        {/* Spokes + axis labels */}
        {axes.map((a, i) => {
          const tip = vertex(i, R)
          const labelPt = vertex(i, R + 22)
          return (
            <g key={a.label}>
              <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke="var(--viz-grid)" strokeWidth="1" />
              <text x={labelPt.x} y={labelPt.y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" fill="var(--viz-text-secondary)">
                {a.label}
              </text>
            </g>
          )
        })}
        {/* Data polygon */}
        <path d={polygonPath} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 6 : 4} fill={color} stroke="var(--viz-surface)" strokeWidth="2"
            style={{ cursor: 'pointer', transition: 'r .1s' }}
            onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} />
        ))}
      </svg>

      {hoverIdx !== null && (
        <div style={{
          position: 'absolute', pointerEvents: 'none', left: '50%', bottom: 4, transform: 'translateX(-50%)',
          background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)', padding: '7px 10px', fontSize: 12.5, zIndex: 5, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'var(--viz-text-secondary)' }}>{axes[hoverIdx].label}: </span>
          <strong style={{ color: 'var(--viz-text-primary)' }}>{axes[hoverIdx].display ?? `${Math.round(axes[hoverIdx].value)}%`}</strong>
        </div>
      )}
    </div>
  )
}
