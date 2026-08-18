# Implementation Roadmap — Getting the System Fully Operational

Companion to `systemoverview-summary.md`. That file describes the target system (per the thesis document). This file is the step-by-step task list to actually get there from where the codebase is today.

## Where things stand right now

- **Frontend** (`frontend/`) — React + Vite, talks directly to **Firebase/Firestore** for the infra modules (Server Management, Storage Management, Resources/Other Resources), and to an **existing separate AdonisJS backend** (`yb-vsdc-api`, not in this repo, expected at `localhost:8000`) for auth, users, branches, POS/stock/invoicing, and Rwanda EBM/VSDC tax integration. Don't touch that backend or its routes — it's out of scope here.
- **New backend** (`backend/`) — being scaffolded now with NestJS (see below). Currently empty/default — no database, no modules, no auth wired yet.
- **No live monitoring agent** — all server/storage data (status, CPU%, RAM%, capacity, etc.) is entered manually through the UI. Nothing in the system actually polls a real device.
- **No ML layer** — predictions, anomaly detection, forecasting described in the thesis document don't exist yet anywhere in the code.

Everything below is organized so each phase produces something usable on its own — you don't need to finish Phase 6 for Phases 1-5 to be worth having.

---

## Phase 0 — Already done ✅

- [x] Server Management module (list, add/edit, 9-tab detail: overview, hardware, performance, issues, services, logs, security, backups, deployments)
- [x] Storage Management module (list, add/edit, 6-tab detail: overview, capacity, volumes, snapshots, backups, alerts)
- [x] Sidebar restructured into Infrastructure / Reports / Support / Administration / Alerts
- [x] `systemoverview-summary.md` — target architecture documented

---

## Phase 1 — Backend foundation

- [x] Scaffold NestJS app in `backend/`
- [x] Decide the database: **staying on Firestore**, called via `firebase-admin` from NestJS instead of migrating to Postgres/MySQL/Mongo. Same `server-3d2d7` Firestore project the frontend already uses, so no data migration and one source of truth.
- [x] Wire `@nestjs/config` + `.env` (`PORT`, `JWT_SECRET`, `CORS_ORIGIN`, plus `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` in place of `DATABASE_URL`)
- [x] Add global `ValidationPipe`, CORS for the Vite dev origin, a `/health` endpoint
- [x] `src/firebase/firebase.module.ts` — global module providing a Firestore admin instance (`FIRESTORE` token) via `firebase-admin/app` + `firebase-admin/firestore`, built from service-account env vars. **Needs a real service account key** (Firebase console → Project settings → Service accounts → Generate new private key, `server-3d2d7` project) dropped into `backend/.env` before the app can actually boot — verified the app builds and fails exactly there (`FirebaseAppError: Service account object must contain a string "private_key" property`), not anywhere else.
- [ ] Auth module: JWT-based login/guard (mirrors the existing `vsdc_token` pattern the frontend already expects in `api/client.js`) — or, if this backend is infra-only, a lighter API-key/service-token scheme instead of full user auth
- [ ] Add `backend/` to Vite's dev proxy (`vite.config.js` `API_ROUTE_PREFIXES`) once real routes exist, e.g. `infra`

## Phase 2 — Core infra data model in the backend

Since Phase 1 kept Firestore rather than migrating, this is a wrapping exercise, not a data migration — the backend reads/writes the *same* `server-3d2d7` Firestore collections the frontend already uses (via the `FIRESTORE` provider from `firebase.module.ts`), so there's nothing to backfill and no dual-write period needed.

