import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { isSupported, getAnalytics } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Vite HMR can re-run this module — reuse the existing app instead of
// calling initializeApp twice, which throws.
export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig)

export const db = getFirestore(firebaseApp)

export const auth = getAuth(firebaseApp)

export const googleProvider = new GoogleAuthProvider()

// Analytics needs a real browser (cookies/IndexedDB) and can be blocked by
// ad/privacy extensions — isSupported() resolves false instead of throwing,
// so this stays a no-op there rather than crashing the app.
export const analyticsReady = isSupported().then((ok) =>
  ok ? getAnalytics(firebaseApp) : null
)
