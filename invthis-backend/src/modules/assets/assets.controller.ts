import { Controller, Get, Param, Query } from "@nestjs/common";
import { AssetsService } from "./assets.service";
import { AssetType } from "../../entities/asset.entity";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  findAll(@Query("type") type?: AssetType) {
    return this.assets.findAll(type);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.assets.findOne(id);
  }

  @Get(":id/dependencies")
  getDependencies(@Param("id") id: string) {
    return this.assets.getDependencies(id);
  }

  @Get(":id/impact")
  async getImpact(@Param("id") id: string) {
    const affected = await this.assets.getImpactRadius(id);
    return {
      assetId: id,
      affectedAssetIds: affected,
      affectedCount: affected.length,
    };
  }
}
