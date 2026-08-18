import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InfraEvent } from "../../entities/infra-event.entity";
import { LogEntry } from "../../entities/log-entry.entity";

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(InfraEvent)
    private readonly events: Repository<InfraEvent>,
    @InjectRepository(LogEntry) private readonly logs: Repository<LogEntry>,
  ) {}

  async findEvents(opts: {
    assetId?: string;
    severity?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const qb = this.events.createQueryBuilder("e");
    if (opts.assetId)
      qb.andWhere("e.assetId = :assetId", { assetId: opts.assetId });
    if (opts.severity)
      qb.andWhere("e.severity = :severity", { severity: opts.severity });
    if (opts.from) qb.andWhere("e.timestamp >= :from", { from: opts.from });
    if (opts.to) qb.andWhere("e.timestamp <= :to", { to: opts.to });
    qb.orderBy("e.timestamp", "DESC").limit(Math.min(opts.limit ?? 200, 2000));
    return qb.getMany();
  }

  async findLogs(opts: {
    assetId?: string;
    severity?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const qb = this.logs.createQueryBuilder("l");
    if (opts.assetId)
      qb.andWhere("l.assetId = :assetId", { assetId: opts.assetId });
    if (opts.severity)
      qb.andWhere("l.severity = :severity", { severity: opts.severity });
    if (opts.from) qb.andWhere("l.timestamp >= :from", { from: opts.from });
    if (opts.to) qb.andWhere("l.timestamp <= :to", { to: opts.to });
    qb.orderBy("l.timestamp", "DESC").limit(Math.min(opts.limit ?? 200, 2000));
    return qb.getMany();
  }

  /** Most recent notable events across the whole fleet — the dashboard's "recent anomalies" feed. */
  async recentAnomalies(limit = 20) {
    return this.events
      .createQueryBuilder("e")
      .where("e.severity IN (:...sev)", { sev: ["warning", "critical"] })
      .orderBy("e.timestamp", "DESC")
      .limit(limit)
      .getMany();
  }
}
