import {
  Asset,
  AssetStatus,
  AssetType,
  LifecycleStatus,
} from "../../src/entities/asset.entity";
import {
  AssetDependency,
  DependencyType,
} from "../../src/entities/asset-dependency.entity";
import { Rng } from "./rng";
import { SEED_CONFIG } from "./seed.config";
import { randomUUID } from "crypto";

const SERVER_MODELS = [
  { model: "PowerEdge R740", manufacturer: "Dell" },
  { model: "ProLiant DL380 Gen10", manufacturer: "HPE" },
  { model: "ThinkSystem SR650", manufacturer: "Lenovo" },
];
const STORAGE_MODELS = [
  { model: "PowerVault ME5024", manufacturer: "Dell" },
  { model: "FAS2750", manufacturer: "NetApp" },
];
const SWITCH_MODELS = [
  { model: "Catalyst 9300-48P", manufacturer: "Cisco" },
  { model: "EX4300-48T", manufacturer: "Juniper" },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function newAsset(
  rng: Rng,
  opts: Partial<Asset> & { name: string; type: AssetType },
): Asset {
  const a = new Asset();
  a.id = randomUUID();
  a.name = opts.name;
  a.type = opts.type;
  a.status = opts.status ?? AssetStatus.ACTIVE;
  a.location = opts.location ?? null;
  a.parentAssetId = opts.parentAssetId ?? null;
  a.manufacturer = opts.manufacturer ?? null;
  a.model = opts.model ?? null;
  a.serialNumber = opts.serialNumber ?? `SN-${rng.int(100000, 999999)}`;
  a.firmware =
    opts.firmware ?? `v${rng.int(1, 6)}.${rng.int(0, 9)}.${rng.int(0, 9)}`;
  a.ipAddress = opts.ipAddress ?? null;
  a.macAddress = opts.macAddress ?? null;
  const ageYears = rng.between(0.3, 6);
  a.installDate = opts.installDate ?? isoDaysAgo(Math.round(ageYears * 365));
  a.warrantyExpiry =
    opts.warrantyExpiry ??
    new Date(
      new Date(a.installDate).getTime() +
        rng.pick([3, 4, 5]) * 365 * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
  a.lifecycleStatus =
    opts.lifecycleStatus ??
    (ageYears > 5 ? LifecycleStatus.AGING : LifecycleStatus.IN_SERVICE);
  return a;
}

export interface BuiltInventory {
  all: Asset[];
  dependencies: AssetDependency[];
  dataCenters: Asset[];
  racks: Asset[];
  servers: Asset[];
  storageArrays: Asset[];
  disks: Asset[];
  switches: Asset[];
  routers: Asset[];
  firewalls: Asset[];
  loadBalancers: Asset[];
  upsList: Asset[];
  pdus: Asset[];
  applications: Asset[];
  databases: Asset[];
  rackOfAsset: Map<string, string>;
}

function dep(
  parentAssetId: string,
  childAssetId: string,
  dependencyType: DependencyType,
): AssetDependency {
  const d = new AssetDependency();
  d.id = randomUUID();
  d.parentAssetId = parentAssetId;
  d.childAssetId = childAssetId;
  d.dependencyType = dependencyType;
  return d;
}

/**
 * Builds the physical + logical asset graph: Data Center -> Rack -> Server/
 * Storage/Switch -> Disk, plus the functional dependency edges (UPS powers
 * racks, racks power the devices in them, routers/firewalls/switches form
 * the network path, servers host applications which use databases and
 * storage). Everything downstream (metrics, events, incidents) is generated
 * against this same graph.
 */
export function buildAssets(rng: Rng): BuiltInventory {
  const cfg = SEED_CONFIG;
  const all: Asset[] = [];
  const dependencies: AssetDependency[] = [];
  const rackOfAsset = new Map<string, string>();

  const dataCenters: Asset[] = [];
  const racks: Asset[] = [];
  for (let dcI = 0; dcI < cfg.dataCenters; dcI++) {
    const dc = newAsset(rng, {
      name: `DC-${dcI + 1}`,
      type: AssetType.DATA_CENTER,
      location: rng.pick(["New York", "Frankfurt", "Singapore"]),
    });
    dataCenters.push(dc);
    all.push(dc);

    for (let r = 0; r < cfg.racksPerDc; r++) {
      const rack = newAsset(rng, {
        name: `${dc.name}-Rack-${String.fromCharCode(65 + r)}`,
        type: AssetType.RACK,
        location: dc.location,
        parentAssetId: dc.id,
      });
      racks.push(rack);
      all.push(rack);
    }
  }

  // Power: one UPS per data center (or two for the first, to exercise >1),
  // each UPS powers every rack in its DC; a PDU sits under each rack too.
  const upsList: Asset[] = [];
  const pdus: Asset[] = [];
  for (let i = 0; i < cfg.upsCount; i++) {
    const dc = dataCenters[i % dataCenters.length];
    const ups = newAsset(rng, {
      name: `${dc.name}-UPS-${i + 1}`,
      type: AssetType.UPS,
      manufacturer: "APC",
      model: "Smart-UPS SRT 10000VA",
      parentAssetId: dc.id,
      location: dc.location,
    });
    upsList.push(ups);
    all.push(ups);
    for (const rack of racks.filter((r) => r.parentAssetId === dc.id)) {
      dependencies.push(dep(ups.id, rack.id, DependencyType.POWERS));
    }
  }
  for (const rack of racks) {
    const pdu = newAsset(rng, {
      name: `${rack.name}-PDU`,
      type: AssetType.PDU,
      manufacturer: "Raritan",
      parentAssetId: rack.id,
    });
    pdus.push(pdu);
    all.push(pdu);
  }

  const servers: Asset[] = [];
  for (let i = 0; i < cfg.servers; i++) {
    const rack = racks[i % racks.length];
    const { model, manufacturer } = rng.pick(SERVER_MODELS);
    const server = newAsset(rng, {
      name: `srv-${String(i + 1).padStart(2, "0")}`,
      type: AssetType.SERVER,
      manufacturer,
      model,
      parentAssetId: rack.id,
      location: rack.location,
      ipAddress: `10.${rng.int(0, 3)}.${rng.int(0, 20)}.${rng.int(2, 250)}`,
      macAddress: `02:00:00:${rng.int(0, 255).toString(16).padStart(2, "0")}:${rng.int(0, 255).toString(16).padStart(2, "0")}:${rng.int(0, 255).toString(16).padStart(2, "0")}`,
    });
    servers.push(server);
    all.push(server);
    rackOfAsset.set(server.id, rack.id);
    dependencies.push(dep(rack.id, server.id, DependencyType.POWERS));
  }

  const storageArrays: Asset[] = [];
  const disks: Asset[] = [];
  for (let i = 0; i < cfg.storageSystems; i++) {
    const rack = racks[i % racks.length];
    const { model, manufacturer } = rng.pick(STORAGE_MODELS);
    const arr = newAsset(rng, {
      name: `stg-${String(i + 1).padStart(2, "0")}`,
      type: AssetType.STORAGE_ARRAY,
      manufacturer,
      model,
      parentAssetId: rack.id,
      location: rack.location,
      ipAddress: `10.${rng.int(0, 3)}.${rng.int(0, 20)}.${rng.int(2, 250)}`,
    });
    storageArrays.push(arr);
    all.push(arr);
    rackOfAsset.set(arr.id, rack.id);
    dependencies.push(dep(rack.id, arr.id, DependencyType.POWERS));

    for (let d = 0; d < cfg.disksPerStorage; d++) {
      const disk = newAsset(rng, {
        name: `${arr.name}-disk-${d + 1}`,
        type: AssetType.DISK,
        manufacturer: rng.pick(["Seagate", "Western Digital", "Samsung"]),
        model: rng.pick(["Exos X18", "Ultrastar DC HC550", "983 DCT NVMe"]),
        parentAssetId: arr.id,
      });
      disks.push(disk);
      all.push(disk);
      rackOfAsset.set(disk.id, rack.id);
    }
  }

  const switches: Asset[] = [];
  for (let i = 0; i < cfg.switches; i++) {
    const rack = racks[i % racks.length];
    const { model, manufacturer } = rng.pick(SWITCH_MODELS);
    const sw = newAsset(rng, {
      name: `sw-${String(i + 1).padStart(2, "0")}`,
      type: AssetType.SWITCH,
      manufacturer,
      model,
      parentAssetId: rack.id,
      location: rack.location,
      ipAddress: `10.${rng.int(0, 3)}.0.${rng.int(2, 250)}`,
    });
    switches.push(sw);
    all.push(sw);
    rackOfAsset.set(sw.id, rack.id);
    dependencies.push(dep(rack.id, sw.id, DependencyType.POWERS));

    // Each switch connects the servers/storage physically in the same rack.
    for (const asset of [...servers, ...storageArrays].filter(
      (a) => a.parentAssetId === rack.id,
    )) {
      dependencies.push(dep(sw.id, asset.id, DependencyType.CONNECTS));
    }
  }

  const routers: Asset[] = [];
  for (let i = 0; i < cfg.routers; i++) {
    routers.push(
      newAsset(rng, {
        name: `router-${i + 1}`,
        type: AssetType.ROUTER,
        manufacturer: "Cisco",
        model: "ASR 1001-X",
      }),
    );
  }
  const firewalls: Asset[] = [];
  for (let i = 0; i < cfg.firewalls; i++) {
    firewalls.push(
      newAsset(rng, {
        name: `firewall-${i + 1}`,
        type: AssetType.FIREWALL,
        manufacturer: "Palo Alto",
        model: "PA-820",
      }),
    );
  }
  const loadBalancers: Asset[] = [];
  for (let i = 0; i < cfg.loadBalancers; i++) {
    loadBalancers.push(
      newAsset(rng, {
        name: `lb-${i + 1}`,
        type: AssetType.LOAD_BALANCER,
        manufacturer: "F5",
        model: "BIG-IP i2600",
      }),
    );
  }
  all.push(...routers, ...firewalls, ...loadBalancers);

  // Internet -> Router -> Firewall -> core Switch -> access switches -> servers
  for (const router of routers) {
    for (const fw of firewalls)
      dependencies.push(dep(router.id, fw.id, DependencyType.ROUTES_TO));
  }
  const coreSwitch = switches[0];
  if (coreSwitch) {
    for (const fw of firewalls)
      dependencies.push(dep(fw.id, coreSwitch.id, DependencyType.ROUTES_TO));
    for (const sw of switches.slice(1))
      dependencies.push(dep(coreSwitch.id, sw.id, DependencyType.CONNECTS));
  }
  for (const lb of loadBalancers) {
    for (const server of servers)
      dependencies.push(dep(lb.id, server.id, DependencyType.ROUTES_TO));
  }

  const databases: Asset[] = [];
  for (let i = 0; i < cfg.databases; i++) {
    const host = servers[i % servers.length];
    const db = newAsset(rng, {
      name: `db-${rng.pick(["orders", "users", "billing", "inventory", "analytics"])}-${i + 1}`,
      type: AssetType.DATABASE,
      model: rng.pick(["PostgreSQL 16", "MySQL 8.0"]),
      parentAssetId: host.id,
    });
    databases.push(db);
    all.push(db);
    dependencies.push(dep(host.id, db.id, DependencyType.HOSTS));
    if (storageArrays.length)
      dependencies.push(
        dep(
          storageArrays[i % storageArrays.length].id,
          db.id,
          DependencyType.STORES_DATA_FOR,
        ),
      );
  }

  const applications: Asset[] = [];
  for (let i = 0; i < cfg.applications; i++) {
    const host = servers[i % servers.length];
    const app = newAsset(rng, {
      name: `${rng.pick(["api", "web", "worker", "auth", "billing", "search"])}-${rng.pick(["gateway", "service", "app"])}-${i + 1}`,
      type: AssetType.APPLICATION,
      model: rng.pick(["v2.4.1", "v3.0.0", "v1.9.7"]),
      parentAssetId: host.id,
    });
    applications.push(app);
    all.push(app);
    dependencies.push(dep(host.id, app.id, DependencyType.HOSTS));
    if (databases.length)
      dependencies.push(
        dep(
          databases[i % databases.length].id,
          app.id,
          DependencyType.STORES_DATA_FOR,
        ),
      );
  }

  return {
    all,
    dependencies,
    dataCenters,
    racks,
    servers,
    storageArrays,
    disks,
    switches,
    routers,
    firewalls,
    loadBalancers,
    upsList,
    pdus,
    applications,
    databases,
    rackOfAsset,
  };
}
