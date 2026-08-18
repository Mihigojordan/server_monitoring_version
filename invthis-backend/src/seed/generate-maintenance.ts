import { randomUUID } from "crypto";
import { MaintenanceRecord } from "../../src/entities/maintenance-record.entity";
import { ConfigurationChange } from "../../src/entities/configuration-change.entity";
import { Rng } from "./rng";
import { BuiltInventory } from "./build-assets";
import { FailureScenario, ConfigChangeEffect } from "./generate-metrics";
import { SEED_CONFIG } from "./seed.config";

const DOMAIN_MAINTENANCE: Record<
  FailureScenario["domain"],
  { type: string; components: string[] }
> = {
  server: { type: "cpu_process_remediation", components: [] },
  disk: { type: "disk_replacement", components: ["disk"] },
  switch: { type: "transceiver_replacement", components: ["sfp_transceiver"] },
  storage: { type: "capacity_expansion", components: ["shelf"] },
  ups: { type: "battery_replacement", components: ["battery_pack"] },
};

function dayToDate(startMs: number, day: number): string {
  return new Date(startMs + day * 86_400_000).toISOString().slice(0, 10);
}

export interface MaintenanceBuildResult {
  maintenance: MaintenanceRecord[];
  configurationChanges: ConfigurationChange[];
}

export function buildMaintenanceAndConfig(
  inv: BuiltInventory,
  scenarios: FailureScenario[],
  configEffects: ConfigChangeEffect[],
  rng: Rng,
): MaintenanceBuildResult {
  const totalDays = SEED_CONFIG.days;
  const startMs = Date.now() - totalDays * 86_400_000;
  const maintenance: MaintenanceRecord[] = [];
  const configurationChanges: ConfigurationChange[] = [];

  // A maintenance record directly following each failure scenario's incident
  // — maintenance here is a consequence of the incident, not disconnected from it.
  for (const scenario of scenarios) {
    const def = DOMAIN_MAINTENANCE[scenario.domain];
    const m = new MaintenanceRecord();
    m.id = randomUUID();
    m.date = dayToDate(startMs, scenario.recoveryDay);
    m.assetId = scenario.assetId;
    m.maintenanceType = def.type;
    m.engineer = rng.pick([
      "J. Ortiz",
      "A. Nakamura",
      "S. Patel",
      "M. Kowalski",
    ]);
    m.description = `Remediation following ${scenario.incidentType} incident: ${scenario.resolution}`;
    m.componentsReplaced = def.components.length ? def.components : null;
    m.firmwareUpdated = null;
    m.previousCondition = "degraded";
    m.result = "resolved";
    m.nextMaintenanceDate = dayToDate(startMs, totalDays + rng.int(60, 180));
    maintenance.push(m);
  }

  // A few routine preventive-maintenance records unrelated to any incident.
  const routineCandidates = [
    ...inv.servers,
    ...inv.switches,
    ...inv.storageArrays,
  ];
  for (let i = 0; i < Math.min(3, routineCandidates.length); i++) {
    const asset = rng.pick(routineCandidates);
    const day = rng.between(0, totalDays);
    const m = new MaintenanceRecord();
    m.id = randomUUID();
    m.date = dayToDate(startMs, day);
    m.assetId = asset.id;
    m.maintenanceType = rng.pick([
      "firmware_upgrade",
      "preventive",
      "cleaning",
    ]);
    m.engineer = rng.pick([
      "J. Ortiz",
      "A. Nakamura",
      "S. Patel",
      "M. Kowalski",
    ]);
    m.description = "Scheduled preventive maintenance — no issues found.";
    m.componentsReplaced = null;
    m.firmwareUpdated =
      m.maintenanceType === "firmware_upgrade"
        ? `v${rng.int(1, 6)}.${rng.int(0, 9)}.${rng.int(0, 9)}`
        : null;
    m.previousCondition = "healthy";
    m.result = "ok";
    m.nextMaintenanceDate = dayToDate(startMs, day + rng.int(90, 180));
    maintenance.push(m);
  }

  // Config changes with a real metric effect (from the seed's own generator).
  for (const effect of configEffects) {
    const c = new ConfigurationChange();
    c.id = randomUUID();
    c.assetId = effect.assetId;
    c.user = "ops-team";
    c.changeType = effect.changeType;
    c.beforeValue = effect.beforeValue;
    c.afterValue = effect.afterValue;
    c.timestamp = dayToDate(startMs, effect.dayApplied) + "T00:00:00.000Z";
    c.reason = effect.reason;
    c.result = "success";
    configurationChanges.push(c);
  }

  // A couple of additional config changes for variety (no simulated metric effect, but real records).
  if (inv.firewalls.length) {
    const c = new ConfigurationChange();
    c.id = randomUUID();
    c.assetId = inv.firewalls[0].id;
    c.user = "security-team";
    c.changeType = "firewall_rule_change";
    c.beforeValue = "ALLOW 0.0.0.0/0:8080";
    c.afterValue = "ALLOW 10.0.0.0/8:8080";
    c.timestamp =
      dayToDate(startMs, rng.between(0, totalDays)) + "T00:00:00.000Z";
    c.reason =
      "Restricted an overly broad inbound rule found during a security review.";
    c.result = "success";
    configurationChanges.push(c);
  }
  if (inv.switches.length > 1) {
    const c = new ConfigurationChange();
    c.id = randomUUID();
    c.assetId = inv.switches[1].id;
    c.user = "network-team";
    c.changeType = "vlan_change";
    c.beforeValue = "VLAN 10";
    c.afterValue = "VLAN 20";
    c.timestamp =
      dayToDate(startMs, rng.between(0, totalDays)) + "T00:00:00.000Z";
    c.reason = "Segmented storage traffic onto a dedicated VLAN.";
    c.result = "success";
    configurationChanges.push(c);
  }

  return { maintenance, configurationChanges };
}
