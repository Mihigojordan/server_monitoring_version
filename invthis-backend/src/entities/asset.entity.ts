import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

// Every physical/logical thing in the infrastructure graph is one Asset row
// — a datacenter, a rack, a server, a disk, an application, a database.
// One flexible table instead of 18 near-identical ones, per the brief's own
// framing ("a common infrastructure asset structure capable of representing
// ..."). Type-specific behavior lives in the seed generator and feature
// engineering, not in separate schemas.
export enum AssetType {
  DATA_CENTER = "data_center",
  RACK = "rack",
  SERVER = "server",
  VM = "vm",
  STORAGE_DEVICE = "storage_device",
  STORAGE_ARRAY = "storage_array",
  SWITCH = "switch",
  ROUTER = "router",
  FIREWALL = "firewall",
  LOAD_BALANCER = "load_balancer",
  UPS = "ups",
  PDU = "pdu",
  PSU = "psu",
  NIC = "nic",
  DISK = "disk",
  APPLICATION = "application",
  DATABASE = "database",
}

export enum AssetStatus {
  ACTIVE = "active",
  DEGRADED = "degraded",
  OFFLINE = "offline",
  MAINTENANCE = "maintenance",
  RETIRED = "retired",
}

export enum LifecycleStatus {
  NEW = "new",
  IN_SERVICE = "in_service",
  AGING = "aging",
  END_OF_LIFE = "end_of_life",
  RETIRED = "retired",
}

@Entity("assets")
@Index(["type"])
@Index(["parentAssetId"])
export class Asset {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "varchar" })
  type: AssetType;

  @Column({ type: "varchar", default: AssetStatus.ACTIVE })
  status: AssetStatus;

  @Column({ type: "varchar", nullable: true })
  location: string | null;

  // Physical containment only (data_center -> rack -> server/storage/switch
  // -> disk/psu/nic). Logical/functional relationships (power, network,
  // hosting) live in AssetDependency instead — a server sits IN a rack but
  // is POWERED BY a UPS and CONNECTS TO a switch; those are different edges.
  @Column({ type: "varchar", nullable: true })
  parentAssetId: string | null;

  @Column({ type: "varchar", nullable: true })
  manufacturer: string | null;

  @Column({ type: "varchar", nullable: true })
  model: string | null;

  @Column({ type: "varchar", nullable: true })
  serialNumber: string | null;

  @Column({ type: "varchar", nullable: true })
  firmware: string | null;

  @Column({ type: "varchar", nullable: true })
  ipAddress: string | null;

  @Column({ type: "varchar", nullable: true })
  macAddress: string | null;

  @Column({ type: "varchar", nullable: true })
  installDate: string | null;

  @Column({ type: "varchar", nullable: true })
  warrantyExpiry: string | null;

  @Column({ type: "varchar", default: LifecycleStatus.IN_SERVICE })
  lifecycleStatus: LifecycleStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
