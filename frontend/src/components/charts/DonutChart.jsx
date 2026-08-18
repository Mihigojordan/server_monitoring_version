import { useState, useRef } from 'react'
import { compactNumber } from './format'

// Donut — identity encoding (categorical). Legend is always present (never
// color-matching alone), and since three reference-palette hues (aqua,
// yellow, magenta) sit under 3:1 contrast on a light surface, every segment
// gets a legend row with a real text label, not just a swatch.
export default function DonutChart({ data, size = 148, thickness = 26, centerLabel, valueFormatter = compactNumber }) {
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const gap = total > 0 ? 3 : 0 // px of arc reserved as the surface gap between segments

  let cursor = 0
  const segments = data.map((d) => {
    const frac = d.value / total
    const len = frac * circumference
    const dash = Math.max(len - gap, 0.001)
    const seg = { ...d, frac, dashArray: `${dash} ${circumference - dash}`, dashOffset: -cursor }
    cursor += len
    return seg
  })

  function showTooltip(seg, e) {
    const rect = wrapRef.current.getBoundingClientRect()
    setHover({ ...seg, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div ref={wrapRef} style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-grid)" strokeWidth={thickness} />
          {segments.map((s, i) => (
            <circle
              key={s.label}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={hover?.label === s.label ? thickness + 4 : thickness}
              strokeDasharray={s.dashArray} strokeDashoffset={s.dashOffset} strokeLinecap="round"
              style={{ transition: 'stroke-width .12s', cursor: 'pointer' }}
              onMouseMove={(e) => showTooltip(s, e)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${s.label}: ${valueFormatter(s.value)}`}</title>
            </circle>
          ))}
        </g>
        {centerLabel && (
          <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize="18" fontWeight="700" fill="var(--viz-text-primary)">
            {centerLabel}
          </text>
        )}
      </svg>

      {/* Legend — doubles as the direct-label relief for low-contrast hues */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--viz-text-secondary)', flex: 1 }}>{s.label}</span>
            <strong style={{ color: 'var(--viz-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(s.frac * 100)}%
            </strong>
          </div>
        ))}
      </div>

      {hover && (
        <div style={{
          position: 'absolute', pointerEvents: 'none', left: hover.x + 12, top: hover.y - 12,
          background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)', padding: '7px 10px', fontSize: 12.5, zIndex: 5, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'var(--viz-text-secondary)' }}>{hover.label}: </span>
          <strong style={{ color: 'var(--viz-text-primary)' }}>{valueFormatter(hover.value)}</strong>
        </div>
      )}
    </div>
  )
}
