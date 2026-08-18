import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Long-format (EAV) time series — one row per (asset, metric, timestamp).
// This is the single table every domain's numeric history lives in:
// cpu_utilization_pct, disk_read_iops, port_rx_bytes, ups_battery_pct,
// room_temperature_c, app_requests_per_sec, db_query_latency_ms — all the
// same shape. A wide table per asset type (server_metrics, switch_metrics,
// router_metrics, ...) would mean 10+ near-duplicate schemas; this scales
// to any new metric without a migration, and is the standard shape a
// feature-engineering pipeline expects to read from.
@Entity("metrics")
@Index(["assetId", "timestamp"])
@Index(["assetId", "metricName", "timestamp"])
export class Metric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  assetId: string;

  @Column()
  metricName: string;

  @Column("real")
  value: number;

  @Column({ type: "varchar", nullable: true })
  unit: string | null;

  /** ISO 8601. Stored as text (SQLite has no native datetime type) but always UTC and sortable. */
  @Column()
  timestamp: string;
}
