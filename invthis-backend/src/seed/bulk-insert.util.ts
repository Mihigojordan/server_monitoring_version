import { DataSource, EntityTarget, ObjectLiteral } from "typeorm";

/** Raw chunked bulk insert — skips TypeORM's per-entity change-tracking overhead, which matters once row counts run into the hundreds of thousands. */
export async function bulkInsert<T extends ObjectLiteral>(
  dataSource: DataSource,
  entity: EntityTarget<T>,
  rows: T[],
  chunkSize = 1000,
): Promise<void> {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await dataSource
      .createQueryBuilder()
      .insert()
      .into(entity)
      .values(chunk)
      .execute();
  }
}
