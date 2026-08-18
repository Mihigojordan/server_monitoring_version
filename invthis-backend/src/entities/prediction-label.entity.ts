import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// A label is only ever set by looking FORWARD from asOf into the real
// incidents table within the stated horizon — never randomly assigned, and
// never computed from anything at or before asOf (that's the feature's job).
// See LabelsService for the derivation.
@Entity("prediction_labels")
@Index(["assetId", "labelName", "asOf"])
export class PredictionLabel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  assetId: string;

  /** The observation point this label is anchored to — matches a PredictiveFeature.computedAt. */
  @Column()
  asOf: string;

  /** e.g. failure_next_1h, storage_full_next_7d, cpu_overload_next_1h, disk_failure_next_7d */
  @Column()
  labelName: string;

  /** 1 if a matching real incident occurred within the horizon after asOf, else 0. */
  @Column("real")
  labelValue: number;

  @Column({ type: "int", nullable: true })
  horizonHours: number | null;
}
