export interface TrendResult {
  slopePerDay: number;
  intercept: number;
  current: number;
  /** How well a straight line fits the samples, 0..1. Low r2 means the trend forecast below is unreliable. */
  r2: number;
}

function olsFit(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number; r2: number } {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * xs[i];
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2: Math.round(r2 * 1000) / 1000 };
}

export interface TimedSample {
  timestamp: Date;
  value: number;
}

/**
 * OLS fit over real (possibly irregularly-spaced) logged samples — x is
 * actual elapsed days since the earliest sample, not an assumed daily
 * index, since manually-logged snapshots aren't evenly spaced.
 */
export function linearTrendFromSamples(samples: TimedSample[]): TrendResult {
  const n = samples.length;
  if (n === 0) return { slopePerDay: 0, intercept: 0, current: 0, r2: 0 };

  const sorted = [...samples].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const t0 = sorted[0].timestamp.getTime();
  const xs = sorted.map((s) => (s.timestamp.getTime() - t0) / 86400000);
  const ys = sorted.map((s) => s.value);

  if (n === 1)
    return { slopePerDay: 0, intercept: ys[0], current: ys[0], r2: 0 };

  const { slope, intercept, r2 } = olsFit(xs, ys);
  return { slopePerDay: slope, intercept, current: ys[n - 1], r2 };
}

/** Days until `current` (drifting at `slopePerDay`) crosses `threshold`. Null if it's flat/falling. */
export function daysToThreshold(
  current: number,
  slopePerDay: number,
  threshold: number,
): number | null {
  if (slopePerDay <= 0.0005) return null;
  if (current >= threshold) return 0;
  return Math.round((threshold - current) / slopePerDay);
}

/** Age in years from a creation date — the closest real proxy available (see config.ts). */
export function ageYears(createdAt: Date | null): number | null {
  if (!createdAt) return null;
  const ms = Date.now() - createdAt.getTime();
  return ms > 0 ? ms / (365.25 * 86400000) : null;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** `used/total` as a 0-100 percentage; 0 when total is missing or non-positive. */
export function pct(
  used: number | undefined,
  total: number | undefined,
): number {
  const u = Number(used) || 0;
  const t = Number(total) || 0;
  return t > 0 ? clamp((u / t) * 100, 0, 100) : 0;
}

export interface ScoreComponent {
  value: number;
  weight: number;
  /** Defaults to true. When false, this component is dropped and the remaining weights renormalize to sum to 1. */
  available?: boolean;
}

/**
 * Weighted average that renormalizes over only the available components —
 * e.g. a brand-new device with no logged history yet still gets a real
 * score from age/status/current-value alone, rather than being dragged
 * toward 0 by a trend component that has nothing to measure.
 */
export function weightedScore(components: ScoreComponent[]): number {
  const usable = components.filter((c) => c.available !== false);
  const totalWeight = usable.reduce((s, c) => s + c.weight, 0) || 1;
  return Math.round(
    usable.reduce((s, c) => s + c.value * (c.weight / totalWeight), 0),
  );
}
