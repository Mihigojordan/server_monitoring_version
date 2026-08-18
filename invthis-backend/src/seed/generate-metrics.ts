import { Metric } from "../../src/entities/metric.entity";
import { Rng } from "./rng";
import { METRIC } from "../../src/common/metric-names";
import { BuiltInventory } from "./build-assets";
import { SEED_CONFIG } from "./seed.config";

export interface FailureScenario {
  assetId: string;
  assetName: string;
  domain: "server" | "disk" | "switch" | "storage" | "ups";
  precursorStartDay: number;
  failureDay: number;
  recoveryDay: number;
  incidentType: string;
  severity: "minor" | "major" | "critical";
  primaryMetric: string;
  rootCause: string;
  resolution: string;
  impact: string;
}

export interface ConfigChangeEffect {
  assetId: string;
  metricName: string;
  dayApplied: number;
  delta: number; // added to baseline from dayApplied onward
  changeType: string;
  beforeValue: string;
  afterValue: string;
  reason: string;
}

function addMetric(
  out: Metric[],
  assetId: string,
  metricName: string,
  value: number,
  unit: string,
  timestamp: string,
) {
  const m = new Metric();
  m.assetId = assetId;
  m.metricName = metricName;
  m.value = Math.round(value * 100) / 100;
  m.unit = unit;
  m.timestamp = timestamp;
  out.push(m);
}

function diurnal(dayFraction: number, amplitude: number): number {
  // Business-hours-shaped bump: higher during "daytime" (fraction 0.3-0.75), quieter at night.
  return (
    amplitude *
    Math.sin((dayFraction - 0.2) * Math.PI * 1.3) *
    (dayFraction > 0.2 && dayFraction < 0.85 ? 1 : 0.3)
  );
}

function weeklyBusyMultiplier(dayIndex: number): number {
  const dow = dayIndex % 7;
  return dow === 5 || dow === 6 ? 0.75 : 1; // weekends quieter
}

interface NormalSeriesOpts {
  baseline: number;
  diurnalAmplitude: number;
  noise: number;
  min: number;
  max: number;
  configEffect?: ConfigChangeEffect;
}

function normalValue(
  rng: Rng,
  dayIndex: number,
  dayFraction: number,
  opts: NormalSeriesOpts,
): number {
  let base = opts.baseline;
  if (opts.configEffect && dayIndex >= opts.configEffect.dayApplied)
    base += opts.configEffect.delta;
  const v =
    base +
    diurnal(dayFraction, opts.diurnalAmplitude) *
      weeklyBusyMultiplier(dayIndex) +
    rng.between(-opts.noise, opts.noise);
  return Math.max(opts.min, Math.min(opts.max, v));
}

/** Climbing precursor -> failure -> short outage -> recovery to baseline. Matches the brief's "65% -> 72% -> 81% -> 89% -> 95% -> incident" shape. */
function rampToFailureValue(
  rng: Rng,
  t: number,
  scenario: FailureScenario,
  baseline: number,
  peak: number,
  noise: number,
): number {
  if (t < scenario.precursorStartDay)
    return baseline + rng.between(-noise, noise);
  if (t < scenario.failureDay) {
    const progress =
      (t - scenario.precursorStartDay) /
      (scenario.failureDay - scenario.precursorStartDay);
    return (
      baseline +
      (peak - baseline) * progress ** 1.6 +
      rng.between(-noise * 0.6, noise * 0.6)
    );
  }
  if (t < scenario.recoveryDay)
    return peak + rng.between(-noise * 0.3, noise * 0.3);
  return baseline + rng.between(-noise, noise);
}

/** Declining precursor (battery health) -> failure -> replaced -> recovers to a healthy baseline. */
function rampDownValue(
  rng: Rng,
  t: number,
  scenario: FailureScenario,
  baseline: number,
  trough: number,
  noise: number,
): number {
  if (t < scenario.precursorStartDay)
    return baseline + rng.between(-noise, noise);
  if (t < scenario.failureDay) {
    const progress =
      (t - scenario.precursorStartDay) /
      (scenario.failureDay - scenario.precursorStartDay);
    return (
      baseline -
      (baseline - trough) * progress ** 1.4 +
      rng.between(-noise * 0.6, noise * 0.6)
    );
  }
  if (t < scenario.recoveryDay)
    return trough + rng.between(-noise * 0.3, noise * 0.3);
  return baseline + rng.between(-noise * 0.5, noise * 0.5); // fresh battery, slightly better than original baseline noise
}

