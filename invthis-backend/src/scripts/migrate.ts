import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";
import { DataSource } from "typeorm";
import { dataSourceOptions, DB_PATH } from "../config/database.config";

// The sqljs driver keeps the whole DB in memory and does NOT persist on
// disconnect — the stock `typeorm migration:run` CLI would silently lose
// the migrated schema. This runs migrations then explicitly saves.
async function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  const applied = await dataSource.runMigrations();
  console.log(
    `Applied ${applied.length} migration(s):`,
    applied.map((m) => m.name),
  );

  await dataSource.sqljsManager.saveDatabase();
  await dataSource.destroy();
  console.log(`Database persisted to ${DB_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
