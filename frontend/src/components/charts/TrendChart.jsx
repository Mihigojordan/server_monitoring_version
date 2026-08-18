import { useState, useRef, useCallback } from 'react'
import { compactNumber, niceMax } from './format'

const W = 640, H = 220
const PAD_L = 44, PAD_R = 12, PAD_T = 12, PAD_B = 24

// Multi-series line trend — single shared axis (never dual-axis: both series
// here are the same RWF unit). Crosshair + one tooltip listing every series,
// per interaction.md.
export default function TrendChart({ series, xLabels, height = H, valueFormatter = compactNumber }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const wrapRef = useRef(null)
  const n = xLabels.length
  const plotW = W - PAD_L - PAD_R
  const plotH = height - PAD_T - PAD_B

  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)))
  const xAt = (i) => PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * plotW)
  const yAt = (v) => PAD_T + plotH - (v / max) * plotH

  const paths = series.map(s => ({
    ...s,
    d: s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' '),
  }))

  const gridSteps = 4
  const gridValues = Array.from({ length: gridSteps + 1 }, (_, i) => (max / gridSteps) * i)

  const handleMove = useCallback((e) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((relX - PAD_L) / plotW) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }, [n, plotW])

  // Sparse x labels: first, last, and evenly-spaced mids — never every point.
  const xTickIdx = new Set([0, n - 1, Math.floor((n - 1) / 2)])

  return (
    <div style={{ position: 'relative' }}>
      {/* Legend — always present for 2+ series */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        {series.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--viz-text-secondary)' }}>
            <span style={{ display: 'inline-block', width: 14, height: 2, borderRadius: 1, background: s.color }} />
            {s.name}
          </div>
        ))}
      </div>

      <div ref={wrapRef} style={{ position: 'relative' }}
        onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
        <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
          {/* Gridlines — hairline, recessive, clean rounded values */}
          {gridValues.map((v, i) => (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yAt(v)} y2={yAt(v)} stroke="var(--viz-grid)" strokeWidth="1" />
              <text x={PAD_L - 8} y={yAt(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--viz-muted)">
                {compactNumber(v)}
              </text>
            </g>
          ))}
          {/* Baseline */}
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke="var(--viz-baseline)" strokeWidth="1" />

          {/* X labels — sparse */}
          {xLabels.map((lbl, i) => xTickIdx.has(i) && (
            <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--viz-muted)">
              {lbl}
            </text>
          ))}

          {/* Crosshair */}
          {hoverIdx !== null && (
            <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={PAD_T} y2={PAD_T + plotH} stroke="var(--viz-baseline)" strokeWidth="1" />
          )}

          {/* Series lines + end markers */}
          {paths.map(s => (
            <g key={s.name}>
              <path d={s.d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {hoverIdx !== null && (
                <circle cx={xAt(hoverIdx)} cy={yAt(s.values[hoverIdx])} r="5" fill={s.color} stroke="var(--viz-surface)" strokeWidth="2" />
              )}
              <circle cx={xAt(n - 1)} cy={yAt(s.values[n - 1])} r="4" fill={s.color} stroke="var(--viz-surface)" strokeWidth="2" />
            </g>
          ))}

          {/* Hit layer */}
          <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="transparent" />
        </svg>

        {hoverIdx !== null && (
          <div style={{
            position: 'absolute', pointerEvents: 'none',
            left: `${Math.min(78, Math.max(0, (xAt(hoverIdx) / W) * 100))}%`,
            top: 4, transform: xAt(hoverIdx) / W > 0.6 ? 'translateX(-100%)' : 'none',
            background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,.12)', padding: '8px 10px', fontSize: 12.5, minWidth: 140, zIndex: 5,
          }}>
            <div style={{ color: 'var(--viz-text-secondary)', marginBottom: 4, fontWeight: 600 }}>{xLabels[hoverIdx]}</div>
            {series.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ display: 'inline-block', width: 10, height: 2, borderRadius: 1, background: s.color }} />
                <span style={{ color: 'var(--viz-text-secondary)', flex: 1 }}>{s.name}</span>
                <strong style={{ color: 'var(--viz-text-primary)' }}>{valueFormatter(s.values[hoverIdx])}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
