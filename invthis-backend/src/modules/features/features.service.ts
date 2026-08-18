import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Metric } from "../../entities/metric.entity";
import { LogEntry, LogSeverity } from "../../entities/log-entry.entity";
import { PredictiveFeature } from "../../entities/predictive-feature.entity";
import { Asset } from "../../entities/asset.entity";
import { IncidentsService } from "../incidents/incidents.service";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { FEATURE_METRIC_MAP } from "./feature-metric-map";
import {
  avg,
  daysToThreshold,
  growthRatePerDay,
  max,
  pointsSince,
  variance,
  Point,
} from "./stats.util";

const LOOKBACK_DAYS = 30;

@Injectable()
export class FeaturesService {
  constructor(
    @InjectRepository(Metric) private readonly metrics: Repository<Metric>,
    @InjectRepository(LogEntry) private readonly logs: Repository<LogEntry>,
    @InjectRepository(PredictiveFeature)
    private readonly features: Repository<PredictiveFeature>,
    private readonly incidents: IncidentsService,
    private readonly maintenance: MaintenanceService,
  ) {}

  private async loadWindow(
    assetId: string,
    metricName: string,
    asOf: Date,
  ): Promise<Point[]> {
    const windowStart = new Date(
      asOf.getTime() - LOOKBACK_DAYS * 86_400_000,
    ).toISOString();
    const rows = await this.metrics
      .createQueryBuilder("m")
      .select(["m.timestamp AS timestamp", "m.value AS value"])
      .where("m.assetId = :assetId", { assetId })
      .andWhere("m.metricName = :metricName", { metricName })
      .andWhere("m.timestamp > :start", { start: windowStart })
      .andWhere("m.timestamp <= :asOf", { asOf: asOf.toISOString() }) // never look past asOf — this is the anti-leakage boundary
      .orderBy("m.timestamp", "ASC")
      .getRawMany<Point>();
    return rows;
  }

