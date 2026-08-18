import { randomUUID } from "crypto";
import {
  InfraEvent,
  EventSeverity,
} from "../../src/entities/infra-event.entity";
import { LogEntry, LogSeverity } from "../../src/entities/log-entry.entity";
import { Incident } from "../../src/entities/incident.entity";
import { Rng } from "./rng";
import { BuiltInventory } from "./build-assets";
import { FailureScenario } from "./generate-metrics";
import { SEED_CONFIG } from "./seed.config";

const PRECURSOR_STEPS: Record<
  FailureScenario["domain"],
  { eventType: string; template: (pct: number) => string }[]
> = {
  server: [
    {
      eventType: "cpu_warning",
      template: () =>
        "Sustained CPU utilization above 65% for over 15 minutes.",
    },
    {
      eventType: "cpu_warning",
      template: () => "CPU utilization crossed 80% — thermal throttling risk.",
    },
    {
      eventType: "temperature_warning",
      template: () => "CPU temperature rising alongside sustained load.",
    },
    {
      eventType: "kernel_warning",
      template: () => "Kernel reported soft lockup warning on CPU core.",
    },
  ],
  disk: [
    {
      eventType: "disk_warning",
      template: () => "SMART pre-fail attribute trending toward threshold.",
    },
    {
      eventType: "disk_warning",
      template: () => "Reallocated sector count increasing.",
    },
    {
      eventType: "disk_warning",
      template: () => "Read latency degrading beyond baseline.",
    },
  ],
  switch: [
    {
      eventType: "port_flapping",
      template: () => "Uplink port state flapping intermittently.",
    },
    {
      eventType: "crc_error_warning",
      template: () => "CRC error rate climbing on uplink interface.",
    },
    {
      eventType: "network_congestion",
      template: () => "Packet loss detected on uplink under load.",
    },
  ],
  storage: [
    {
      eventType: "capacity_warning",
      template: (pct) => `Storage utilization crossed ${pct}%.`,
    },
  ],
  ups: [
    {
      eventType: "ups_warning",
      template: () => "UPS battery self-test reported reduced runtime.",
    },
    {
      eventType: "ups_warning",
      template: () => "UPS battery health degrading — replacement recommended.",
    },
  ],
};

function dayToIso(startMs: number, day: number): string {
  return new Date(startMs + day * 86_400_000).toISOString();
}

export interface EventBuildResult {
  events: InfraEvent[];
  logs: LogEntry[];
  incidents: Incident[];
}

