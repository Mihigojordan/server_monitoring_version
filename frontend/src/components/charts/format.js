// Auto-compact number formatting for stat tiles / axis ticks — 1,284 / 12.9K / 4.2M.
export function compactNumber(n) {
  const v = Number(n) || 0
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `${sign}${Math.round(abs).toLocaleString()}`
}

export function formatRwf(n) {
  return `${compactNumber(n)} RWF`
}

// Rounds an axis max up to a clean step (0 / 1,000 / 2,000 …) per marks-and-anatomy.md
export function niceMax(value) {
  if (value <= 0) return 10
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  let step
  if (normalized <= 1) step = 1
  else if (normalized <= 2) step = 2
  else if (normalized <= 5) step = 5
  else step = 10
  return step * magnitude
}