/** Slow, mostly-monotonic growth over the whole window — storage filling up. */
function slowGrowthValue(
  rng: Rng,
  t: number,
  totalDays: number,
  start: number,
  end: number,
  noise: number,
): number {
  const progress = Math.min(1, t / totalDays);
  return start + (end - start) * progress + rng.between(-noise, noise);
}

export interface MetricBuildResult {
  metrics: Metric[];
  scenarios: FailureScenario[];
  configEffects: ConfigChangeEffect[];
}

export function buildMetrics(inv: BuiltInventory, rng: Rng): MetricBuildResult {
  const cfg = SEED_CONFIG;
  const totalDays = cfg.days;
  const now = Date.now();
  const startMs = now - totalDays * 86_400_000;
  const metrics: Metric[] = [];

  // ── Injected failure scenarios (section 21) ──────────────────────────
  const scenarios: FailureScenario[] = [];
  if (inv.servers.length) {
    scenarios.push({
      assetId: inv.servers[0].id,
      assetName: inv.servers[0].name,
      domain: "server",
      precursorStartDay: totalDays - 10,
      failureDay: totalDays - 4,
      recoveryDay: totalDays - 3.8,
      incidentType: "cpu_overload",
      severity: "critical",
      primaryMetric: METRIC.CPU_UTILIZATION_PCT,
      rootCause:
        "Runaway process consumed all available CPU, driving sustained saturation and thermal throttling.",
      resolution:
        "Process killed and server rebooted; workload rescheduled to a less-loaded host.",
      impact:
        "Hosted applications on this server experienced elevated latency and intermittent timeouts.",
    });
  }
  if (inv.disks.length) {
    scenarios.push({
      assetId: inv.disks[Math.min(1, inv.disks.length - 1)].id,
      assetName: inv.disks[Math.min(1, inv.disks.length - 1)].name,
      domain: "disk",
      precursorStartDay: totalDays - 14,
      failureDay: totalDays - 6,
      recoveryDay: totalDays - 5.7,
      incidentType: "disk_failure",
      severity: "critical",
      primaryMetric: METRIC.STORAGE_TEMPERATURE_C,
      rootCause:
        "Progressive reallocated-sector growth and rising latency indicated imminent drive failure; drive failed.",
      resolution: "Failed drive replaced; RAID array rebuilt from parity.",
      impact:
        "Array ran in degraded redundancy for the rebuild window; no data loss.",
    });
  }
  if (inv.switches.length) {
    scenarios.push({
      assetId: inv.switches[0].id,
      assetName: inv.switches[0].name,
      domain: "switch",
      precursorStartDay: totalDays - 22,
      failureDay: totalDays - 18,
      recoveryDay: totalDays - 17.9,
      incidentType: "switch_failure",
      severity: "major",
      primaryMetric: METRIC.PACKET_LOSS_PCT,
      rootCause:
        "A failing uplink transceiver produced rising CRC errors and packet loss until the port dropped.",
      resolution:
        "Transceiver replaced and port re-enabled; traffic rebalanced across remaining uplinks during the outage.",
      impact:
        "Reduced east-west bandwidth for devices behind this switch; brief connectivity loss during failover.",
    });
  }
  if (inv.storageArrays.length) {
    scenarios.push({
      assetId: inv.storageArrays[0].id,
      assetName: inv.storageArrays[0].name,
      domain: "storage",
      precursorStartDay: 0,
      failureDay: totalDays - 2,
      recoveryDay: totalDays - 2,
      incidentType: "storage_full",
      severity: "major",
      primaryMetric: METRIC.STORAGE_USAGE_PCT,
      rootCause:
        "Sustained, unthrottled data growth with no archival policy in place.",
      resolution:
        "Emergency capacity added and stale snapshots purged; archival policy scheduled as follow-up.",
      impact:
        "Write operations from dependent applications began failing once capacity was exhausted.",
    });
  }
  if (inv.upsList.length) {
    scenarios.push({
      assetId: inv.upsList[0].id,
      assetName: inv.upsList[0].name,
      domain: "ups",
      precursorStartDay: totalDays - 20,
      failureDay: totalDays - 9,
      recoveryDay: totalDays - 8.5,
      incidentType: "ups_failure",
      severity: "critical",
      primaryMetric: METRIC.UPS_BATTERY_PCT,
      rootCause:
        "Battery cells degraded well past rated cycle count; battery runtime collapsed under load.",
      resolution:
        "Battery pack replaced; UPS self-test passed post-replacement.",
      impact:
        "Racks powered by this UPS ran without redundant backup power until replacement completed.",
    });
  }
  const scenarioByAsset = new Map(scenarios.map((s) => [s.assetId, s]));

  // ── A config change with a real, visible effect on subsequent metrics ─
  const configEffects: ConfigChangeEffect[] = [];
  if (inv.servers.length > 1) {
    configEffects.push({
      assetId: inv.servers[1].id,
      metricName: METRIC.RAM_UTILIZATION_PCT,
      dayApplied: Math.floor(totalDays * 0.4),
      delta: -15,
      changeType: "ram_allocation",
      beforeValue: "64GB",
      afterValue: "128GB",
      reason:
        "Proactive capacity increase after sustained high memory utilization.",
    });
  }
  const configEffectByAssetMetric = new Map(
    configEffects.map((c) => [`${c.assetId}:${c.metricName}`, c]),
  );

  function timestampFor(dayIndex: number, minuteOfDay: number): string {
    return new Date(
      startMs + dayIndex * 86_400_000 + minuteOfDay * 60_000,
    ).toISOString();
  }

  function generateFor(
    assetId: string,
    metricName: string,
    unit: string,
    opts: NormalSeriesOpts,
    intervalMinutes: number,
    rampType?: "up" | "down" | "growth",
    rampBaseline?: number,
    rampExtreme?: number,
  ) {
    const scenario = scenarioByAsset.get(assetId);
    const isScenarioMetric = scenario && scenario.primaryMetric === metricName;
    const samplesPerDay = Math.floor(1440 / intervalMinutes);
    const configEffect = configEffectByAssetMetric.get(
      `${assetId}:${metricName}`,
    );
    const localOpts = configEffect ? { ...opts, configEffect } : opts;

    for (let day = 0; day < totalDays; day++) {
      for (let s = 0; s < samplesPerDay; s++) {
        const minuteOfDay = s * intervalMinutes;
        const t = day + minuteOfDay / 1440;
        let value: number;
        if (isScenarioMetric && rampType === "up") {
          value = rampToFailureValue(
            rng,
            t,
            scenario,
            rampBaseline!,
            rampExtreme!,
            opts.noise,
          );
        } else if (isScenarioMetric && rampType === "down") {
          value = rampDownValue(
            rng,
            t,
            scenario,
            rampBaseline!,
            rampExtreme!,
            opts.noise,
          );
        } else if (isScenarioMetric && rampType === "growth") {
          value = slowGrowthValue(
            rng,
            t,
            totalDays,
            rampBaseline!,
            rampExtreme!,
            opts.noise,
          );
        } else {
          value = normalValue(rng, day, minuteOfDay / 1440, localOpts);
        }
        addMetric(
          metrics,
          assetId,
          metricName,
          value,
          unit,
          timestampFor(day, minuteOfDay),
        );
      }
    }
  }

  // ── Servers ────────────────────────────────────────────────────────
  for (const server of inv.servers) {
    const scenario = scenarioByAsset.get(server.id);
    generateFor(
      server.id,
      METRIC.CPU_UTILIZATION_PCT,
      "%",
      { baseline: 35, diurnalAmplitude: 15, noise: 5, min: 1, max: 100 },
      cfg.criticalIntervalMinutes,
      scenario ? "up" : undefined,
      42,
      97,
    );
    generateFor(
      server.id,
      METRIC.RAM_UTILIZATION_PCT,
      "%",
      { baseline: 55, diurnalAmplitude: 8, noise: 4, min: 5, max: 98 },
      cfg.criticalIntervalMinutes,
    );
    generateFor(
      server.id,
      METRIC.DISK_UTILIZATION_PCT,
      "%",
      { baseline: 42, diurnalAmplitude: 2, noise: 1.5, min: 5, max: 99 },
      cfg.criticalIntervalMinutes,
    );
    // Temperature co-varies with CPU load — the same scenario climbs both, and even off-scenario servers get a small correlated wobble.
    generateFor(
      server.id,
      METRIC.CPU_TEMPERATURE_C,
      "°C",
      { baseline: 42, diurnalAmplitude: 4, noise: 2, min: 25, max: 95 },
      cfg.criticalIntervalMinutes,
      scenario ? "up" : undefined,
      44,
      88,
    );
    generateFor(
      server.id,
      METRIC.NETWORK_RX_MBPS,
      "Mbps",
      { baseline: 120, diurnalAmplitude: 60, noise: 20, min: 0, max: 950 },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      server.id,
      METRIC.UPTIME_HOURS,
      "hours",
      { baseline: 400, diurnalAmplitude: 0, noise: 0, min: 0, max: 100000 },
      cfg.environmentalIntervalMinutes,
    );
  }

  // ── Storage arrays ─────────────────────────────────────────────────
  for (const arr of inv.storageArrays) {
    const scenario = scenarioByAsset.get(arr.id);
    generateFor(
      arr.id,
      METRIC.STORAGE_USAGE_PCT,
      "%",
      { baseline: 45, diurnalAmplitude: 0, noise: 1, min: 5, max: 100 },
      cfg.criticalIntervalMinutes,
      scenario ? "growth" : undefined,
      45,
      99,
    );
    generateFor(
      arr.id,
      METRIC.STORAGE_READ_LATENCY_MS,
      "ms",
      { baseline: 2.5, diurnalAmplitude: 1, noise: 0.5, min: 0.2, max: 40 },
      cfg.criticalIntervalMinutes,
    );
    generateFor(
      arr.id,
      METRIC.STORAGE_READ_IOPS,
      "iops",
      {
        baseline: 3500,
        diurnalAmplitude: 1500,
        noise: 400,
        min: 100,
        max: 25000,
      },
      cfg.criticalIntervalMinutes,
    );
    generateFor(
      arr.id,
      METRIC.STORAGE_TEMPERATURE_C,
      "°C",
      { baseline: 32, diurnalAmplitude: 1, noise: 1, min: 18, max: 55 },
      cfg.environmentalIntervalMinutes,
    );
  }
  for (const disk of inv.disks) {
    const scenario = scenarioByAsset.get(disk.id);
    generateFor(
      disk.id,
      METRIC.DISK_UTILIZATION_PCT,
      "%",
      { baseline: 40, diurnalAmplitude: 10, noise: 3, min: 2, max: 99 },
      cfg.criticalIntervalMinutes,
    );
    generateFor(
      disk.id,
      METRIC.STORAGE_TEMPERATURE_C,
      "°C",
      { baseline: 34, diurnalAmplitude: 1, noise: 1, min: 20, max: 65 },
      cfg.environmentalIntervalMinutes,
      scenario ? "up" : undefined,
      35,
      62,
    );
    generateFor(
      disk.id,
      METRIC.STORAGE_REALLOCATED_SECTORS,
      "count",
      { baseline: 0, diurnalAmplitude: 0, noise: 0.3, min: 0, max: 500 },
      cfg.environmentalIntervalMinutes,
      scenario ? "up" : undefined,
      0,
      180,
    );
  }

  // ── Switches ───────────────────────────────────────────────────────
  for (const sw of inv.switches) {
    const scenario = scenarioByAsset.get(sw.id);
    generateFor(
      sw.id,
      METRIC.BANDWIDTH_UTILIZATION_PCT,
      "%",
      { baseline: 30, diurnalAmplitude: 20, noise: 6, min: 1, max: 100 },
      cfg.criticalIntervalMinutes,
    );
    generateFor(
      sw.id,
      METRIC.PACKET_LOSS_PCT,
      "%",
      { baseline: 0.02, diurnalAmplitude: 0, noise: 0.03, min: 0, max: 15 },
      cfg.criticalIntervalMinutes,
      scenario ? "up" : undefined,
      0.03,
      9,
    );
    generateFor(
      sw.id,
      METRIC.CRC_ERRORS,
      "count",
      { baseline: 0, diurnalAmplitude: 0, noise: 0.5, min: 0, max: 5000 },
      cfg.criticalIntervalMinutes,
      scenario ? "up" : undefined,
      0,
      2200,
    );
    generateFor(
      sw.id,
      METRIC.SWITCH_CPU_PCT,
      "%",
      { baseline: 18, diurnalAmplitude: 8, noise: 3, min: 1, max: 95 },
      cfg.criticalIntervalMinutes,
    );
    generateFor(
      sw.id,
      METRIC.SWITCH_TEMPERATURE_C,
      "°C",
      { baseline: 36, diurnalAmplitude: 2, noise: 1.5, min: 20, max: 70 },
      cfg.environmentalIntervalMinutes,
    );
  }

  // ── Router / Firewall / Load balancer ─────────────────────────────
  for (const r of inv.routers) {
    generateFor(
      r.id,
      METRIC.ROUTER_CPU_PCT,
      "%",
      { baseline: 22, diurnalAmplitude: 10, noise: 4, min: 1, max: 95 },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      r.id,
      METRIC.BANDWIDTH_UTILIZATION_PCT,
      "%",
      { baseline: 40, diurnalAmplitude: 25, noise: 6, min: 1, max: 100 },
      cfg.standardIntervalMinutes,
    );
  }
  for (const fw of inv.firewalls) {
    generateFor(
      fw.id,
      METRIC.FIREWALL_ACTIVE_SESSIONS,
      "count",
      {
        baseline: 4200,
        diurnalAmplitude: 1800,
        noise: 300,
        min: 50,
        max: 50000,
      },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      fw.id,
      METRIC.FIREWALL_BLOCKED_TRAFFIC_PCT,
      "%",
      { baseline: 3, diurnalAmplitude: 1, noise: 1, min: 0, max: 40 },
      cfg.standardIntervalMinutes,
    );
  }
  for (const lb of inv.loadBalancers) {
    generateFor(
      lb.id,
      METRIC.LB_REQUESTS_PER_SEC,
      "rps",
      { baseline: 850, diurnalAmplitude: 500, noise: 90, min: 5, max: 10000 },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      lb.id,
      METRIC.LB_RESPONSE_TIME_MS,
      "ms",
      { baseline: 120, diurnalAmplitude: 40, noise: 20, min: 10, max: 5000 },
      cfg.standardIntervalMinutes,
    );
  }

  // ── UPS / PDU / power ──────────────────────────────────────────────
  for (const ups of inv.upsList) {
    const scenario = scenarioByAsset.get(ups.id);
    generateFor(
      ups.id,
      METRIC.UPS_BATTERY_PCT,
      "%",
      { baseline: 96, diurnalAmplitude: 0, noise: 1, min: 0, max: 100 },
      cfg.environmentalIntervalMinutes,
      scenario ? "down" : undefined,
      96,
      22,
    );
    generateFor(
      ups.id,
      METRIC.UPS_LOAD_PCT,
      "%",
      { baseline: 45, diurnalAmplitude: 10, noise: 4, min: 5, max: 100 },
      cfg.environmentalIntervalMinutes,
    );
    generateFor(
      ups.id,
      METRIC.UPS_BATTERY_TEMPERATURE_C,
      "°C",
      { baseline: 27, diurnalAmplitude: 1, noise: 1, min: 15, max: 60 },
      cfg.environmentalIntervalMinutes,
      scenario ? "up" : undefined,
      27,
      48,
    );
  }
  for (const pdu of inv.pdus) {
    generateFor(
      pdu.id,
      METRIC.PDU_LOAD_PCT,
      "%",
      { baseline: 38, diurnalAmplitude: 12, noise: 4, min: 2, max: 100 },
      cfg.environmentalIntervalMinutes,
    );
  }

  // ── Environmental — correlated with rack occupants' temperatures ─────
  const serverTempByRackDay = new Map<string, number[]>();
  for (const m of metrics) {
    if (m.metricName !== METRIC.CPU_TEMPERATURE_C) continue;
    const rackId = inv.rackOfAsset.get(m.assetId);
    if (!rackId) continue;
    const key = `${rackId}:${m.timestamp.slice(0, 10)}`;
    if (!serverTempByRackDay.has(key)) serverTempByRackDay.set(key, []);
    serverTempByRackDay.get(key)!.push(m.value);
  }
  for (const rack of inv.racks) {
    for (let day = 0; day < totalDays; day++) {
      const dateKey = new Date(startMs + day * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const key = `${rack.id}:${dateKey}`;
      const serverTemps = serverTempByRackDay.get(key) ?? [];
      const avgServerTemp = serverTemps.length
        ? serverTemps.reduce((a, b) => a + b, 0) / serverTemps.length
        : 42;
      // Rack temperature tracks server heat output — not an independent random value.
      const rackTemp =
        22 + (avgServerTemp - 42) * 0.25 + rng.between(-0.8, 0.8);
      addMetric(
        metrics,
        rack.id,
        METRIC.RACK_TEMPERATURE_C,
        rackTemp,
        "°C",
        timestampFor(day, 720),
      );
    }
  }
  for (const dc of inv.dataCenters) {
    for (let day = 0; day < totalDays; day++) {
      addMetric(
        metrics,
        dc.id,
        METRIC.ROOM_TEMPERATURE_C,
        21 + rng.between(-1, 1),
        "°C",
        timestampFor(day, 720),
      );
      addMetric(
        metrics,
        dc.id,
        METRIC.HUMIDITY_PCT,
        45 + rng.between(-5, 5),
        "%",
        timestampFor(day, 720),
      );
    }
  }

  // ── Applications & databases ───────────────────────────────────────
  for (const app of inv.applications) {
    generateFor(
      app.id,
      METRIC.APP_REQUESTS_PER_SEC,
      "rps",
      { baseline: 60, diurnalAmplitude: 45, noise: 10, min: 0, max: 2000 },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      app.id,
      METRIC.APP_RESPONSE_TIME_MS,
      "ms",
      { baseline: 90, diurnalAmplitude: 30, noise: 15, min: 5, max: 5000 },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      app.id,
      METRIC.APP_ERROR_RATE_PCT,
      "%",
      { baseline: 0.4, diurnalAmplitude: 0.2, noise: 0.3, min: 0, max: 25 },
      cfg.standardIntervalMinutes,
    );
  }
  for (const db of inv.databases) {
    generateFor(
      db.id,
      METRIC.DB_QUERY_LATENCY_MS,
      "ms",
      { baseline: 8, diurnalAmplitude: 4, noise: 2, min: 0.5, max: 500 },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      db.id,
      METRIC.DB_ACTIVE_CONNECTIONS,
      "count",
      { baseline: 40, diurnalAmplitude: 25, noise: 6, min: 1, max: 500 },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      db.id,
      METRIC.DB_SLOW_QUERIES,
      "count",
      { baseline: 0.5, diurnalAmplitude: 0.5, noise: 0.5, min: 0, max: 100 },
      cfg.standardIntervalMinutes,
    );
    generateFor(
      db.id,
      METRIC.DB_SIZE_GB,
      "GB",
      { baseline: 80, diurnalAmplitude: 0, noise: 0.2, min: 1, max: 5000 },
      cfg.environmentalIntervalMinutes,
    );
  }

  return { metrics, scenarios, configEffects };
}
