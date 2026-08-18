import { useState, useRef } from 'react'

const W = 480, H = 260
const PAD_L = 40, PAD_R = 16, PAD_T = 14, PAD_B = 34

function niceCeil(value) {
  if (value <= 0) return 1
  const step = value <= 5 ? 1 : value <= 20 ? 2 : value <= 50 ? 5 : 10
  return Math.ceil(value / step) * step
}

// Correlation view — does risk score track with age? Each device is one
// point; color is identity (risk band), so a legend is always shown even
// though it's technically the same encoding as the y-axis severity.
export default function ScatterChart({ points, xLabel, legend }) {
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const xMax = niceCeil(Math.max(1, ...points.map((p) => p.x)) * 1.1)
  const yMax = 100

  const xAt = (x) => PAD_L + (x / xMax) * plotW
  const yAt = (y) => PAD_T + plotH - (y / yMax) * plotH

  const gridY = [0, 25, 50, 75, 100]
  const gridXCount = 4
  const gridX = Array.from({ length: gridXCount + 1 }, (_, i) => (xMax / gridXCount) * i)

  function showTooltip(p, e) {
    const rect = wrapRef.current.getBoundingClientRect()
    setHover({ ...p, left: e.clientX - rect.left, top: e.clientY - rect.top })
  }

  return (
    <div>
      {legend && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
          {legend.map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--viz-text-secondary)' }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      )}
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
          {gridY.map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yAt(v)} y2={yAt(v)} stroke="var(--viz-grid)" strokeWidth="1" />
              <text x={PAD_L - 8} y={yAt(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--viz-muted)">{v}</text>
            </g>
          ))}
          {gridX.map((v, i) => (
            <text key={i} x={xAt(v)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--viz-muted)">{v.toFixed(1)}</text>
          ))}
          <text x={PAD_L + plotW / 2} y={H - 2} textAnchor="middle" fontSize="10.5" fill="var(--viz-muted)">{xLabel}</text>
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke="var(--viz-baseline)" strokeWidth="1" />

          {points.map((p) => (
            <circle key={p.id} cx={xAt(p.x)} cy={yAt(p.y)} r={hover?.id === p.id ? 7 : 5.5} fill={p.color}
              stroke="var(--viz-surface)" strokeWidth="1.5" opacity="0.9"
              style={{ cursor: 'pointer', transition: 'r .1s' }}
              onMouseMove={(e) => showTooltip(p, e)} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>

        {hover && (
          <div style={{
            position: 'absolute', pointerEvents: 'none', left: hover.left + 12, top: hover.top - 12,
            background: 'var(--viz-surface)', border: '1px solid var(--viz-grid)', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,.12)', padding: '7px 10px', fontSize: 12.5, zIndex: 5, whiteSpace: 'nowrap',
          }}>
            <div style={{ fontWeight: 700, color: 'var(--viz-text-primary)', marginBottom: 2 }}>{hover.label}</div>
            <div style={{ color: 'var(--viz-text-secondary)' }}>Age: {hover.x.toFixed(1)}yrs · Risk: {hover.y}</div>
          </div>
        )}
      </div>
    </div>
  )
}
