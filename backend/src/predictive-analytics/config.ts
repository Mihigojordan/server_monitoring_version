// Thresholds and weights the predictive engine scores against. Kept as a
// plain TS module (not a JSON file) now that there's no accompanying
// synthetic dataset to version alongside it — this drives scoring directly
// against live Firestore data in servers/storageDevices/networkDevices.

export const RISK_BANDS = { critical: 70, warning: 40 };

// No purchaseDate/warrantyExpiry field exists on servers/storageDevices/
// networkDevices (only the separate, unlinked "equipment" registry has
// those) — age is estimated from each doc's createdAt as the closest real
// proxy, same disclosed approach CostReporting.jsx uses for book value.
export const MAX_AGE_YEARS = 8;

// perfSnapshots are logged manually (no monitoring agent) — a 1-2 point
// "trend" is just noise dressed up as math. Below this count, trend/
// forecast fields come back null rather than a fabricated slope.
export const MIN_SNAPSHOTS_FOR_TREND = 3;

export const FORECAST_HORIZON_DAYS = 365;

// The five status values every device-management collection shares
// (frontend/src/lib/infraShared.js STATUSES) — a device's own reported
// status is itself a strong, real risk signal.
export const STATUS_RISK: Record<string, number> = {
  Critical: 100,
  Offline: 85,
  Warning: 55,
  Maintenance: 35,
  Online: 10,
};
export const DEFAULT_STATUS_RISK = 40; // unrecognized/legacy status value

export const SERVER_THRESHOLDS = {
  cpuCriticalPct: 90,
  ramCriticalPct: 92,
  diskCriticalPct: 90,
};

export const STORAGE_THRESHOLDS = {
  capacityCriticalPct: 100,
  latencyCriticalMs: 15,
};

// A switch has no "critical" utilization threshold in the CPU/RAM sense —
// the real capacity-planning question is when it runs out of free ports to
// plug new devices into, so 100% (every tracked port in use) is the
// threshold, same shape as storage capacity.
export const PORT_THRESHOLDS = {
  portUtilCriticalPct: 100,
};
