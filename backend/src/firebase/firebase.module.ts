import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

export const FIRESTORE = 'FIRESTORE';

const logger = new Logger('FirebaseModule');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FIRESTORE,
      inject: [ConfigService],
      // Returns null instead of throwing when credentials are missing/invalid,
      // so a misconfigured backend/.env can't take down the whole app at boot
      // — only the Firestore-backed endpoints fail, with a clear 503.
      useFactory: (config: ConfigService): Firestore | null => {
        try {
          const app =
            getApps()[0] ??
            initializeApp({
              credential: cert({
                projectId: config.get<string>('FIREBASE_PROJECT_ID'),
                clientEmail: config.get<string>('FIREBASE_CLIENT_EMAIL'),
                privateKey: config
                  .get<string>('FIREBASE_PRIVATE_KEY')
                  ?.replace(/\\n/g, '\n'),
              }),
            });
          return getFirestore(app);
        } catch (err) {
          logger.warn(
            `Firebase not configured (${(err as Error).message}) — Firestore-backed endpoints will return 503 until backend/.env has a real FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.`,
          );
          return null;
        }
      },
    },
  ],
  exports: [FIRESTORE],
})
export class FirebaseModule {}
