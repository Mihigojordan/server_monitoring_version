import "reflect-metadata";
import { DataSource } from "typeorm";
import { dataSourceOptions } from "./config/database.config";

// Used by the TypeORM CLI for `migration:generate` (schema diffing doesn't
// need persistence — only actually *running* migrations does, which is why
// there's a separate scripts/migrate.ts that explicitly saves afterward;
// the sqljs driver does NOT persist on disconnect).
export const AppDataSource = new DataSource(dataSourceOptions);
