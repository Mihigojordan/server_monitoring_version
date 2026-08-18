import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InfraEvent } from "../../entities/infra-event.entity";
import { LogEntry } from "../../entities/log-entry.entity";
import { EventsService } from "./events.service";
import { EventsController } from "./events.controller";

@Module({
  imports: [TypeOrmModule.forFeature([InfraEvent, LogEntry])],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
