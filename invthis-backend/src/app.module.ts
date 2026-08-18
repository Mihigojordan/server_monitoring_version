import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { dataSourceOptions } from "./config/database.config";
import { AssetsModule } from "./modules/assets/assets.module";
import { MetricsModule } from "./modules/metrics/metrics.module";
import { EventsModule } from "./modules/events/events.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { FeaturesModule } from "./modules/features/features.module";
import { InfrastructureModule } from "./modules/infrastructure/infrastructure.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Read-only from the app's perspective — the seed script is the writer,
    // and it persists explicitly (see scripts/migrate.ts and seed/run-seed.ts
    // for why sqljs can't rely on autoSave/disconnect-time persistence).
    TypeOrmModule.forRoot(dataSourceOptions),
    AssetsModule,
    MetricsModule,
    EventsModule,
    IncidentsModule,
    MaintenanceModule,
    FeaturesModule,
    InfrastructureModule,
  ],
})
export class AppModule {}
