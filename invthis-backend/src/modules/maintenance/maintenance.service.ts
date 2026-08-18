import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MaintenanceRecord } from "../../entities/maintenance-record.entity";
import { ConfigurationChange } from "../../entities/configuration-change.entity";

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceRecord)
    private readonly maintenance: Repository<MaintenanceRecord>,
    @InjectRepository(ConfigurationChange)
    private readonly configChanges: Repository<ConfigurationChange>,
  ) {}

  async findMaintenance(assetId?: string) {
    return this.maintenance.find({
      where: assetId ? { assetId } : {},
      order: { date: "DESC" },
      take: 500,
    });
  }

  async findConfigChanges(assetId?: string) {
    return this.configChanges.find({
      where: assetId ? { assetId } : {},
      order: { timestamp: "DESC" },
      take: 500,
    });
  }

  async lastMaintenanceDate(assetId: string): Promise<string | null> {
    const row = await this.maintenance.findOne({
      where: { assetId },
      order: { date: "DESC" },
    });
    return row?.date ?? null;
  }
}
