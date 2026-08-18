const LOCAL_ID_KEY = 'infra_local_admin_id'

/**
 * Stable identity used as the Firestore document id for the logged-in
 * admin's profile/settings. Prefers the real Firebase uid (Google
 * sign-in); backend-token admin sessions have no such id, so this falls
 * back to a UUID-ish string generated once and persisted in localStorage.
 */
export function getAdminId(firebaseUser) {
  if (firebaseUser?.uid) return firebaseUser.uid
  let id = localStorage.getItem(LOCAL_ID_KEY)
  if (!id) {
    id = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(LOCAL_ID_KEY, id)
  }
  return id
}

/**
 * Same idea for a device operator session: prefer the real backend
 * taxpayer TIN (stable, unique per account) over the generic local
 * fallback, since operators — unlike admins — have a real `rawUser`.
 */
export function getUserId(firebaseUser, rawUser) {
  if (firebaseUser?.uid) return firebaseUser.uid
  if (rawUser?.tin) return `tin-${rawUser.tin}`
  return getAdminId(firebaseUser)
}
