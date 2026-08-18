import { useState } from 'react'
import { compactNumber } from './format'

// Horizontal bar list — plain HTML/CSS marks (no SVG needed here). Single
// series, so no legend (the card title already says what's plotted, per
// marks-and-anatomy.md). Rounded data-end, square at the baseline, value
// always at the tip so nothing is ever clipped.
export default function BarChart({ data, valueFormatter = compactNumber, labelWidth = 120 }) {
  const [hoverLabel, setHoverLabel] = useState(null)
  const max = Math.max(1, ...data.map(d => d.value))

  if (data.length === 0) {
    return <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--viz-muted)', fontSize: 13 }}>No data yet</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(d => {
        const pct = Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)
        const hovered = hoverLabel === d.label
        return (
          <div key={d.label}
            onMouseEnter={() => setHoverLabel(d.label)} onMouseLeave={() => setHoverLabel(null)}
            title={`${d.label}: ${valueFormatter(d.value)}`}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'default' }}>
            <div style={{
              width: labelWidth, flexShrink: 0, fontSize: 12.5, color: 'var(--viz-text-secondary)',
              textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {d.label}
            </div>
            <div style={{ flex: 1, height: 20, position: 'relative', background: 'var(--viz-grid)', borderRadius: 4 }}>
              <div style={{
                position: 'absolute', insetBlock: 0, left: 0, width: `${pct}%`, minWidth: 4,
                background: d.color, borderRadius: '0 4px 4px 0',
                opacity: hovered ? 0.85 : 1, transition: 'width .3s, opacity .12s',
              }} />
            </div>
            <div style={{ width: 74, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--viz-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {valueFormatter(d.value)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
