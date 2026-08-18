import { AssetType } from "../../entities/asset.entity";
import { METRIC } from "../../common/metric-names";

export interface FeatureMetricMap {
  cpu?: string;
  ram?: string;
  storage?: string;
  bandwidth?: string;
  packetLoss?: string;
  errorRate?: string;
  temperature?: string;
}

// Which real metric feeds which feature group, per asset type — not every
// asset has every dimension (a switch has no RAM metric, a disk has no
// CPU), so most rows only populate a subset of predictive_features' columns.
// That's intentional: an unpopulated column means "not applicable to this
// asset," not "unknown."
export const FEATURE_METRIC_MAP: Partial<Record<AssetType, FeatureMetricMap>> =
  {
    [AssetType.SERVER]: {
      cpu: METRIC.CPU_UTILIZATION_PCT,
      ram: METRIC.RAM_UTILIZATION_PCT,
      storage: METRIC.DISK_UTILIZATION_PCT,
      temperature: METRIC.CPU_TEMPERATURE_C,
    },
    [AssetType.VM]: {
      cpu: METRIC.CPU_UTILIZATION_PCT,
      ram: METRIC.RAM_UTILIZATION_PCT,
    },
    [AssetType.STORAGE_DEVICE]: {
      storage: METRIC.STORAGE_USAGE_PCT,
      temperature: METRIC.STORAGE_TEMPERATURE_C,
    },
    [AssetType.STORAGE_ARRAY]: {
      storage: METRIC.STORAGE_USAGE_PCT,
      temperature: METRIC.STORAGE_TEMPERATURE_C,
    },
    [AssetType.DISK]: {
      storage: METRIC.DISK_UTILIZATION_PCT,
      temperature: METRIC.STORAGE_TEMPERATURE_C,
    },
    [AssetType.SWITCH]: {
      cpu: METRIC.SWITCH_CPU_PCT,
      bandwidth: METRIC.BANDWIDTH_UTILIZATION_PCT,
      packetLoss: METRIC.PACKET_LOSS_PCT,
      temperature: METRIC.SWITCH_TEMPERATURE_C,
    },
    [AssetType.ROUTER]: {
      cpu: METRIC.ROUTER_CPU_PCT,
      bandwidth: METRIC.BANDWIDTH_UTILIZATION_PCT,
    },
    [AssetType.FIREWALL]: {
      bandwidth: METRIC.FIREWALL_BLOCKED_TRAFFIC_PCT,
    },
    [AssetType.LOAD_BALANCER]: {
      errorRate: METRIC.APP_ERROR_RATE_PCT,
    },
    [AssetType.UPS]: {
      ram: METRIC.UPS_BATTERY_PCT,
      temperature: METRIC.UPS_BATTERY_TEMPERATURE_C,
    },
    [AssetType.APPLICATION]: {
      errorRate: METRIC.APP_ERROR_RATE_PCT,
    },
    [AssetType.DATABASE]: {
      errorRate: METRIC.DB_SLOW_QUERIES,
    },
    [AssetType.RACK]: {
      temperature: METRIC.RACK_TEMPERATURE_C,
    },
    [AssetType.DATA_CENTER]: {
      temperature: METRIC.ROOM_TEMPERATURE_C,
    },
  };
