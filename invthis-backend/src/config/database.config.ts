import { DataSourceOptions } from "typeorm";
import * as path from "path";
import { Asset } from "../entities/asset.entity";
import { AssetDependency } from "../entities/asset-dependency.entity";
import { Metric } from "../entities/metric.entity";
import { LogEntry } from "../entities/log-entry.entity";
import { InfraEvent } from "../entities/infra-event.entity";
import { Incident } from "../entities/incident.entity";
import { MaintenanceRecord } from "../entities/maintenance-record.entity";
import { ConfigurationChange } from "../entities/configuration-change.entity";
import { PredictiveFeature } from "../entities/predictive-feature.entity";
import { PredictionLabel } from "../entities/prediction-label.entity";

export const ENTITIES = [
  Asset,
  AssetDependency,
  Metric,
  LogEntry,
  InfraEvent,
  Incident,
  MaintenanceRecord,
  ConfigurationChange,
  PredictiveFeature,
  PredictionLabel,
];

// sql.js (pure WASM SQLite, no native compilation) — chosen because this
// environment has no C++ toolchain/Python for better-sqlite3 or sqlite3 to
// build against. The whole DB lives in memory and is explicitly persisted
// to `location` via dbUtil.persist() — NOT TypeORM's autoSave, which would
// serialize the entire DB to disk after every single insert and make bulk
// seeding unusably slow. If this ever needs to scale past what fits
// comfortably in memory, swap this file for a Postgres DataSourceOptions —
// every entity/service here is driver-agnostic.
export const DB_PATH =
  process.env.INVTHIS_DB_PATH ??
  path.join(__dirname, "..", "..", "data", "invthis.sqlite");

export const dataSourceOptions: DataSourceOptions = {
  type: "sqljs",
  location: DB_PATH,
  autoSave: false,
  entities: ENTITIES,
  migrations: [path.join(__dirname, "..", "migrations", "*.{ts,js}")],
  synchronize: false,
};
