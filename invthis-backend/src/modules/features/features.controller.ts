import { Controller, Get, Query } from "@nestjs/common";
import { FeaturesService } from "./features.service";
import { LabelsService } from "./labels.service";

@Controller("infrastructure")
export class FeaturesController {
  constructor(
    private readonly features: FeaturesService,
    private readonly labels: LabelsService,
  ) {}

  @Get("prediction-features")
  findFeatures(
    @Query("assetId") assetId: string,
    @Query("limit") limit?: string,
  ) {
    return this.features.findForAsset(
      assetId,
      limit ? Number(limit) : undefined,
    );
  }

  @Get("prediction-labels")
  findLabels(
    @Query("assetId") assetId: string,
    @Query("labelName") labelName?: string,
    @Query("limit") limit?: string,
  ) {
    return this.labels.findForAsset(
      assetId,
      labelName,
      limit ? Number(limit) : undefined,
    );
  }
}
