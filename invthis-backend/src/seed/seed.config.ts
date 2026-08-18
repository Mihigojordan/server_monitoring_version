function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? parseInt(v, 10) : fallback;
}

// Defaults are a modest "small real run" per the brief — every asset type
// and every generation pathway is exercised at least once, in a scale that
// actually finishes and is reviewable, not the full 100-server/90-day spec
// scale. Every count below is overridable via env var, so the exact same
// generator can be pointed at the full spec scale later.
export const SEED_CONFIG = {
  seedRandom: envInt("SEED_RANDOM_SEED", 20260817),
  days: envInt("SEED_DAYS", 30),
  dataCenters: envInt("DATA_CENTERS", 2),
  racksPerDc: envInt("RACKS_PER_DC", 2),
  servers: envInt("SERVERS", 5),
  storageSystems: envInt("STORAGE_SYSTEMS", 2),
  disksPerStorage: envInt("DISKS_PER_STORAGE", 3),
  switches: envInt("SWITCHES", 3),
  routers: envInt("ROUTERS", 1),
  firewalls: envInt("FIREWALLS", 1),
  loadBalancers: envInt("LOAD_BALANCERS", 1),
  upsCount: envInt("UPS_COUNT", 2),
  pduCount: envInt("PDU_COUNT", 2),
  applications: envInt("APPLICATIONS", 8),
  databases: envInt("DATABASES", 4),

  // "Important" infra (servers/storage/switches) — spec prefers 5-minute
  // resolution for these; kept configurable since it dominates row count.
  criticalIntervalMinutes: envInt("METRIC_INTERVAL", 15),
  // Less-critical infra (router/firewall/LB/apps/databases).
  standardIntervalMinutes: envInt("STANDARD_METRIC_INTERVAL", 30),
  // Environmental + power — spec asks for hourly.
  environmentalIntervalMinutes: envInt("ENV_METRIC_INTERVAL", 60),

  // How often predictive_features/prediction_labels snapshots are computed per asset.
  featureIntervalHours: envInt("FEATURE_INTERVAL_HOURS", 24),
};
