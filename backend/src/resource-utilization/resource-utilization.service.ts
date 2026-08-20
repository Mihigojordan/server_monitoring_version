import { Injectable } from '@nestjs/common';
import { DeviceDataService } from '../predictive-analytics/device-data.service';
import { clamp, pct } from '../predictive-analytics/trend.util';

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function mean(values: number[]): number | null {
  return values.length
    ? round1(values.reduce((s, v) => s + v, 0) / values.length)
    : null;
}

export interface ServerUtilizationDevice {
  id: string;
  name: string;
  role: string | null;
  location: string | null;
  status: string;
  cpuPct: number;
  ramUsedGb: number;
  ramTotalGb: number;
  ramPct: number;
  diskUsedGb: number;
  diskTotalGb: number;
  diskPct: number;
}

export interface StorageUtilizationDevice {
  id: string;
  name: string;
  type: string | null;
  location: string | null;
  status: string;
  capacityUsedGb: number;
  capacityTotalGb: number;
  capacityPct: number;
  latencyMs: number;
  iops: number;
  throughputMbps: number;
}

export interface SwitchUtilizationDevice {
  id: string;
  name: string;
  model: string | null;
  location: string | null;
  status: string;
  portCount: number;
  portsUp: number;
  portPct: number | null;
}

export interface ResourceUtilizationSummary {
  generatedAt: string;
  servers: {
    devices: ServerUtilizationDevice[];
    fleet: {
      count: number;
      avgCpuPct: number | null;
      totalRamUsedGb: number;
      totalRamTotalGb: number;
      ramPct: number;
      totalDiskUsedGb: number;
      totalDiskTotalGb: number;
      diskPct: number;
    };
  };
  storage: {
    devices: StorageUtilizationDevice[];
    fleet: {
      count: number;
      totalCapacityUsedGb: number;
      totalCapacityTotalGb: number;
      capacityPct: number;
      avgLatencyMs: number | null;
      totalIops: number;
      totalThroughputMbps: number;
    };
  };
  switches: {
    devices: SwitchUtilizationDevice[];
    fleet: {
      count: number;
      totalPorts: number;
      totalPortsUp: number;
      portPct: number | null;
      statusCounts: Record<string, number>;
    };
  };
}

/**
 * "How full is the fleet right now" — current-value utilization across
 * servers/storage/switches, read live from the same Firestore collections
 * Device Management and Predictive Analytics use. Deliberately separate
 * from PredictiveAnalyticsService: this is today's snapshot and fleet-wide
 * totals in real units (GB, IOPS, ports), not risk scoring or forecasting.
 */
@Injectable()
export class ResourceUtilizationService {
  constructor(private readonly deviceData: DeviceDataService) {}

  async getSummary(): Promise<ResourceUtilizationSummary> {
    const [servers, storage, switches] = await Promise.all([
      this.deviceData.getServers(),
      this.deviceData.getStorage(),
      this.deviceData.getSwitches(),
    ]);

    const serverDevices: ServerUtilizationDevice[] = servers.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      location: s.location,
      status: s.status,
      cpuPct: s.cpuUsage,
      ramUsedGb: s.ramUsedGb,
      ramTotalGb: s.ramTotalGb,
      ramPct: pct(s.ramUsedGb, s.ramTotalGb),
      diskUsedGb: s.storageUsedGb,
      diskTotalGb: s.storageTotalGb,
      diskPct: pct(s.storageUsedGb, s.storageTotalGb),
    }));
    const totalRamUsedGb = round1(
      serverDevices.reduce((sum, d) => sum + d.ramUsedGb, 0),
    );
    const totalRamTotalGb = round1(
      serverDevices.reduce((sum, d) => sum + d.ramTotalGb, 0),
    );
    const totalDiskUsedGb = round1(
      serverDevices.reduce((sum, d) => sum + d.diskUsedGb, 0),
    );
    const totalDiskTotalGb = round1(
      serverDevices.reduce((sum, d) => sum + d.diskTotalGb, 0),
    );

    const storageDevices: StorageUtilizationDevice[] = storage.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      location: s.location,
      status: s.status,
      capacityUsedGb: s.capacityUsedGb,
      capacityTotalGb: s.capacityTotalGb,
      capacityPct: pct(s.capacityUsedGb, s.capacityTotalGb),
      latencyMs: s.latencyMs,
      iops: s.iops,
      throughputMbps: s.throughputMbps,
    }));
    const totalCapacityUsedGb = round1(
      storageDevices.reduce((sum, d) => sum + d.capacityUsedGb, 0),
    );
    const totalCapacityTotalGb = round1(
      storageDevices.reduce((sum, d) => sum + d.capacityTotalGb, 0),
    );

    const switchDevices: SwitchUtilizationDevice[] = switches.map((s) => ({
      id: s.id,
      name: s.name,
      model: s.model,
      location: s.location,
      status: s.status,
      portCount: s.portCount,
      portsUp: s.portsUp,
      portPct: s.portCount > 0 ? pct(s.portsUp, s.portCount) : null,
    }));
    const totalPorts = switchDevices.reduce((sum, d) => sum + d.portCount, 0);
    const totalPortsUp = switchDevices.reduce((sum, d) => sum + d.portsUp, 0);
    const statusCounts: Record<string, number> = {};
    for (const d of switchDevices) {
      statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
    }

    return {
      generatedAt: new Date().toISOString(),
      servers: {
        devices: serverDevices,
        fleet: {
          count: serverDevices.length,
          avgCpuPct: mean(serverDevices.map((d) => d.cpuPct)),
          totalRamUsedGb,
          totalRamTotalGb,
          ramPct: pct(totalRamUsedGb, totalRamTotalGb),
          totalDiskUsedGb,
          totalDiskTotalGb,
          diskPct: pct(totalDiskUsedGb, totalDiskTotalGb),
        },
      },
      storage: {
        devices: storageDevices,
        fleet: {
          count: storageDevices.length,
          totalCapacityUsedGb,
          totalCapacityTotalGb,
          capacityPct: pct(totalCapacityUsedGb, totalCapacityTotalGb),
          avgLatencyMs: mean(storageDevices.map((d) => d.latencyMs)),
          totalIops: storageDevices.reduce((sum, d) => sum + d.iops, 0),
          totalThroughputMbps: storageDevices.reduce(
            (sum, d) => sum + d.throughputMbps,
            0,
          ),
        },
      },
      switches: {
        devices: switchDevices,
        fleet: {
          count: switchDevices.length,
          totalPorts,
          totalPortsUp,
          portPct:
            totalPorts > 0
              ? clamp(pct(totalPortsUp, totalPorts), 0, 100)
              : null,
          statusCounts,
        },
      },
    };
  }
}
