import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { Incident } from "../../entities/incident.entity";

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
  ) {}

  async findAll(
    opts: {
      assetId?: string;
      incidentType?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {},
  ) {
    const qb = this.incidents.createQueryBuilder("i");
    if (opts.assetId)
      qb.andWhere("i.assetId = :assetId", { assetId: opts.assetId });
    if (opts.incidentType)
      qb.andWhere("i.incidentType = :incidentType", {
        incidentType: opts.incidentType,
      });
    if (opts.from) qb.andWhere("i.startedAt >= :from", { from: opts.from });
    if (opts.to) qb.andWhere("i.startedAt <= :to", { to: opts.to });
    qb.orderBy("i.startedAt", "DESC").limit(Math.min(opts.limit ?? 200, 2000));
    return qb.getMany();
  }

  async active() {
    return this.incidents.find({
      where: { resolvedAt: IsNull() },
      order: { startedAt: "DESC" },
    });
  }

  /** Incidents that STARTED within [sinceIso, beforeIso) — pass beforeIso explicitly when this feeds a feature computation, or it'll count incidents from the future. */
  async countSince(
    assetId: string,
    sinceIso: string,
    beforeIso: string = new Date().toISOString(),
  ): Promise<number> {
    return this.incidents
      .createQueryBuilder("i")
      .where("i.assetId = :assetId", { assetId })
      .andWhere("i.startedAt >= :since", { since: sinceIso })
      .andWhere("i.startedAt < :before", { before: beforeIso })
      .getCount();
  }

  async lastIncidentBefore(
    assetId: string,
    beforeIso: string,
  ): Promise<Incident | null> {
    return this.incidents
      .createQueryBuilder("i")
      .where("i.assetId = :assetId", { assetId })
      .andWhere("i.startedAt < :before", { before: beforeIso })
      .orderBy("i.startedAt", "DESC")
      .getOne();
  }

  /** Real future incidents of the given type within (asOf, asOf+horizonHours] — this IS the label derivation, never random. */
  async incidentTypeOccursWithinHorizon(
    assetId: string,
    incidentTypePrefixes: string[],
    asOfIso: string,
    horizonHours: number,
  ): Promise<boolean> {
    const horizonEnd = new Date(
      new Date(asOfIso).getTime() + horizonHours * 3600_000,
    ).toISOString();
    const qb = this.incidents
      .createQueryBuilder("i")
      .where("i.assetId = :assetId", { assetId })
      .andWhere("i.startedAt > :asOf", { asOf: asOfIso })
      .andWhere("i.startedAt <= :horizonEnd", { horizonEnd });
    if (incidentTypePrefixes.length) {
      qb.andWhere(
        "(" +
          incidentTypePrefixes
            .map((_, i) => `i.incidentType LIKE :t${i}`)
            .join(" OR ") +
          ")",
        Object.fromEntries(
          incidentTypePrefixes.map((t, i) => [`t${i}`, `${t}%`]),
        ),
      );
    }
    const count = await qb.getCount();
    return count > 0;
  }

  async topRiskyAssetsByIncidentCount(sinceIso: string, limit = 10) {
    return this.incidents
      .createQueryBuilder("i")
      .select("i.assetId", "assetId")
      .addSelect("COUNT(*)", "incidentCount")
      .where("i.startedAt >= :since", { since: sinceIso })
      .groupBy("i.assetId")
      .orderBy("incidentCount", "DESC")
      .limit(limit)
      .getRawMany();
  }
}
