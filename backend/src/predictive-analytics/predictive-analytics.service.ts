import { Injectable } from '@nestjs/common';
import {
  DeviceDataService,
  ServerDoc,
  StorageDoc,
  SwitchDoc,
} from './device-data.service';
import {
  DEFAULT_STATUS_RISK,
  MAX_AGE_YEARS,
  MIN_SNAPSHOTS_FOR_TREND,
  PORT_THRESHOLDS,
  RISK_BANDS,
  SERVER_THRESHOLDS,
  STATUS_RISK,
  STORAGE_THRESHOLDS,
} from './config';
import {
  ageYears,
  clamp,
  daysToThreshold,
  linearTrendFromSamples,
  pct,
  weightedScore,
} from './trend.util';

type RiskBand = 'critical' | 'warning' | 'healthy';

function bandFor(score: number): RiskBand {
  if (score >= RISK_BANDS.critical) return 'critical';
  if (score >= RISK_BANDS.warning) return 'warning';
  return 'healthy';
}

function statusRisk(status: string): number {
  return STATUS_RISK[status] ?? DEFAULT_STATUS_RISK;
}

function ageComponentOf(age: number | null): number {
  return age == null ? 40 : clamp((age / MAX_AGE_YEARS) * 100, 0, 100);
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

interface MetricResult {
  currentPct: number;
  trendPctPerDay: number;
  confidence: number | null;
  daysToCritical: number | null;
  criticalThreshold: number;
  hasHistory: boolean;
  history: number[];
  historyDates: string[];
}

function buildMetric(
  current: number,
  history: { timestamp: Date; value: number }[],
  threshold: number,
): MetricResult {
  const hasHistory = history.length >= MIN_SNAPSHOTS_FOR_TREND;
  const sorted = [...history].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const trend = hasHistory ? linearTrendFromSamples(sorted) : null;

  return {
    currentPct: current,
    trendPctPerDay: trend ? round3(trend.slopePerDay) : 0,
    confidence: trend ? trend.r2 : null,
    daysToCritical: trend
      ? daysToThreshold(current, trend.slopePerDay, threshold)
      : null,
    criticalThreshold: threshold,
    hasHistory,
    history: sorted.map((h) => h.value),
    historyDates: sorted.map((h) => h.timestamp.toISOString().slice(0, 10)),
  };
}

export interface ServerPrediction {
  id: string;
  name: string;
  role: string | null;
  location: string | null;
  status: string;
  ageYears: number | null;
  cpu: MetricResult;
  ram: MetricResult;
  disk: MetricResult;
  riskScore: number;
  riskBand: RiskBand;
  recommendation: string;
}

export interface StoragePrediction {
  id: string;
  name: string;
  type: string | null;
  location: string | null;
  status: string;
  ageYears: number | null;
  capacity: MetricResult;
  latency: MetricResult;
  riskScore: number;
  riskBand: RiskBand;
  recommendation: string;
}

export interface SwitchPrediction {
  id: string;
  name: string;
  model: string | null;
  location: string | null;
  status: string;
  ageYears: number | null;
  portUtilization: MetricResult | null;
  riskScore: number;
  riskBand: RiskBand;
  recommendation: string;
}

@Injectable()
export class PredictiveAnalyticsService {
  constructor(private readonly deviceData: DeviceDataService) {}

  async predictServers(): Promise<ServerPrediction[]> {
    const servers = await this.deviceData.getServers();

    return servers
      .map((s: ServerDoc) => {
        const age = ageYears(s.createdAt);
        const ageComponent = ageComponentOf(age);
        const statusComponent = statusRisk(s.status);

        const cpu = buildMetric(
          s.cpuUsage,
          s.cpuHistory,
          SERVER_THRESHOLDS.cpuCriticalPct,
        );
        const ram = buildMetric(
          pct(s.ramUsedGb, s.ramTotalGb),
          s.ramHistory,
          SERVER_THRESHOLDS.ramCriticalPct,
        );
        const disk = buildMetric(
          pct(s.storageUsedGb, s.storageTotalGb),
          s.diskHistory,
          SERVER_THRESHOLDS.diskCriticalPct,
        );

        const utilNowComponent = Math.max(
          clamp(
            (cpu.currentPct / SERVER_THRESHOLDS.cpuCriticalPct) * 100,
            0,
            100,
          ),
          clamp(
            (ram.currentPct / SERVER_THRESHOLDS.ramCriticalPct) * 100,
            0,
            100,
          ),
        );
        const diskNowComponent = clamp(
          (disk.currentPct / SERVER_THRESHOLDS.diskCriticalPct) * 100,
          0,
          100,
        );
        const hasAnyHistory = cpu.hasHistory || ram.hasHistory;
        const utilTrendComponent = hasAnyHistory
          ? clamp(Math.max(cpu.trendPctPerDay, ram.trendPctPerDay) * 20, 0, 100)
          : 0;

        const riskScore = weightedScore([
          { value: ageComponent, weight: 0.15 },
          { value: statusComponent, weight: 0.25 },
          { value: utilNowComponent, weight: 0.3 },
          { value: diskNowComponent, weight: 0.1 },
          { value: utilTrendComponent, weight: 0.2, available: hasAnyHistory },
        ]);
        const riskBand = bandFor(riskScore);

        const recommendation = buildServerRecommendation({
          riskBand,
          status: s.status,
          cpuDaysToCritical: cpu.daysToCritical,
          ramDaysToCritical: ram.daysToCritical,
          hasAnyHistory,
        });

        return {
          id: s.id,
          name: s.name,
          role: s.role,
          location: s.location,
          status: s.status,
          ageYears: age == null ? null : Math.round(age * 10) / 10,
          cpu,
          ram,
          disk,
          riskScore,
          riskBand,
          recommendation,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  async predictStorage(): Promise<StoragePrediction[]> {
    const storage = await this.deviceData.getStorage();

    return storage
      .map((s: StorageDoc) => {
        const age = ageYears(s.createdAt);
        const ageComponent = ageComponentOf(age);
        const statusComponent = statusRisk(s.status);

        const capacity = buildMetric(
          pct(s.capacityUsedGb, s.capacityTotalGb),
          s.capacityHistory,
          STORAGE_THRESHOLDS.capacityCriticalPct,
        );
        const latency = buildMetric(
          s.latencyMs,
          s.latencyHistory,
          STORAGE_THRESHOLDS.latencyCriticalMs,
        );

        const capNowComponent = clamp(
          (capacity.currentPct / STORAGE_THRESHOLDS.capacityCriticalPct) * 100,
          0,
          100,
        );
        const latNowComponent = clamp(
          (latency.currentPct / STORAGE_THRESHOLDS.latencyCriticalMs) * 100,
          0,
          100,
        );

        const riskScore = weightedScore([
          { value: ageComponent, weight: 0.15 },
          { value: statusComponent, weight: 0.2 },
          { value: capNowComponent, weight: 0.35 },
          { value: latNowComponent, weight: 0.1 },
          {
            value: clamp(capacity.trendPctPerDay * 25, 0, 100),
            weight: 0.15,
            available: capacity.hasHistory,
          },
          {
            value: clamp(latency.trendPctPerDay * 10, 0, 100),
            weight: 0.05,
            available: latency.hasHistory,
          },
        ]);
        const riskBand = bandFor(riskScore);

        const recommendation = buildStorageRecommendation({
          riskBand,
          status: s.status,
          daysToFull: capacity.daysToCritical,
          latDaysToCritical: latency.daysToCritical,
          hasAnyHistory: capacity.hasHistory || latency.hasHistory,
        });

        return {
          id: s.id,
          name: s.name,
          type: s.type,
          location: s.location,
          status: s.status,
          ageYears: age == null ? null : Math.round(age * 10) / 10,
          capacity,
          latency,
          riskScore,
          riskBand,
          recommendation,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  async predictSwitches(): Promise<SwitchPrediction[]> {
    const switches = await this.deviceData.getSwitches();

    return switches
      .map((s: SwitchDoc) => {
        const age = ageYears(s.createdAt);
        const ageComponent = ageComponentOf(age);
        const statusComponent = statusRisk(s.status);

        // Port utilization is the switch analogue of storage capacity: a
        // real, derived metric (ports marked Up in the Ports tab, out of
        // the device's configured Port Count) rather than a fabricated
        // number. Only scored once a Port Count is set — otherwise there's
        // no honest denominator to compute a percentage against.
        const hasPortCount = s.portCount > 0;
        const portUtilization = hasPortCount
          ? buildMetric(
              pct(s.portsUp, s.portCount),
              s.portUtilizationHistory,
              PORT_THRESHOLDS.portUtilCriticalPct,
            )
          : null;

        const portNowComponent = portUtilization
          ? clamp(
              (portUtilization.currentPct /
                PORT_THRESHOLDS.portUtilCriticalPct) *
                100,
              0,
              100,
            )
          : 0;
        const portTrendComponent = portUtilization?.hasHistory
          ? clamp(portUtilization.trendPctPerDay * 25, 0, 100)
          : 0;

        const riskScore = weightedScore([
          { value: ageComponent, weight: 0.25 },
          { value: statusComponent, weight: 0.35 },
          {
            value: portNowComponent,
            weight: 0.25,
            available: !!portUtilization,
          },
          {
            value: portTrendComponent,
            weight: 0.15,
            available: !!portUtilization?.hasHistory,
          },
        ]);
        const riskBand = bandFor(riskScore);

        const recommendation = buildSwitchRecommendation({
          riskBand,
          status: s.status,
          daysToPortExhaustion: portUtilization?.daysToCritical ?? null,
          hasPortCount,
        });

        return {
          id: s.id,
          name: s.name,
          model: s.model,
          location: s.location,
          status: s.status,
          ageYears: age == null ? null : Math.round(age * 10) / 10,
          portUtilization,
          riskScore,
          riskBand,
          recommendation,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }
}

function buildServerRecommendation(args: {
  riskBand: RiskBand;
  status: string;
  cpuDaysToCritical: number | null;
  ramDaysToCritical: number | null;
  hasAnyHistory: boolean;
}): string {
  const {
    riskBand,
    status,
    cpuDaysToCritical,
    ramDaysToCritical,
    hasAnyHistory,
  } = args;
  if (status === 'Critical')
    return 'Reported status is Critical — investigate immediately.';
  if (cpuDaysToCritical === 0 || ramDaysToCritical === 0)
    return 'CPU or RAM is already at/above its critical threshold — plan workload migration or upgrade now.';
  if (cpuDaysToCritical != null && cpuDaysToCritical < 60)
    return `CPU utilization trending to saturation in ~${cpuDaysToCritical}d — plan workload migration or upgrade.`;
  if (ramDaysToCritical != null && ramDaysToCritical < 60)
    return `RAM utilization trending to saturation in ~${ramDaysToCritical}d — plan memory upgrade.`;
  if (status === 'Offline')
    return 'Reported status is Offline — verify connectivity and monitoring.';
  if (status === 'Warning')
    return 'Reported status is Warning — review recent alerts on this server.';
  if (!hasAnyHistory)
    return 'No trend yet — log a few performance snapshots on this server to unlock forecasting.';
  if (riskBand === 'healthy') return 'Stable — no action needed.';
  return 'Monitor — trending components are within tolerance but worth a periodic check.';
}

function buildStorageRecommendation(args: {
  riskBand: RiskBand;
  status: string;
  daysToFull: number | null;
  latDaysToCritical: number | null;
  hasAnyHistory: boolean;
}): string {
  const { riskBand, status, daysToFull, latDaysToCritical, hasAnyHistory } =
    args;
  if (status === 'Critical')
    return 'Reported status is Critical — investigate immediately.';
  if (daysToFull === 0)
    return 'Already at or above capacity — plan expansion or archival now.';
  if (daysToFull != null && daysToFull < 60)
    return `Projected to reach full capacity in ~${daysToFull}d — plan expansion or archival now.`;
  if (latDaysToCritical != null && latDaysToCritical < 60)
    return `Latency trending to critical in ~${latDaysToCritical}d — investigate I/O contention.`;
  if (status === 'Offline')
    return 'Reported status is Offline — verify connectivity and monitoring.';
  if (status === 'Warning')
    return 'Reported status is Warning — review recent alerts on this array.';
  if (!hasAnyHistory)
    return 'No trend yet — log a few performance snapshots on this array to unlock forecasting.';
  if (riskBand === 'healthy') return 'Stable — no action needed.';
  return 'Monitor — trending components are within tolerance but worth a periodic check.';
}

function buildSwitchRecommendation(args: {
  riskBand: RiskBand;
  status: string;
  daysToPortExhaustion: number | null;
  hasPortCount: boolean;
}): string {
  const { riskBand, status, daysToPortExhaustion, hasPortCount } = args;
  if (status === 'Critical')
    return 'Reported status is Critical — investigate immediately.';
  if (daysToPortExhaustion === 0)
    return 'All tracked ports are in use — plan an expansion or uplink before adding new devices.';
  if (daysToPortExhaustion != null && daysToPortExhaustion < 60)
    return `Projected to run out of free ports in ~${daysToPortExhaustion}d — plan an expansion or uplink.`;
  if (status === 'Offline')
    return 'Reported status is Offline — verify connectivity.';
  if (status === 'Warning')
    return 'Reported status is Warning — review recent alerts on this switch.';
  if (!hasPortCount)
    return 'Set a Port Count on this device and log a few port-utilization snapshots to unlock capacity forecasting.';
  if (riskBand === 'healthy') return 'Stable — no action needed.';
  return 'Monitor — port utilization is within tolerance but worth a periodic check.';
}
