import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Asset, AssetType } from "../../entities/asset.entity";
import { AssetDependency } from "../../entities/asset-dependency.entity";

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
    @InjectRepository(AssetDependency)
    private readonly deps: Repository<AssetDependency>,
  ) {}

  async findAll(type?: AssetType): Promise<Asset[]> {
    return type ? this.assets.find({ where: { type } }) : this.assets.find();
  }

  async findOne(id: string): Promise<Asset> {
    const asset = await this.assets.findOne({ where: { id } });
    if (!asset) throw new NotFoundException(`Asset ${id} not found`);
    return asset;
  }

  async findByType(types: AssetType[]): Promise<Asset[]> {
    return this.assets
      .createQueryBuilder("a")
      .where("a.type IN (:...types)", { types })
      .getMany();
  }

  /** Every asset this one depends on, and every asset that depends on this one — the "what breaks if this fails" answer. */
  async getDependencies(id: string) {
    await this.findOne(id);
    const [dependsOn, dependents] = await Promise.all([
      this.deps.find({ where: { childAssetId: id } }),
      this.deps.find({ where: { parentAssetId: id } }),
    ]);

    const relatedIds = [
      ...dependsOn.map((d) => d.parentAssetId),
      ...dependents.map((d) => d.childAssetId),
    ];
    const relatedAssets = relatedIds.length
      ? await this.assets
          .createQueryBuilder("a")
          .where("a.id IN (:...ids)", { ids: relatedIds })
          .getMany()
      : [];
    const byId = new Map(relatedAssets.map((a) => [a.id, a]));

    return {
      assetId: id,
      dependsOn: dependsOn.map((d) => ({
        dependencyType: d.dependencyType,
        asset: byId.get(d.parentAssetId) ?? null,
      })),
      dependents: dependents.map((d) => ({
        dependencyType: d.dependencyType,
        asset: byId.get(d.childAssetId) ?? null,
      })),
    };
  }

  /** BFS over the dependency graph — every asset transitively affected if `id` fails. */
  async getImpactRadius(id: string): Promise<string[]> {
    const visited = new Set<string>([id]);
    let frontier = [id];
    while (frontier.length) {
      const edges = await this.deps
        .createQueryBuilder("d")
        .where("d.parentAssetId IN (:...ids)", { ids: frontier })
        .getMany();
      const next = edges
        .map((e) => e.childAssetId)
        .filter((cid) => !visited.has(cid));
      next.forEach((n) => visited.add(n));
      frontier = next;
    }
    visited.delete(id);
    return [...visited];
  }
}
