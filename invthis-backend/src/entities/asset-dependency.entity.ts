import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

// The functional dependency graph — answers "if X fails, what's affected?"
// Many-to-many by design: a UPS powers many racks, a switch connects many
// servers, a server hosts many applications.
export enum DependencyType {
  POWERS = "powers",
  CONNECTS = "connects",
  HOSTS = "hosts",
  STORES_DATA_FOR = "stores_data_for",
  ROUTES_TO = "routes_to",
  COOLS = "cools",
}

@Entity("asset_dependencies")
@Index(["parentAssetId"])
@Index(["childAssetId"])
export class AssetDependency {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** The asset whose failure impacts childAssetId (e.g. the UPS, the switch, the server). */
  @Column()
  parentAssetId: string;

  /** The asset that depends on parentAssetId (e.g. the rack, the server, the application). */
  @Column()
  childAssetId: string;

  @Column({ type: "varchar" })
  dependencyType: DependencyType;

  @CreateDateColumn()
  createdAt: Date;
}