- [ ] `Server` module: CRUD matching what `ServerManagement.jsx` already writes to Firestore (name, status, type, provider, hardware fields, network fields, etc.), backed by the existing collection
- [ ] `StorageDevice` module: same, matching `StorageManagement.jsx`
- [ ] Child resources — `issues`, `services`, `logs`, `backups`, `deployments`, `perfSnapshots`, `volumes`, `snapshots` — stay as Firestore subcollections/arrays in the shape the frontend already writes; the backend module just wraps them in typed REST endpoints rather than restructuring the data
- [ ] Decide the migration path for the frontend: swap direct Firestore SDK calls for the new REST endpoints module-by-module (start with Server Management, since it's most complete), or run both in parallel during transition

## Phase 3 — Real data collection (closes the biggest gap)

This is what turns "manual tracking" into actual monitoring — the part the thesis document assumes exists.

- [ ] Pick a collection method per device type:
  - Linux/Windows servers → a lightweight agent (cron job / scheduled task) that POSTs CPU/RAM/disk/network readings to a new `backend` ingestion endpoint, **or**
  - SNMP polling from the backend for network-capable devices (switches, some storage arrays)
- [ ] `POST /infra/servers/:id/metrics` and `/infra/storage/:id/metrics` ingestion endpoints
- [ ] Scheduled job (`@nestjs/schedule`) to poll SNMP-capable devices on an interval
- [ ] Replace the manual "Log Snapshot" buttons in Performance/Capacity tabs with real ingested data once available — keep the manual option as a fallback for devices without agent support

## Phase 4 — Automated alerts

- [ ] Threshold rules table (per-metric warning/critical thresholds, configurable per device or global default)
- [ ] Background job evaluates incoming metrics against thresholds, writes to an `alerts` table when crossed
- [ ] Notification channel(s): email/SMTP at minimum (the existing System Configuration page already has SMTP settings — reuse them), Slack/webhook optional
- [ ] Wire the frontend's Alerts Center to read from the new backend alerts table instead of/alongside Firestore

## Phase 5 — Reporting

- [ ] Report definitions: monitoring summary, performance report, uptime/incident report
- [ ] `GET /infra/reports/:type?from=&to=&format=pdf|csv` — generate on demand from stored metrics
- [ ] Scheduled report generation (weekly/monthly) + storage of generated report artifacts
- [ ] Wire into the existing Reports section of the app

## Phase 6 — Machine learning layer

The part of the thesis document with no code yet, anywhere.

- [ ] Once Phase 3 has been running long enough to produce real historical data (weeks, not days), export it for training
- [ ] Prototype forecasting model (start with one metric, e.g. storage capacity trend → time-to-full) using Python (scikit-learn/statsmodels) as a **separate small service**, not inside NestJS — Node isn't the right tool for model training
- [ ] NestJS calls that Python service over HTTP/gRPC for predictions, or reads predictions the service writes back to the shared database
- [ ] Expand from one proof-of-concept model to the full set described in the thesis doc (Random Forest / XGBoost / SVM / ANN / LSTM) only after the first one is proven useful end-to-end
- [ ] Predictive Analytics + Predictive Maintenance UI pages, backed by real model output (no fabricated numbers — consistent with how the rest of this app has been built)

## Phase 7 — Remaining infrastructure modules

Per the original module plan: Network Management is now built (list dashboard → add/edit → detail tabs, same pattern as Server/Storage Management; per-device Ports and Alerts & Health tabs; one-click migration of any Blade Switch records left over in "Other Resources"). Still not started: Database Management, Cloud Management, Container Management, Security Management (org-wide, distinct from per-server Security tabs), a unified Monitoring module, and Alerts & Incidents as a first-class module rather than living inside Alerts Center. Build these one at a time, same pattern.

## Phase 8 — Hardening

- [ ] Security review of the new backend (auth, input validation, rate limiting on ingestion endpoints)
- [ ] Backup/restore procedure for the new database (Phase 1 decision determines the tooling)
- [ ] Load-test the metrics ingestion path before connecting real devices at scale
- [ ] Documentation: update `ROADMAP.md` (currently describes pages that were removed in an earlier simplification pass — it's stale and should be reconciled or replaced)

---

## Suggested order if you want to start today

1. ~~Finish the NestJS scaffold~~ ✅ / ~~Decide the database~~ ✅ (Firestore via `firebase-admin`) — done, see Phase 1
2. Drop a real Firebase service-account key into `backend/.env` (`FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`) so the app can actually boot — this is the one thing genuinely blocking right now
3. Build the `Server` module end-to-end in the backend (Phase 2) as a proof of the whole pattern, before repeating it for Storage
4. Only then move to Phase 3 (real data collection) — no point automating collection into a data model that's still changing
