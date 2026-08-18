import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum LogSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

@Entity("logs")
@Index(["assetId", "timestamp"])
@Index(["timestamp"])
export class LogEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  timestamp: string;

  @Column()
  assetId: string;

  @Column({ type: "varchar", nullable: true })
  service: string | null;

  @Column({ type: "varchar", nullable: true })
  component: string | null;

  @Column({ type: "varchar" })
  severity: LogSeverity;

  @Column()
  eventType: string;

  @Column({ type: "varchar", nullable: true })
  errorCode: string | null;

  @Column()
  message: string;

  @Column({ type: "varchar", nullable: true })
  source: string | null;

  /** Ties a log line to the event/incident it belongs to, so a full failure story can be replayed. */
  @Column({ type: "varchar", nullable: true })
  correlationId: string | null;
}
