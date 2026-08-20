import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.module';

// Hardware refresh horizon used to scale the age component of the risk
// score — there's no logged maintenance-event history to derive this from,
// so age fully saturates the score at this many years. Documented here
// rather than hidden inside the math so it's easy to tune later.
const MAX_AGE_YEARS = 8;

type WarrantyState = 'active' | 'expiring' | 'expired' | 'unknown';

const WARRANTY_RISK: Record<WarrantyState, number> = {
  expired: 100,
  expiring: 60,
  unknown: 40,
  active: 10,
};

function ageYears(purchaseDate?: string): number | null {
  if (!purchaseDate) return null;
  const ms = Date.now() - new Date(`${purchaseDate}T00:00:00`).getTime();
  return ms > 0 ? ms / (365.25 * 86400000) : null;
}

function warrantyState(warrantyExpiry?: string): WarrantyState {
  if (!warrantyExpiry) return 'unknown';
  const days = Math.round(
    (new Date(`${warrantyExpiry}T00:00:00`).getTime() - Date.now()) / 86400000,
  );
  if (days < 0) return 'expired';
  if (days <= 90) return 'expiring';
  return 'active';
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.round(
    (new Date(`${dateStr}T00:00:00`).getTime() - Date.now()) / 86400000,
  );
}

interface RawEquipmentData {
  name?: string;
  category?: string;
  status?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  cost?: number;
}

export interface EquipmentRisk {
  id: string;
  name: string;
  category: string | null;
  status: string | null;
  ageYears: number | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  warrantyState: WarrantyState;
  daysUntilWarrantyExpiry: number | null;
  cost: number | null;
  riskScore: number;
  healthScore: number;
  riskBand: 'critical' | 'warning' | 'healthy';
}

export interface EquipmentRiskReport {
  generatedAt: string;
  fleet: {
    activeCount: number;
    avgRiskScore: number | null;
    avgHealthScore: number | null;
    criticalCount: number;
    warningCount: number;
    healthyCount: number;
  };
  items: EquipmentRisk[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
  ) {}

  async getEquipmentRisk(): Promise<EquipmentRiskReport> {
    if (!this.firestore) {
      throw new ServiceUnavailableException(
        'Firebase is not configured — add a real FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY to backend/.env.',
      );
    }
    const snap = await this.firestore.collection('equipment').get();
    const items: EquipmentRisk[] = [];

    for (const doc of snap.docs) {
      const data = doc.data() as RawEquipmentData;
      if (data.status === 'Retired') continue;

      const age = ageYears(data.purchaseDate);
      const warranty = warrantyState(data.warrantyExpiry);

      const ageComponent =
        age == null ? 40 : Math.min(100, (age / MAX_AGE_YEARS) * 100);
      const warrantyComponent = WARRANTY_RISK[warranty];
      const riskScore = Math.round(
        ageComponent * 0.6 + warrantyComponent * 0.4,
      );
      const healthScore = 100 - riskScore;
      const riskBand =
        riskScore >= 70 ? 'critical' : riskScore >= 40 ? 'warning' : 'healthy';

      items.push({
        id: doc.id,
        name: data.name ?? 'Unnamed',
        category: data.category ?? null,
        status: data.status ?? null,
        ageYears: age == null ? null : Math.round(age * 10) / 10,
        purchaseDate: data.purchaseDate ?? null,
        warrantyExpiry: data.warrantyExpiry ?? null,
        warrantyState: warranty,
        daysUntilWarrantyExpiry: daysUntil(data.warrantyExpiry),
        cost: data.cost != null ? Number(data.cost) : null,
        riskScore,
        healthScore,
        riskBand,
      });
    }

    items.sort((a, b) => b.riskScore - a.riskScore);

    const activeCount = items.length;
    const avgRiskScore = activeCount
      ? Math.round(items.reduce((s, i) => s + i.riskScore, 0) / activeCount)
      : null;

    return {
      generatedAt: new Date().toISOString(),
      fleet: {
        activeCount,
        avgRiskScore,
        avgHealthScore: avgRiskScore == null ? null : 100 - avgRiskScore,
        criticalCount: items.filter((i) => i.riskBand === 'critical').length,
        warningCount: items.filter((i) => i.riskBand === 'warning').length,
        healthyCount: items.filter((i) => i.riskBand === 'healthy').length,
      },
      items,
    };
  }
}
