import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PredictionLabel } from "../../entities/prediction-label.entity";
import { IncidentsService } from "../incidents/incidents.service";

interface LabelDef {
  name: string;
  horizonHours: number;
  /** Incident-type prefixes this label looks for; empty = any incident counts as "failure". */
  types: string[];
}

// Every label here is answered by looking FORWARD from asOf into the real
// incidents table — never assigned randomly, never derived from anything at
// or before asOf (that's what predictive_features is for). This is the
// entire anti-data-leakage contract in one place.
const LABEL_DEFS: LabelDef[] = [
  { name: "failure_next_1h", horizonHours: 1, types: [] },
  { name: "failure_next_6h", horizonHours: 6, types: [] },
  { name: "failure_next_24h", horizonHours: 24, types: [] },
  { name: "failure_next_7d", horizonHours: 24 * 7, types: [] },
  { name: "failure_next_30d", horizonHours: 24 * 30, types: [] },
  {
    name: "storage_full_next_7d",
    horizonHours: 24 * 7,
    types: ["storage_full"],
  },
  {
    name: "storage_full_next_30d",
    horizonHours: 24 * 30,
    types: ["storage_full"],
  },
  { name: "cpu_overload_next_1h", horizonHours: 1, types: ["cpu_overload"] },
  {
    name: "ram_exhaustion_next_24h",
    horizonHours: 24,
    types: ["ram_exhaustion"],
  },
  {
    name: "network_incident_next_24h",
    horizonHours: 24,
    types: ["switch_failure", "port_failure", "network_outage"],
  },
  {
    name: "service_failure_next_24h",
    horizonHours: 24,
    types: ["application_outage"],
  },
  {
    name: "disk_failure_next_7d",
    horizonHours: 24 * 7,
    types: ["disk_failure", "raid_failure"],
  },
];

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(PredictionLabel)
    private readonly labels: Repository<PredictionLabel>,
    private readonly incidents: IncidentsService,
  ) {}

  async computeLabels(
    assetId: string,
    asOfIso: string,
  ): Promise<PredictionLabel[]> {
    const rows: PredictionLabel[] = [];
    for (const def of LABEL_DEFS) {
      const occurred = await this.incidents.incidentTypeOccursWithinHorizon(
        assetId,
        def.types,
        asOfIso,
        def.horizonHours,
      );
      const label = new PredictionLabel();
      label.assetId = assetId;
      label.asOf = asOfIso;
      label.labelName = def.name;
      label.labelValue = occurred ? 1 : 0;
      label.horizonHours = def.horizonHours;
      rows.push(label);
    }
    return rows;
  }

  async saveMany(rows: PredictionLabel[]): Promise<void> {
    if (!rows.length) return;
    await this.labels.save(rows, { chunk: 500 });
  }

  async findForAsset(
    assetId: string,
    labelName?: string,
    limit = 500,
  ): Promise<PredictionLabel[]> {
    return this.labels.find({
      where: labelName ? { assetId, labelName } : { assetId },
      order: { asOf: "DESC" },
      take: limit,
    });
  }
}
