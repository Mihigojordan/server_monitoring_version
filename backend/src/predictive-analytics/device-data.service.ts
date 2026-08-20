import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.module';
import { TimedSample } from './trend.util';

export interface ServerDoc {
  id: string;
  name: string;
  role: string | null;
  location: string | null;
  status: string;
  createdAt: Date | null;
  cpuUsage: number;
  ramUsedGb: number;
  ramTotalGb: number;
  storageUsedGb: number;
  storageTotalGb: number;
  cpuHistory: TimedSample[];
  ramHistory: TimedSample[];
  diskHistory: TimedSample[];
}

export interface StorageDoc {
  id: string;
  name: string;
  type: string | null;
  location: string | null;
  status: string;
  createdAt: Date | null;
  capacityUsedGb: number;
  capacityTotalGb: number;
  latencyMs: number;
  iops: number;
  throughputMbps: number;
  capacityHistory: TimedSample[];
  latencyHistory: TimedSample[];
}

export interface SwitchDoc {
  id: string;
  name: string;
  model: string | null;
  location: string | null;
  status: string;
  createdAt: Date | null;
  portCount: number;
  portsUp: number;
  portUtilizationHistory: TimedSample[];
}

function toDate(ts: unknown): Date | null {
  const anyTs = ts as { toDate?: () => Date } | null | undefined;
  return anyTs?.toDate ? anyTs.toDate() : null;
}

interface RawServerData {
  name?: string;
  role?: string;
  type?: string;
  location?: string;
  status?: string;
  createdAt?: unknown;
  cpuUsage?: number;
  ramUsedGb?: number;
  ramTotalGb?: number;
  storageUsedGb?: number;
  storageTotalGb?: number;
}

interface RawServerSnapshot {
  createdAt?: unknown;
  cpuPct?: number;
  ramPct?: number;
  diskPct?: number;
}

interface RawStorageData {
  name?: string;
  type?: string;
  location?: string;
  status?: string;
  createdAt?: unknown;
  capacityUsedGb?: number;
  capacityTotalGb?: number;
  latencyMs?: number;
  iops?: number;
  throughputMbps?: number;
}

interface RawStorageSnapshot {
  createdAt?: unknown;
  usedPct?: number;
  latencyMs?: number;
}

interface RawSwitchData {
  name?: string;
  model?: string;
  manufacturer?: string;
  location?: string;
  status?: string;
  createdAt?: unknown;
  portCount?: number;
}

interface RawPortData {
  status?: string;
}

interface RawSwitchSnapshot {
  createdAt?: unknown;
  usedPct?: number;
}

/**
 * Reads live device inventory + manually-logged perfSnapshots straight from
 * Firestore — the same servers/storageDevices/networkDevices collections
 * the Device Management pages read and write, so predictive analytics never
 * shows a device name that doesn't exist in the real fleet.
 */
@Injectable()
export class DeviceDataService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
  ) {}

  private db(): Firestore {
    if (!this.firestore) {
      throw new ServiceUnavailableException(
        'Firebase is not configured — add a real FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY to backend/.env to enable predictive analytics.',
      );
    }
    return this.firestore;
  }

  async getServers(): Promise<ServerDoc[]> {
    const db = this.db();
    const snap = await db.collection('servers').get();

    return Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() as RawServerData;
        const histSnap = await doc.ref
          .collection('perfSnapshots')
          .orderBy('createdAt', 'asc')
          .get();

        const cpuHistory: TimedSample[] = [];
        const ramHistory: TimedSample[] = [];
        const diskHistory: TimedSample[] = [];
        for (const h of histSnap.docs) {
          const hd = h.data() as RawServerSnapshot;
          const timestamp = toDate(hd.createdAt);
          if (!timestamp) continue;
          if (hd.cpuPct != null)
            cpuHistory.push({ timestamp, value: Number(hd.cpuPct) });
          if (hd.ramPct != null)
            ramHistory.push({ timestamp, value: Number(hd.ramPct) });
          if (hd.diskPct != null)
            diskHistory.push({ timestamp, value: Number(hd.diskPct) });
        }

        return {
          id: doc.id,
          name: data.name ?? doc.id,
          role: data.role ?? data.type ?? null,
          location: data.location ?? null,
          status: data.status ?? 'Offline',
          createdAt: toDate(data.createdAt),
          cpuUsage: Number(data.cpuUsage) || 0,
          ramUsedGb: Number(data.ramUsedGb) || 0,
          ramTotalGb: Number(data.ramTotalGb) || 0,
          storageUsedGb: Number(data.storageUsedGb) || 0,
          storageTotalGb: Number(data.storageTotalGb) || 0,
          cpuHistory,
          ramHistory,
          diskHistory,
        };
      }),
    );
  }

  async getStorage(): Promise<StorageDoc[]> {
    const db = this.db();
    const snap = await db.collection('storageDevices').get();

    return Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() as RawStorageData;
        const histSnap = await doc.ref
          .collection('perfSnapshots')
          .orderBy('createdAt', 'asc')
          .get();

        const capacityHistory: TimedSample[] = [];
        const latencyHistory: TimedSample[] = [];
        for (const h of histSnap.docs) {
          const hd = h.data() as RawStorageSnapshot;
          const timestamp = toDate(hd.createdAt);
          if (!timestamp) continue;
          if (hd.usedPct != null)
            capacityHistory.push({ timestamp, value: Number(hd.usedPct) });
          if (hd.latencyMs != null)
            latencyHistory.push({ timestamp, value: Number(hd.latencyMs) });
        }

        return {
          id: doc.id,
          name: data.name ?? doc.id,
          type: data.type ?? null,
          location: data.location ?? null,
          status: data.status ?? 'Offline',
          createdAt: toDate(data.createdAt),
          capacityUsedGb: Number(data.capacityUsedGb) || 0,
          capacityTotalGb: Number(data.capacityTotalGb) || 0,
          latencyMs: Number(data.latencyMs) || 0,
          iops: Number(data.iops) || 0,
          throughputMbps: Number(data.throughputMbps) || 0,
          capacityHistory,
          latencyHistory,
        };
      }),
    );
  }

  async getSwitches(): Promise<SwitchDoc[]> {
    const db = this.db();
    const snap = await db.collection('networkDevices').get();

    return Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() as RawSwitchData;

        const portsSnap = await doc.ref.collection('ports').get();
        const portsUp = portsSnap.docs.filter(
          (p) => (p.data() as RawPortData).status === 'Up',
        ).length;

        const histSnap = await doc.ref
          .collection('perfSnapshots')
          .orderBy('createdAt', 'asc')
          .get();
        const portUtilizationHistory: TimedSample[] = [];
        for (const h of histSnap.docs) {
          const hd = h.data() as RawSwitchSnapshot;
          const timestamp = toDate(hd.createdAt);
          if (!timestamp || hd.usedPct == null) continue;
          portUtilizationHistory.push({
            timestamp,
            value: Number(hd.usedPct),
          });
        }

        return {
          id: doc.id,
          name: data.name ?? doc.id,
          model: data.model ?? data.manufacturer ?? null,
          location: data.location ?? null,
          status: data.status ?? 'Offline',
          createdAt: toDate(data.createdAt),
          portCount: Number(data.portCount) || 0,
          portsUp,
          portUtilizationHistory,
        };
      }),
    );
  }
}
