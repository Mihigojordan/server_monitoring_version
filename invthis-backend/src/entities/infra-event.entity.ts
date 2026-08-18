import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum EventSeverity {
  INFO = "info",
  WARNING = "warning",
  CRITICAL = "critical",
}

@Entity("events")
@Index(["assetId", "timestamp"])
@Index(["timestamp"])
export class InfraEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  timestamp: string;

  @Column()
  assetId: string;

  /** e.g. server_reboot, disk_warning, port_down, port_flapping, service_restart, deployment, backup, temperature_warning */
  @Column()
  eventType: string;

  @Column({ type: "varchar" })
  severity: EventSeverity;

  @Column()
  description: string;

  @Column({ default: "open" })
  status: string;

  @Column({ type: "varchar", nullable: true })
  source: string | null;

  /** Links a chain of precursor events to the incident they eventually caused. */
  @Column({ type: "varchar", nullable: true })
  correlationId: string | null;
}
