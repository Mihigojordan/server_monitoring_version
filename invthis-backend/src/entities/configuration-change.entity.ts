import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("configuration_changes")
@Index(["assetId"])
@Index(["timestamp"])
export class ConfigurationChange {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  assetId: string;

  @Column({ type: "varchar", nullable: true })
  user: string | null;

  /** e.g. cpu_allocation, ram_allocation, disk_expansion, vlan_change, firewall_rule_change, firmware_update, deployment, topology_change */
  @Column()
  changeType: string;

  @Column({ type: "varchar", nullable: true })
  beforeValue: string | null;

  @Column({ type: "varchar", nullable: true })
  afterValue: string | null;

  @Column()
  timestamp: string;

  @Column({ type: "varchar", nullable: true })
  reason: string | null;

  @Column({ default: "success" })
  result: string;
}
