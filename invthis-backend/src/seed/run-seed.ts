import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { AppModule } from "../app.module";
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
import { FeaturesService } from "../modules/features/features.service";
import { LabelsService } from "../modules/features/labels.service";
import { Rng } from "./rng";
import { SEED_CONFIG } from "./seed.config";
import { buildAssets } from "./build-assets";
import { buildMetrics } from "./generate-metrics";
import { buildEventsAndIncidents } from "./generate-events";
import { buildMaintenanceAndConfig } from "./generate-maintenance";
import { bulkInsert } from "./bulk-insert.util";

async function main() {
  const t0 = Date.now();
  console.log("── invthis-backend seed generator ──");
  console.log("Config:", SEED_CONFIG);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const dataSource = app.get(DataSource);
  const featuresService = app.get(FeaturesService);
  const labelsService = app.get(LabelsService);

  const rng = new Rng(SEED_CONFIG.seedRandom);

  console.log("\n[1/6] Building asset graph...");
  const inv = buildAssets(rng);
  await bulkInsert(dataSource, Asset, inv.all);
  await bulkInsert(dataSource, AssetDependency, inv.dependencies);
  console.log(
    `  ${inv.all.length} assets, ${inv.dependencies.length} dependency edges.`,
  );

  console.log(
    "\n[2/6] Generating time-series metrics (this is the bulk of the work)...",
  );
  const { metrics, scenarios, configEffects } = buildMetrics(inv, rng);
  await bulkInsert(dataSource, Metric, metrics, 2000);
  console.log(
    `  ${metrics.length} metric rows across ${SEED_CONFIG.days} days.`,
  );
  console.log(
    `  Injected failure scenarios: ${scenarios.map((s) => `${s.domain}(${s.assetName})`).join(", ")}`,
  );

  console.log("\n[3/6] Generating events, logs and incidents...");
  const { events, logs, incidents } = buildEventsAndIncidents(
    inv,
    scenarios,
    rng,
  );
  await bulkInsert(dataSource, InfraEvent, events);
  await bulkInsert(dataSource, LogEntry, logs, 2000);
  await bulkInsert(dataSource, Incident, incidents);
  console.log(
    `  ${events.length} events, ${logs.length} logs, ${incidents.length} incidents.`,
  );

  console.log(
    "\n[4/6] Generating maintenance history and configuration changes...",
  );
  const { maintenance, configurationChanges } = buildMaintenanceAndConfig(
    inv,
    scenarios,
    configEffects,
    rng,
  );
  await bulkInsert(dataSource, MaintenanceRecord, maintenance);
  await bulkInsert(dataSource, ConfigurationChange, configurationChanges);
  console.log(
    `  ${maintenance.length} maintenance records, ${configurationChanges.length} configuration changes.`,
  );

  // Checkpoint before the (query-heavy) feature/label pass.
  await dataSource.sqljsManager.saveDatabase();
  console.log("\n  Checkpoint saved to disk.");

  console.log(
    "\n[5/6] Computing predictive features and prediction labels (strictly backward/forward — no leakage)...",
  );
  let featureCount = 0;
  let labelCount = 0;
  const startMs = Date.now() - SEED_CONFIG.days * 86_400_000;
  for (const asset of inv.all) {
    const featureRows: PredictiveFeature[] = [];
    const labelRows: PredictionLabel[] = [];
    for (
      let day = 1;
      day <= SEED_CONFIG.days;
      day += SEED_CONFIG.featureIntervalHours / 24
    ) {
      const asOf = new Date(startMs + day * 86_400_000);
      const feature = await featuresService.computeFeatures(asset, asOf);
      featureRows.push(feature);
      const labels = await labelsService.computeLabels(
        asset.id,
        asOf.toISOString(),
      );
      labelRows.push(...labels);
    }
    await featuresService.saveMany(featureRows);
    await labelsService.saveMany(labelRows);
    featureCount += featureRows.length;
    labelCount += labelRows.length;
  }
  console.log(
    `  ${featureCount} predictive_features rows, ${labelCount} prediction_labels rows.`,
  );

  console.log("\n[6/6] Persisting database...");
  await dataSource.sqljsManager.saveDatabase();

  // ── Validation ────────────────────────────────────────────────────
  console.log("\n── Validation ──");
  const orphanMetrics = await dataSource
    .createQueryBuilder()
    .select("COUNT(*)", "c")
    .from(Metric, "m")
    .where("m.assetId NOT IN (SELECT id FROM assets)")
    .getRawOne<{ c: string }>();
  console.log(`  Orphan metrics (no matching asset): ${orphanMetrics?.c}`);

  const positiveLabelsWithNoIncident = await dataSource
    .createQueryBuilder()
    .select("COUNT(*)", "c")
    .from(PredictionLabel, "l")
    .where("l.labelValue = 1")
    .getRawOne<{ c: string }>();
  const totalPositiveLabels = Number(positiveLabelsWithNoIncident?.c);
  console.log(
    `  Positive labels derived from real future incidents: ${totalPositiveLabels} (every positive label traces to an Incident row started after its asOf timestamp within the label's horizon — see LabelsService).`,
  );

  const incidentCount = await dataSource.getRepository(Incident).count();
  const labelTotal = await dataSource.getRepository(PredictionLabel).count();
  const featureTotal = await dataSource
    .getRepository(PredictiveFeature)
    .count();

  console.log(`\n── Report ──`);
  console.log(
    `Tables created: assets, asset_dependencies, metrics, logs, events, incidents, maintenance_records, configuration_changes, predictive_features, prediction_labels`,
  );
  console.log(`Records generated:`);
  console.log(`  assets: ${inv.all.length}`);
  console.log(`  asset_dependencies: ${inv.dependencies.length}`);
  console.log(`  metrics: ${metrics.length}`);
  console.log(`  events: ${events.length}`);
  console.log(`  logs: ${logs.length}`);
  console.log(`  incidents: ${incidentCount}`);
  console.log(`  maintenance_records: ${maintenance.length}`);
  console.log(`  configuration_changes: ${configurationChanges.length}`);
  console.log(`  predictive_features: ${featureTotal}`);
  console.log(`  prediction_labels: ${labelTotal}`);
  console.log(
    `Historical period: ${SEED_CONFIG.days} days ending ${new Date().toISOString()}`,
  );
  console.log(
    `Injected failure scenarios: ${scenarios.length} (${scenarios.map((s) => s.incidentType).join(", ")})`,
  );
  console.log(`Elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