  /**
   * Computes one predictive_features row for `asset` as of `asOf`, using
   * only metrics/logs/incidents/maintenance dated <= asOf. This is the
   * function that guarantees no data leakage — nothing here ever reads a
   * timestamp in the future relative to asOf.
   */
  async computeFeatures(asset: Asset, asOf: Date): Promise<PredictiveFeature> {
    const map = FEATURE_METRIC_MAP[asset.type] ?? {};
    const feature = new PredictiveFeature();
    feature.assetId = asset.id;
    feature.computedAt = asOf.toISOString();

    if (map.cpu) {
      const points = await this.loadWindow(asset.id, map.cpu, asOf);
      feature.cpuAvg5m = avg(pointsSince(points, asOf, 5));
      feature.cpuAvg15m = avg(pointsSince(points, asOf, 15));
      feature.cpuAvg1h = avg(pointsSince(points, asOf, 60));
      feature.cpuAvg6h = avg(pointsSince(points, asOf, 360));
      feature.cpuAvg24h = avg(pointsSince(points, asOf, 1440));
      feature.cpuMax1h = max(pointsSince(points, asOf, 60));
      feature.cpuGrowthRate = growthRatePerDay(points);
      feature.cpuVariance = variance(pointsSince(points, asOf, 1440));
    }

    if (map.ram) {
      const points = await this.loadWindow(asset.id, map.ram, asOf);
      feature.ramAvg1h = avg(pointsSince(points, asOf, 60));
      feature.ramAvg24h = avg(pointsSince(points, asOf, 1440));
      feature.ramGrowthRate = growthRatePerDay(points);
      feature.ramVariance = variance(pointsSince(points, asOf, 1440));
    }

    if (map.storage) {
      const points = await this.loadWindow(asset.id, map.storage, asOf);
      const current = points.length ? points[points.length - 1].value : null;
      const growth = growthRatePerDay(points);
      feature.storageUsage = current;
      feature.storageGrowthRate = growth;
      if (current != null) {
        feature.estimatedDaysTo80 = daysToThreshold(current, growth, 80);
        feature.estimatedDaysTo90 = daysToThreshold(current, growth, 90);
        feature.estimatedDaysTo95 = daysToThreshold(current, growth, 95);
        feature.estimatedDaysToFull = daysToThreshold(current, growth, 100);
      }
    }

    if (map.bandwidth) {
      const points = await this.loadWindow(asset.id, map.bandwidth, asOf);
      feature.bandwidthAvg = avg(pointsSince(points, asOf, 1440));
      feature.bandwidthPeak = max(pointsSince(points, asOf, 1440));
      feature.trafficGrowthRate = growthRatePerDay(points);
    }
    if (map.packetLoss) {
      const points = await this.loadWindow(asset.id, map.packetLoss, asOf);
      feature.packetLossRate = avg(pointsSince(points, asOf, 1440));
    }
    if (map.errorRate) {
      const points = await this.loadWindow(asset.id, map.errorRate, asOf);
      feature.errorRate = avg(pointsSince(points, asOf, 1440));
    }

    if (map.temperature) {
      const points = await this.loadWindow(asset.id, map.temperature, asOf);
      feature.temperatureAvg = avg(pointsSince(points, asOf, 1440));
      feature.temperatureMax = max(pointsSince(points, asOf, 1440));
      feature.temperatureGrowthRate = growthRatePerDay(points);
    }

    const asOfIso = asOf.toISOString();
    const errWindowStart = (minutes: number) =>
      new Date(asOf.getTime() - minutes * 60_000).toISOString();
    feature.errorsLast5m = await this.countLogs(
      asset.id,
      errWindowStart(5),
      asOfIso,
      [LogSeverity.ERROR, LogSeverity.CRITICAL],
    );
    feature.errorsLast1h = await this.countLogs(
      asset.id,
      errWindowStart(60),
      asOfIso,
      [LogSeverity.ERROR, LogSeverity.CRITICAL],
    );
    feature.errorsLast24h = await this.countLogs(
      asset.id,
      errWindowStart(1440),
      asOfIso,
      [LogSeverity.ERROR, LogSeverity.CRITICAL],
    );
    feature.criticalErrorsLast24h = await this.countLogs(
      asset.id,
      errWindowStart(1440),
      asOfIso,
      [LogSeverity.CRITICAL],
    );

    feature.incidentCount7d = await this.incidents.countSince(
      asset.id,
      errWindowStart(7 * 1440),
      asOfIso,
    );
    feature.incidentCount30d = await this.incidents.countSince(
      asset.id,
      errWindowStart(30 * 1440),
      asOfIso,
    );
    feature.restartCount7d = await this.countLogs(
      asset.id,
      errWindowStart(7 * 1440),
      asOfIso,
      undefined,
      "reboot",
    );

    const lastMaintenance = await this.maintenance.lastMaintenanceDate(
      asset.id,
    );
    feature.maintenanceAgeDays = lastMaintenance
      ? (asOf.getTime() - new Date(lastMaintenance).getTime()) / 86_400_000
      : null;

    const lastIncident = await this.incidents.lastIncidentBefore(
      asset.id,
      asOfIso,
    );
    feature.daysSinceLastFailure = lastIncident
      ? (asOf.getTime() - new Date(lastIncident.startedAt).getTime()) /
        86_400_000
      : null;

    return feature;
  }

  private async countLogs(
    assetId: string,
    from: string,
    to: string,
    severities?: LogSeverity[],
    eventTypeLike?: string,
  ): Promise<number> {
    const qb = this.logs
      .createQueryBuilder("l")
      .where("l.assetId = :assetId", { assetId })
      .andWhere("l.timestamp >= :from", { from })
      .andWhere("l.timestamp < :to", { to });
    if (severities?.length)
      qb.andWhere("l.severity IN (:...sev)", { sev: severities });
    if (eventTypeLike)
      qb.andWhere("l.eventType LIKE :et", { et: `%${eventTypeLike}%` });
    return qb.getCount();
  }

  async save(feature: PredictiveFeature): Promise<PredictiveFeature> {
    return this.features.save(feature);
  }

  async saveMany(rows: PredictiveFeature[]): Promise<void> {
    if (!rows.length) return;
    await this.features.save(rows, { chunk: 500 });
  }

  async findForAsset(
    assetId: string,
    limit = 200,
  ): Promise<PredictiveFeature[]> {
    return this.features.find({
      where: { assetId },
      order: { computedAt: "DESC" },
      take: limit,
    });
  }
}
