import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Metric } from "../../entities/metric.entity";

export interface MetricQuery {
  metricName?: string;
  from?: string;
  to?: string;
  limit?: number;
}

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Metric) private readonly metrics: Repository<Metric>,
  ) {}

  async forAsset(assetId: string, query: MetricQuery = {}): Promise<Metric[]> {
    const qb = this.metrics
      .createQueryBuilder("m")
      .where("m.assetId = :assetId", { assetId });
    if (query.metricName)
      qb.andWhere("m.metricName = :metricName", {
        metricName: query.metricName,
      });
    if (query.from) qb.andWhere("m.timestamp >= :from", { from: query.from });
    if (query.to) qb.andWhere("m.timestamp <= :to", { to: query.to });
    qb.orderBy("m.timestamp", "DESC").limit(Math.min(query.limit ?? 500, 5000));
    return qb.getMany();
  }

  async latestValue(
    assetId: string,
    metricName: string,
  ): Promise<number | null> {
    const row = await this.metrics.findOne({
      where: { assetId, metricName },
      order: { timestamp: "DESC" },
    });
    return row?.value ?? null;
  }

  /** Average of `metricName` for `assetId` over the trailing window ending now. */
  async average(
    assetId: string,
    metricName: string,
    sinceIso: string,
  ): Promise<number | null> {
    const { avg } = (await this.metrics
      .createQueryBuilder("m")
      .select("AVG(m.value)", "avg")
      .where("m.assetId = :assetId", { assetId })
      .andWhere("m.metricName = :metricName", { metricName })
      .andWhere("m.timestamp >= :since", { since: sinceIso })
      .getRawOne()) as { avg: number | null };
    return avg == null ? null : Number(avg);
  }
}
