import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Asset } from "../../entities/asset.entity";
import { AssetDependency } from "../../entities/asset-dependency.entity";
import { AssetsService } from "./assets.service";
import { AssetsController } from "./assets.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Asset, AssetDependency])],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
