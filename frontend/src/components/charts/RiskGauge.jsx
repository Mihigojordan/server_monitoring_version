const RADIUS = 78
const STROKE = 16
const SIZE_W = 228
const SIZE_H = 128
const CX = SIZE_W / 2
const CY = 108

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// -90deg..+90deg sweep = a half-donut opening upward, sitting on the baseline.
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function angleFor(value) {
  return -90 + (Math.max(0, Math.min(100, value)) / 100) * 180
}

// 0-100 risk score as a speedometer: three fixed status zones (never
// re-colored by which items happen to be present, per color-formula.md)
// plus a needle at the fleet average and the band cutoffs labeled on the arc.
export default function RiskGauge({ value, bands = { critical: 70, warning: 40 } }) {
  const zones = [
    { from: 0, to: bands.warning, color: 'var(--ok)' },
    { from: bands.warning, to: bands.critical, color: 'var(--warn)' },
    { from: bands.critical, to: 100, color: 'var(--err)' },
  ]
  const v = value ?? 0
  const needleAngle = angleFor(v)
  const needleTip = polarToCartesian(CX, CY, RADIUS - STROKE / 2 - 2, needleAngle)
  const bandLabel = value == null ? 'n/a' : v >= bands.critical ? 'Critical' : v >= bands.warning ? 'Warning' : 'Healthy'
  const bandColor = value == null ? 'var(--viz-muted)' : v >= bands.critical ? 'var(--err)' : v >= bands.warning ? 'var(--warn)' : 'var(--ok)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={SIZE_W} height={SIZE_H} viewBox={`0 0 ${SIZE_W} ${SIZE_H}`}>
        {zones.map((z) => (
          <path key={z.from} d={describeArc(CX, CY, RADIUS, angleFor(z.from), angleFor(z.to))}
            fill="none" stroke={z.color} strokeWidth={STROKE} opacity="0.85" />
        ))}
        {/* Cutoff ticks at the band boundaries — the same numbers the risk model uses */}
        {[0, bands.warning, bands.critical, 100].map((t) => {
          const p1 = polarToCartesian(CX, CY, RADIUS - STROKE / 2 - 2, angleFor(t))
          const p2 = polarToCartesian(CX, CY, RADIUS + STROKE / 2 + 2, angleFor(t))
          const lbl = polarToCartesian(CX, CY, RADIUS + STROKE / 2 + 14, angleFor(t))
          return (
            <g key={t}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--viz-surface)" strokeWidth="2" />
              <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fill="var(--viz-muted)">{t}</text>
            </g>
          )
        })}
        {value != null && (
          <g>
            <line x1={CX} y1={CY} x2={needleTip.x} y2={needleTip.y} stroke="var(--viz-text-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="5" fill="var(--viz-text-primary)" />
          </g>
        )}
      </svg>
      <div style={{ marginTop: -18, textAlign: 'center' }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: bandColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value ?? '—'}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--viz-muted)', fontWeight: 600, marginTop: 2 }}>{bandLabel} · fleet avg</div>
      </div>
    </div>
  )
}
