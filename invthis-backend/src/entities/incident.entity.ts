import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("incidents")
@Index(["assetId"])
@Index(["startedAt"])
export class Incident {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  assetId: string;

  /** e.g. cpu_overload, ram_exhaustion, storage_full, disk_failure, raid_failure, switch_failure, port_failure, network_outage, application_outage, database_failure, power_failure, ups_failure, temperature_incident */
  @Column()
  incidentType: string;

  @Column({ type: "varchar" })
  severity: "minor" | "major" | "critical";

  @Column()
  startedAt: string;

  @Column()
  detectedAt: string;

  @Column({ type: "varchar", nullable: true })
  resolvedAt: string | null;

  @Column({ type: "int", nullable: true })
  durationSeconds: number | null;

  @Column({ type: "varchar", nullable: true })
  rootCause: string | null;

  @Column({ type: "varchar", nullable: true })
  resolution: string | null;

  @Column({ type: "varchar", nullable: true })
  impact: string | null;

  /** Event IDs that preceded and explain this incident (the precursor chain). */
  @Column({ type: "simple-json", nullable: true })
  relatedEventIds: string[] | null;
}
