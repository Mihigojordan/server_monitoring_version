export interface Point {
  timestamp: string;
  value: number;
}

export function pointsSince(
  points: Point[],
  asOf: Date,
  minutesBack: number,
): Point[] {
  const cutoff = asOf.getTime() - minutesBack * 60_000;
  return points.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return t > cutoff && t <= asOf.getTime();
  });
}

export function avg(points: Point[]): number | null {
  if (!points.length) return null;
  return points.reduce((s, p) => s + p.value, 0) / points.length;
}

export function max(points: Point[]): number | null {
  if (!points.length) return null;
  return Math.max(...points.map((p) => p.value));
}

export function variance(points: Point[]): number | null {
  if (points.length < 2) return null;
  const m = avg(points) as number;
  return points.reduce((s, p) => s + (p.value - m) ** 2, 0) / points.length;
}

/** OLS slope in units-per-day over the full point set — the same trend math used across the app for capacity/risk forecasting. */
export function growthRatePerDay(points: Point[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const t0 = new Date(sorted[0].timestamp).getTime();
  const xs = sorted.map(
    (p) => (new Date(p.timestamp).getTime() - t0) / 86_400_000,
  );
  const ys = sorted.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function daysToThreshold(
  current: number,
  growthPerDay: number | null,
  threshold: number,
): number | null {
  if (growthPerDay == null || growthPerDay <= 0.0001) return null;
  if (current >= threshold) return 0;
  return Math.round((threshold - current) / growthPerDay);
}