export function buildEventsAndIncidents(
  inv: BuiltInventory,
  scenarios: FailureScenario[],
  rng: Rng,
): EventBuildResult {
  const totalDays = SEED_CONFIG.days;
  const startMs = Date.now() - totalDays * 86_400_000;
  const events: InfraEvent[] = [];
  const logs: LogEntry[] = [];
  const incidents: Incident[] = [];

  function addEvent(
    assetId: string,
    day: number,
    eventType: string,
    severity: EventSeverity,
    description: string,
    correlationId: string,
  ): InfraEvent {
    const e = new InfraEvent();
    e.id = randomUUID();
    e.timestamp = dayToIso(startMs, day);
    e.assetId = assetId;
    e.eventType = eventType;
    e.severity = severity;
    e.description = description;
    e.status = "resolved";
    e.source = "monitoring";
    e.correlationId = correlationId;
    events.push(e);
    return e;
  }

  function addLog(
    assetId: string,
    day: number,
    severity: LogSeverity,
    eventType: string,
    message: string,
    correlationId?: string,
  ) {
    const l = new LogEntry();
    l.timestamp = dayToIso(startMs, day);
    l.assetId = assetId;
    l.service = "infra-agent";
    l.component = eventType;
    l.severity = severity;
    l.eventType = eventType;
    l.errorCode =
      severity === LogSeverity.ERROR || severity === LogSeverity.CRITICAL
        ? `E-${rng.int(1000, 9999)}`
        : null;
    l.message = message;
    l.source = "monitoring";
    l.correlationId = correlationId ?? null;
    logs.push(l);
  }

  // ── Failure scenarios: precursor events -> logs -> incident -> recovery ──
  for (const scenario of scenarios) {
    const correlationId = randomUUID();
    const steps = PRECURSOR_STEPS[scenario.domain];
    const relatedEventIds: string[] = [];
    const span = scenario.failureDay - scenario.precursorStartDay;

    steps.forEach((step, i) => {
      const day =
        scenario.precursorStartDay + (span * (i + 1)) / (steps.length + 1);
      const pct = Math.round(60 + (35 * (i + 1)) / steps.length);
      const severity =
        i < steps.length - 1 ? EventSeverity.WARNING : EventSeverity.CRITICAL;
      const description = step.template(pct);
      const ev = addEvent(
        scenario.assetId,
        day,
        step.eventType,
        severity,
        description,
        correlationId,
      );
      relatedEventIds.push(ev.id);
      addLog(
        scenario.assetId,
        day,
        severity === EventSeverity.CRITICAL
          ? LogSeverity.ERROR
          : LogSeverity.WARNING,
        step.eventType,
        description,
        correlationId,
      );
    });

    const incident = new Incident();
    incident.id = randomUUID();
    incident.assetId = scenario.assetId;
    incident.incidentType = scenario.incidentType;
    incident.severity = scenario.severity;
    incident.startedAt = dayToIso(startMs, scenario.failureDay);
    incident.detectedAt = dayToIso(startMs, scenario.failureDay + 0.01);
    incident.resolvedAt = dayToIso(startMs, scenario.recoveryDay);
    incident.durationSeconds = Math.max(
      60,
      Math.round((scenario.recoveryDay - scenario.failureDay) * 86400),
    );
    incident.rootCause = scenario.rootCause;
    incident.resolution = scenario.resolution;
    incident.impact = scenario.impact;
    incident.relatedEventIds = relatedEventIds;
    incidents.push(incident);

    addLog(
      scenario.assetId,
      scenario.failureDay,
      LogSeverity.CRITICAL,
      scenario.incidentType,
      `${scenario.incidentType.replace(/_/g, " ")} — ${scenario.rootCause}`,
      correlationId,
    );
    const recoveryEvent = addEvent(
      scenario.assetId,
      scenario.recoveryDay,
      `${scenario.incidentType}_resolved`,
      EventSeverity.INFO,
      scenario.resolution,
      correlationId,
    );
    addLog(
      scenario.assetId,
      scenario.recoveryDay,
      LogSeverity.INFO,
      recoveryEvent.eventType,
      scenario.resolution,
      correlationId,
    );
  }

  // ── Routine background events (not failures — normal operational noise) ──
  for (const app of inv.applications) {
    const deployCount = rng.int(1, 3);
    for (let i = 0; i < deployCount; i++) {
      const day = rng.between(0, totalDays);
      const cid = randomUUID();
      addEvent(
        app.id,
        day,
        "deployment",
        EventSeverity.INFO,
        `Deployed ${app.name} ${rng.pick(["v2.4.2", "v2.5.0", "v2.5.1"])}.`,
        cid,
      );
      addLog(
        app.id,
        day,
        LogSeverity.INFO,
        "deployment",
        `Deployment completed successfully for ${app.name}.`,
        cid,
      );
    }
  }
  for (const server of inv.servers) {
    for (let day = 0; day < totalDays; day += 1) {
      if (!rng.chance(0.12)) continue;
      const cid = randomUUID();
      addEvent(
        server.id,
        day,
        "database_backup",
        EventSeverity.INFO,
        `Nightly backup completed for ${server.name}.`,
        cid,
      );
      addLog(
        server.id,
        day,
        LogSeverity.INFO,
        "backup",
        `Backup job finished in ${rng.int(4, 40)} minutes.`,
        cid,
      );
    }
  }
  // A modest amount of routine INFO log noise so logs aren't purely failure-triggered.
  for (const asset of [...inv.servers, ...inv.switches, ...inv.storageArrays]) {
    for (let i = 0; i < rng.int(3, 8); i++) {
      const day = rng.between(0, totalDays);
      addLog(
        asset.id,
        day,
        LogSeverity.INFO,
        "health_check",
        "Scheduled health check passed.",
      );
    }
  }

  return { events, logs, incidents };
}
