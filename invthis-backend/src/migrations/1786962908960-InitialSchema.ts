import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1786962908960 implements MigrationInterface {
  name = "InitialSchema1786962908960";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "assets" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "type" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('active'), "location" varchar, "parentAssetId" varchar, "manufacturer" varchar, "model" varchar, "serialNumber" varchar, "firmware" varchar, "ipAddress" varchar, "macAddress" varchar, "installDate" varchar, "warrantyExpiry" varchar, "lifecycleStatus" varchar NOT NULL DEFAULT ('in_service'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9319c6007a6741777b457490ac" ON "assets" ("parentAssetId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56647aa3c21954f7c7fcbc2505" ON "assets" ("type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "asset_dependencies" ("id" varchar PRIMARY KEY NOT NULL, "parentAssetId" varchar NOT NULL, "childAssetId" varchar NOT NULL, "dependencyType" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff37003814b40e36d21588d46b" ON "asset_dependencies" ("childAssetId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ab4132f5bd7be099433c8ccdce" ON "asset_dependencies" ("parentAssetId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "metrics" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "assetId" varchar NOT NULL, "metricName" varchar NOT NULL, "value" real NOT NULL, "unit" varchar, "timestamp" varchar NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a7fac52dd58002287c6a5d70b5" ON "metrics" ("assetId", "metricName", "timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c63ad2faa476a8b9adb02d5c26" ON "metrics" ("assetId", "timestamp") `,
    );
    await queryRunner.query(
      `CREATE TABLE "logs" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "timestamp" varchar NOT NULL, "assetId" varchar NOT NULL, "service" varchar, "component" varchar, "severity" varchar NOT NULL, "eventType" varchar NOT NULL, "errorCode" varchar, "message" varchar NOT NULL, "source" varchar, "correlationId" varchar)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_682897ba764db30ef8836c9b74" ON "logs" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65df0cca6c62c27c9ef5744497" ON "logs" ("assetId", "timestamp") `,
    );
    await queryRunner.query(
      `CREATE TABLE "events" ("id" varchar PRIMARY KEY NOT NULL, "timestamp" varchar NOT NULL, "assetId" varchar NOT NULL, "eventType" varchar NOT NULL, "severity" varchar NOT NULL, "description" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('open'), "source" varchar, "correlationId" varchar)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b5a6ad5d1dc980d07d07969525" ON "events" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5b871b181464bbce5ca094ec11" ON "events" ("assetId", "timestamp") `,
    );
    await queryRunner.query(
      `CREATE TABLE "incidents" ("id" varchar PRIMARY KEY NOT NULL, "assetId" varchar NOT NULL, "incidentType" varchar NOT NULL, "severity" varchar NOT NULL, "startedAt" varchar NOT NULL, "detectedAt" varchar NOT NULL, "resolvedAt" varchar, "durationSeconds" integer, "rootCause" varchar, "resolution" varchar, "impact" varchar, "relatedEventIds" text)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f950c927ab5ea7260ca70269e6" ON "incidents" ("startedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1af35f8ed15a0439e7d71ba6b8" ON "incidents" ("assetId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "maintenance_records" ("id" varchar PRIMARY KEY NOT NULL, "date" varchar NOT NULL, "assetId" varchar NOT NULL, "maintenanceType" varchar NOT NULL, "engineer" varchar, "description" varchar, "componentsReplaced" text, "firmwareUpdated" varchar, "previousCondition" varchar, "result" varchar, "nextMaintenanceDate" varchar)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0f5968069dda3966f024f6ae7" ON "maintenance_records" ("date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fa429e82a69bc0eab112f7458c" ON "maintenance_records" ("assetId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "configuration_changes" ("id" varchar PRIMARY KEY NOT NULL, "assetId" varchar NOT NULL, "user" varchar, "changeType" varchar NOT NULL, "beforeValue" varchar, "afterValue" varchar, "timestamp" varchar NOT NULL, "reason" varchar, "result" varchar NOT NULL DEFAULT ('success'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_96684a557bdfe50d7cf7250772" ON "configuration_changes" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15df0d5553b2941e67a3df43dc" ON "configuration_changes" ("assetId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "predictive_features" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "assetId" varchar NOT NULL, "computedAt" varchar NOT NULL, "cpuAvg5m" real, "cpuAvg15m" real, "cpuAvg1h" real, "cpuAvg6h" real, "cpuAvg24h" real, "cpuMax1h" real, "cpuGrowthRate" real, "cpuVariance" real, "ramAvg1h" real, "ramAvg24h" real, "ramGrowthRate" real, "ramVariance" real, "storageUsage" real, "storageGrowthRate" real, "estimatedDaysTo80" real, "estimatedDaysTo90" real, "estimatedDaysTo95" real, "estimatedDaysToFull" real, "bandwidthAvg" real, "bandwidthPeak" real, "packetLossRate" real, "errorRate" real, "trafficGrowthRate" real, "temperatureAvg" real, "temperatureMax" real, "temperatureGrowthRate" real, "errorsLast5m" integer, "errorsLast1h" integer, "errorsLast24h" integer, "criticalErrorsLast24h" integer, "incidentCount7d" integer, "incidentCount30d" integer, "restartCount7d" integer, "maintenanceAgeDays" real, "daysSinceLastFailure" real)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_acf991011ba83f0cf3d7cd2456" ON "predictive_features" ("assetId", "computedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "prediction_labels" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "assetId" varchar NOT NULL, "asOf" varchar NOT NULL, "labelName" varchar NOT NULL, "labelValue" real NOT NULL, "horizonHours" integer)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_82adb440e55eee4dff36d90c53" ON "prediction_labels" ("assetId", "labelName", "asOf") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_82adb440e55eee4dff36d90c53"`);
    await queryRunner.query(`DROP TABLE "prediction_labels"`);
    await queryRunner.query(`DROP INDEX "IDX_acf991011ba83f0cf3d7cd2456"`);
    await queryRunner.query(`DROP TABLE "predictive_features"`);
    await queryRunner.query(`DROP INDEX "IDX_15df0d5553b2941e67a3df43dc"`);
    await queryRunner.query(`DROP INDEX "IDX_96684a557bdfe50d7cf7250772"`);
    await queryRunner.query(`DROP TABLE "configuration_changes"`);
    await queryRunner.query(`DROP INDEX "IDX_fa429e82a69bc0eab112f7458c"`);
    await queryRunner.query(`DROP INDEX "IDX_b0f5968069dda3966f024f6ae7"`);
    await queryRunner.query(`DROP TABLE "maintenance_records"`);
    await queryRunner.query(`DROP INDEX "IDX_1af35f8ed15a0439e7d71ba6b8"`);
    await queryRunner.query(`DROP INDEX "IDX_f950c927ab5ea7260ca70269e6"`);
    await queryRunner.query(`DROP TABLE "incidents"`);
    await queryRunner.query(`DROP INDEX "IDX_5b871b181464bbce5ca094ec11"`);
    await queryRunner.query(`DROP INDEX "IDX_b5a6ad5d1dc980d07d07969525"`);
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP INDEX "IDX_65df0cca6c62c27c9ef5744497"`);
    await queryRunner.query(`DROP INDEX "IDX_682897ba764db30ef8836c9b74"`);
    await queryRunner.query(`DROP TABLE "logs"`);
    await queryRunner.query(`DROP INDEX "IDX_c63ad2faa476a8b9adb02d5c26"`);
    await queryRunner.query(`DROP INDEX "IDX_a7fac52dd58002287c6a5d70b5"`);
    await queryRunner.query(`DROP TABLE "metrics"`);
    await queryRunner.query(`DROP INDEX "IDX_ab4132f5bd7be099433c8ccdce"`);
    await queryRunner.query(`DROP INDEX "IDX_ff37003814b40e36d21588d46b"`);
    await queryRunner.query(`DROP TABLE "asset_dependencies"`);
    await queryRunner.query(`DROP INDEX "IDX_56647aa3c21954f7c7fcbc2505"`);
    await queryRunner.query(`DROP INDEX "IDX_9319c6007a6741777b457490ac"`);
    await queryRunner.query(`DROP TABLE "assets"`);
  }
}
