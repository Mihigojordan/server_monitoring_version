import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// One row = one (asset, computedAt) snapshot — the wide shape an ML training
// table needs, one example per row. Computed strictly from metrics/events/
// incidents dated <= computedAt (see FeaturesService) — never from anything
// that happened after, or a model trained on this would be cheating.
@Entity("predictive_features")
@Index(["assetId", "computedAt"])
export class PredictiveFeature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  assetId: string;

  @Column()
  computedAt: string;

  @Column("real", { nullable: true }) cpuAvg5m: number | null;
  @Column("real", { nullable: true }) cpuAvg15m: number | null;
  @Column("real", { nullable: true }) cpuAvg1h: number | null;
  @Column("real", { nullable: true }) cpuAvg6h: number | null;
  @Column("real", { nullable: true }) cpuAvg24h: number | null;
  @Column("real", { nullable: true }) cpuMax1h: number | null;
  @Column("real", { nullable: true }) cpuGrowthRate: number | null;
  @Column("real", { nullable: true }) cpuVariance: number | null;

  @Column("real", { nullable: true }) ramAvg1h: number | null;
  @Column("real", { nullable: true }) ramAvg24h: number | null;
  @Column("real", { nullable: true }) ramGrowthRate: number | null;
  @Column("real", { nullable: true }) ramVariance: number | null;

  @Column("real", { nullable: true }) storageUsage: number | null;
  @Column("real", { nullable: true }) storageGrowthRate: number | null;
  @Column("real", { nullable: true }) estimatedDaysTo80: number | null;
  @Column("real", { nullable: true }) estimatedDaysTo90: number | null;
  @Column("real", { nullable: true }) estimatedDaysTo95: number | null;
  @Column("real", { nullable: true }) estimatedDaysToFull: number | null;

  @Column("real", { nullable: true }) bandwidthAvg: number | null;
  @Column("real", { nullable: true }) bandwidthPeak: number | null;
  @Column("real", { nullable: true }) packetLossRate: number | null;
  @Column("real", { nullable: true }) errorRate: number | null;
  @Column("real", { nullable: true }) trafficGrowthRate: number | null;

  @Column("real", { nullable: true }) temperatureAvg: number | null;
  @Column("real", { nullable: true }) temperatureMax: number | null;
  @Column("real", { nullable: true }) temperatureGrowthRate: number | null;

  @Column("int", { nullable: true }) errorsLast5m: number | null;
  @Column("int", { nullable: true }) errorsLast1h: number | null;
  @Column("int", { nullable: true }) errorsLast24h: number | null;
  @Column("int", { nullable: true }) criticalErrorsLast24h: number | null;

  @Column("int", { nullable: true }) incidentCount7d: number | null;
  @Column("int", { nullable: true }) incidentCount30d: number | null;
  @Column("int", { nullable: true }) restartCount7d: number | null;
  @Column("real", { nullable: true }) maintenanceAgeDays: number | null;
  @Column("real", { nullable: true }) daysSinceLastFailure: number | null;
}
