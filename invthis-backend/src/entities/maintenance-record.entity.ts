import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("maintenance_records")
@Index(["assetId"])
@Index(["date"])
export class MaintenanceRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  date: string;

  @Column()
  assetId: string;

  /** e.g. disk_replacement, ram_replacement, psu_replacement, firmware_upgrade, os_upgrade, network_configuration, cleaning, preventive */
  @Column()
  maintenanceType: string;

  @Column({ type: "varchar", nullable: true })
  engineer: string | null;

  @Column({ type: "varchar", nullable: true })
  description: string | null;

  @Column({ type: "simple-json", nullable: true })
  componentsReplaced: string[] | null;

  @Column({ type: "varchar", nullable: true })
  firmwareUpdated: string | null;

  @Column({ type: "varchar", nullable: true })
  previousCondition: string | null;

  @Column({ type: "varchar", nullable: true })
  result: string | null;

  @Column({ type: "varchar", nullable: true })
  nextMaintenanceDate: string | null;
}
