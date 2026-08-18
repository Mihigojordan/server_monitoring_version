import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Asset, AssetType } from "../../entities/asset.entity";
import { PredictiveFeature } from "../../entities/predictive-feature.entity";
import { PredictionLabel } from "../../entities/prediction-label.entity";
import { IncidentsService } from "../incidents/incidents.service";
import { EventsService } from "../events/events.service";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Every domain's storage-like usage feeds the same capacity-forecast shape,
// so it's asset TYPE, not a hardcoded list, that decides who shows up here.
const CAPACITY_ASSET_TYPES = [
  AssetType.STORAGE_DEVICE,
  AssetType.STORAGE_ARRAY,
  AssetType.DISK,
];

@Injectable()
export class InfrastructureService {
  constructor(
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
    @InjectRepository(PredictiveFeature)
    private readonly features: Repository<PredictiveFeature>,
    @InjectRepository(PredictionLabel)
    private readonly labels: Repository<PredictionLabel>,
    private readonly incidents: IncidentsService,
    private readonly events: EventsService,
  ) {}

  private async latestFeature(
    assetId: string,
  ): Promise<PredictiveFeature | null> {
    return this.features.findOne({
      where: { assetId },
      order: { computedAt: "DESC" },
    });
  }

  /**
   * A disclosed heuristic risk score (0-100, same family as the rest of the
   * platform) from the asset's most recent feature snapshot — not a trained
   * model. Weights: how close current utilization sits to its saturation
   * point, growth trend, temperature, and recent error/incident volume.
   */
  private scoreFromFeature(f: PredictiveFeature | null): number {
    if (!f) return 0;
    const parts: number[] = [];
    if (f.cpuAvg1h != null) parts.push(clamp(f.cpuAvg1h, 0, 100));
    if (f.ramAvg1h != null) parts.push(clamp(f.ramAvg1h, 0, 100));
    if (f.storageUsage != null) parts.push(clamp(f.storageUsage, 0, 100));
    if (f.temperatureAvg != null)
      parts.push(clamp(((f.temperatureAvg - 20) / 40) * 100, 0, 100));
    if (f.packetLossRate != null)
      parts.push(clamp(f.packetLossRate * 20, 0, 100));
    if (f.errorRate != null) parts.push(clamp(f.errorRate * 10, 0, 100));
    const base = parts.length
      ? parts.reduce((a, b) => a + b, 0) / parts.length
      : 0;
    const incidentBoost = clamp((f.incidentCount30d ?? 0) * 8, 0, 30);
    const errorBoost = clamp((f.criticalErrorsLast24h ?? 0) * 10, 0, 20);
    return Math.round(clamp(base * 0.6 + incidentBoost + errorBoost, 0, 100));
  }

  async getAssetRiskProfile(assetId: string) {
    const feature = await this.latestFeature(assetId);
    const riskScore = this.scoreFromFeature(feature);
    const latestLabels = feature
      ? await this.labels.find({ where: { assetId, asOf: feature.computedAt } })
      : [];
    const predictions = Object.fromEntries(
      latestLabels.map((l) => [l.labelName, l.labelValue]),
    );

    return {
      assetId,
      healthScore: 100 - riskScore,
      riskScore,
      asOf: feature?.computedAt ?? null,
      predictions,
    };
  }

  /** Dashboard-ready health rollup, overall and per asset-type domain. */
  async getHealth() {
    const allAssets = await this.assets.find();
    const byType = new Map<AssetType, Asset[]>();
    for (const a of allAssets) {
      if (!byType.has(a.type)) byType.set(a.type, []);
      byType.get(a.type)!.push(a);
    }

    const domains: Record<
      string,
      { count: number; avgRiskScore: number; healthScore: number }
    > = {};
    const allScores: number[] = [];

    for (const [type, list] of byType) {
      const scores = await Promise.all(
        list.map(async (a) =>
          this.scoreFromFeature(await this.latestFeature(a.id)),
        ),
      );
      const avg = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      domains[type] = {
        count: list.length,
        avgRiskScore: avg,
        healthScore: 100 - avg,
      };
      allScores.push(...scores);
    }

    const overallRisk = allScores.length
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;
    const activeIncidents = await this.incidents.active();

    return {
      generatedAt: new Date().toISOString(),
      totalAssets: allAssets.length,
      overallHealthScore: 100 - overallRisk,
      overallRiskScore: overallRisk,
      activeIncidentCount: activeIncidents.length,
      domains,
    };
  }

  async getCapacityForecast() {
    const capacityAssets = await this.assets
      .createQueryBuilder("a")
      .where("a.type IN (:...types)", { types: CAPACITY_ASSET_TYPES })
      .getMany();

    const rows = await Promise.all(
      capacityAssets.map(async (a) => {
        const f = await this.latestFeature(a.id);
        return {
          assetId: a.id,
          name: a.name,
          type: a.type,
          currentUsagePct: f?.storageUsage ?? null,
          growthRatePctPerDay: f?.storageGrowthRate ?? null,
          estimatedDaysTo80: f?.estimatedDaysTo80 ?? null,
          estimatedDaysTo90: f?.estimatedDaysTo90 ?? null,
          estimatedDaysTo95: f?.estimatedDaysTo95 ?? null,
          estimatedDaysToFull: f?.estimatedDaysToFull ?? null,
        };
      }),
    );
    return rows.sort(
      (a, b) =>
        (a.estimatedDaysToFull ?? Infinity) -
        (b.estimatedDaysToFull ?? Infinity),
    );
  }

  async getTopRiskyAssets(limit = 15) {
    const allAssets = await this.assets.find();
    const scored = await Promise.all(
      allAssets.map(async (a) => ({
        assetId: a.id,
        name: a.name,
        type: a.type,
        riskScore: this.scoreFromFeature(await this.latestFeature(a.id)),
      })),
    );
    return scored.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
  }

  async getRecentAnomalies(limit = 20) {
    return this.events.recentAnomalies(limit);
  }
}
