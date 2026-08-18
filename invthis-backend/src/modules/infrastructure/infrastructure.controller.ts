import { Controller, Get, Param, Query } from "@nestjs/common";
import { InfrastructureService } from "./infrastructure.service";

@Controller("infrastructure")
export class InfrastructureController {
  constructor(private readonly infra: InfrastructureService) {}

  @Get("health")
  getHealth() {
    return this.infra.getHealth();
  }

  @Get("capacity-forecast")
  getCapacityForecast() {
    return this.infra.getCapacityForecast();
  }

  @Get("top-risky-assets")
  getTopRiskyAssets(@Query("limit") limit?: string) {
    return this.infra.getTopRiskyAssets(limit ? Number(limit) : undefined);
  }

  @Get("recent-anomalies")
  getRecentAnomalies(@Query("limit") limit?: string) {
    return this.infra.getRecentAnomalies(limit ? Number(limit) : undefined);
  }

  @Get("assets/:id/risk-profile")
  getAssetRiskProfile(@Param("id") id: string) {
    return this.infra.getAssetRiskProfile(id);
  }
}
