# invthis-backend

A standalone predictive-infrastructure dataset service — separate from `backend/`
(this project's real, Firestore-backed app). This one is synthetic by design:
a realistic, internally-consistent time-series + event + relationship dataset
covering servers, storage, switches, network, power, environment,
applications, databases, incidents, maintenance and configuration history,
built to be the training/feature source for a future ML pipeline (capacity
forecasting, failure prediction, anomaly detection, predictive maintenance).

## Stack

- **NestJS + TypeScript**, matching `backend/`'s conventions.
- **TypeORM + `sql.js`** (pure WASM SQLite — chosen because this environment
  has no C++ toolchain/Python, so `better-sqlite3`/`sqlite3` can't compile).
  The whole DB lives in memory at runtime and is explicitly persisted to
  `data/invthis.sqlite` — **not** via TypeORM's `autoSave` (which would
  serialize the entire DB to disk after every single insert and make bulk
  seeding unusably slow). See `src/config/database.config.ts` and
  `src/scripts/migrate.ts` for why.
- If this ever needs to scale past what's comfortable in memory, swap
  `dataSourceOptions` for a Postgres config — every entity and service here
  is driver-agnostic; nothing SQLite-specific leaks into the app layer.

## Schema

One flexible **Asset** table (type-discriminated) represents every physical
and logical thing — data centers, racks, servers, VMs, storage
devices/arrays, disks, switches, routers, firewalls, load balancers, UPS,
PDUs, applications, databases — instead of 18 near-duplicate tables, per the
brief's own framing ("a common infrastructure asset structure"). Physical
containment (rack → server) is `Asset.parentAssetId`; functional
relationships (UPS *powers* a rack, a switch *connects* servers, a server
*hosts* an application) are separate many-to-many edges in
**AssetDependency**, because those are two different graphs.

All numeric time series — CPU, RAM, disk I/O, port utilization, UPS battery,
room temperature, app latency, everything — live in one long-format
**Metric** table (`assetId, metricName, value, unit, timestamp`), indexed on
`(assetId, timestamp)` and `(assetId, metricName, timestamp)`. This is a
deliberate choice over a wide table per asset type: it's the standard shape
a feature-engineering pipeline expects, and it means adding a new metric
never needs a migration. The canonical metric names are centralized in
`src/common/metric-names.ts` so the generator and the feature engine never
drift apart.

| Table | Purpose |
|---|---|
| `assets` | Every infrastructure object |
| `asset_dependencies` | Functional graph edges (powers/connects/hosts/stores_data_for/routes_to/cools) |
| `metrics` | Long-format time series, every domain |
| `logs` | Structured INFO/WARNING/ERROR/CRITICAL log lines, correlated to events via `correlationId` |
| `events` | Discrete occurrences (reboots, warnings, deployments, backups...) |
| `incidents` | Real failures, each with a `relatedEventIds` precursor chain |
| `maintenance_records` | Service history, several written as a direct consequence of an incident |
| `configuration_changes` | Infra changes, one of which has a real, visible effect on a subsequent metric |
| `predictive_features` | Wide ML feature table — CPU/RAM/storage/network/temperature/error/reliability groups |
| `prediction_labels` | `failure_next_1h` ... `disk_failure_next_7d`, one row per (asset, asOf, label) |

## The anti-leakage guarantee

This is the one rule the whole dataset exists to demonstrate:

- **`PredictiveFeature`** rows are computed only from metrics/logs/incidents/
  maintenance dated **`<= computedAt`** (`FeaturesService.computeFeatures`).
- **`PredictionLabel`** rows are computed only by checking whether a real
  `Incident` **started strictly after `asOf`**, within the label's horizon
  (`LabelsService.computeLabels` → `IncidentsService.incidentTypeOccursWithinHorizon`).
- Nothing is ever randomly assigned. A label is `1` if and only if a real
  incident of that type actually happened later in the generated history.

Verified on this run: `storage_full_next_7d` for the storage array that
actually hit 100% on day 28 flips from `0` to `1` exactly 7 days before the
incident, and back to `0` the moment the incident has already started
(chronologically it's no longer "in the future"). Reproduce with:

```
GET /infrastructure/prediction-labels?assetId=<the storage array>&labelName=storage_full_next_7d
GET /infrastructure/prediction-features?assetId=<the storage array>
```

## Injected failure scenarios

Five real, correlated failure stories are woven into the generated history
(`src/seed/generate-metrics.ts` + `generate-events.ts`), each following the
brief's "past observations → trends → anomalies → events → incident →
recovery" shape:

1. **Server CPU overload** — `srv-01`: CPU/temperature climb over ~10 days, precursor events (cpu_warning → kernel_warning), `cpu_overload` incident, reboot, recovery.
2. **Disk failure** — a disk under `stg-01`: temperature + reallocated-sector count climb, `disk_failure` incident, drive replaced (maintenance record).
3. **Switch failure** — `sw-01`: packet loss + CRC errors climb, `switch_failure` incident, transceiver replaced.
4. **Storage exhaustion** — `stg-01`: capacity grows continuously across the *entire* window (not a short precursor), crossing 80/90/95/100% until `storage_full`.
5. **UPS failure** — `DC-1-UPS-1`: battery health *declines* (not climbs) over ~11 days, `ups_failure` incident, battery pack replaced.

Rack/room temperature is **not** independent random noise — it's derived
from the average CPU temperature of servers physically in that rack that
same day (`generate-metrics.ts`, the "Environmental" section).

## Running it

```bash
npm install
npm run migration:run   # creates data/invthis.sqlite and applies the schema
npm run seed             # generates and inserts the dataset (see config below)
npm run start:dev        # API on :3002 (PORT env var to change)
```

### Seed scale

Every count is env-overridable (`src/seed/seed.config.ts`). The checked-in
default is a **small, fully real run** — every asset type and every
generation pathway exercised at least once, sized to actually finish and be
reviewable:

| Var | Default | Var | Default |
|---|---|---|---|
| `SEED_DAYS` | 30 | `SWITCHES` | 3 |
| `DATA_CENTERS` | 2 | `ROUTERS` / `FIREWALLS` / `LOAD_BALANCERS` | 1 each |
| `RACKS_PER_DC` | 2 | `UPS_COUNT` / `PDU_COUNT` | 2 each |
| `SERVERS` | 5 | `APPLICATIONS` | 8 |
| `STORAGE_SYSTEMS` | 2 | `DATABASES` | 4 |
| `DISKS_PER_STORAGE` | 3 | `METRIC_INTERVAL` (minutes, servers/storage/switches) | 15 |
| `STANDARD_METRIC_INTERVAL` | 30 | `ENV_METRIC_INTERVAL` | 60 |
| `FEATURE_INTERVAL_HOURS` | 24 | `SEED_RANDOM_SEED` | 20260817 |

To go toward the brief's full scale (100 servers, 90 days, 5-minute
intervals for critical infra), e.g.:

```bash
SEED_DAYS=90 SERVERS=100 STORAGE_SYSTEMS=15 SWITCHES=25 METRIC_INTERVAL=5 npm run seed
```

Expect this to take substantially longer and produce tens of millions of
rows — `sql.js` keeps the whole DB in memory, so at that scale you'd likely
want to switch `dataSourceOptions` to Postgres first.

## API

All routes adapted to this project's REST conventions; every response is
real, generated data — nothing hand-authored per endpoint.

| Route | Purpose |
|---|---|
| `GET /assets?type=` | List assets, optional type filter |
| `GET /assets/:id` | One asset |
| `GET /assets/:id/dependencies` | What it depends on + what depends on it |
| `GET /assets/:id/impact` | Full transitive impact radius (BFS over the dependency graph) |
| `GET /servers/:id/metrics` `/storage/:id/metrics` `/switches/:id/metrics` `/assets/:id/metrics` | Time series, `?metricName=&from=&to=` |
| `GET /events` `/logs` | Filterable by `assetId`, `severity`, `from`, `to` |
| `GET /infrastructure/incidents` `/infrastructure/incidents/active` | Incident history / currently unresolved |
| `GET /maintenance` `/configuration-changes` | Filterable by `assetId` |
| `GET /infrastructure/prediction-features` `/infrastructure/prediction-labels` | The ML feature/label tables, filterable by `assetId` |
| `GET /infrastructure/health` | Overall + per-domain rollup |
| `GET /infrastructure/capacity-forecast` | Every storage asset's days-to-80/90/95/full |
| `GET /infrastructure/top-risky-assets?limit=` | Ranked by the disclosed heuristic risk score |
| `GET /infrastructure/recent-anomalies?limit=` | Recent warning/critical events, fleet-wide |
| `GET /infrastructure/assets/:id/risk-profile` | `{ assetId, healthScore, riskScore, predictions: {...} }` — `predictions` is the asset's most recent *actual* label outcomes (real historical 0/1, not a trained model's probability — there's no model yet, that's the next step this dataset is for) |

`healthScore`/`riskScore` are a disclosed heuristic (utilization proximity to
saturation + trend + temperature + recent errors/incidents), the same family
of scoring used elsewhere in this project — not a fabricated number, and
explicitly not a substitute for training a real model on `predictive_features`
+ `prediction_labels`.
