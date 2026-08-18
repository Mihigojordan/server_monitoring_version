import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { authApi } from '../api/auth'
import { auth as firebaseAuth } from '../lib/firebase'

const SOCIAL_LABELS = {
  'google.com': 'Google account',
}

async function pingVsdc() {
  try {
    const res = await fetch('/health/vsdc')
    const data = await res.json().catch(() => ({}))
    return data.online === true
  } catch {
    return false
  }
}

const AppContext = createContext(null)

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || 'U'
}

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vsdc_token') || null)
  const [user, setUser] = useState(null)
  const [vsdcStatus, setVsdcStatus] = useState('checking')
  const pollRef = useRef(null)

  // Only block render while fetching user info — not needed for admin sessions or logged-out state
  const needsFetch = !!localStorage.getItem('vsdc_token') && localStorage.getItem('vsdc_is_admin') !== '1'
  const [backendAuthLoading, setBackendAuthLoading] = useState(needsFetch)

  // Firebase session (Google/Facebook/GitHub/Microsoft) — independent of the
  // backend token above. onAuthStateChanged fires once on load with the
  // restored session (or null), so authLoading waits for that too.
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [firebaseReady, setFirebaseReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (u) => {
      setFirebaseUser(u)
      setFirebaseReady(true)
    })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('vsdc_token')
    setToken(null)
    setUser(null)
    firebaseSignOut(firebaseAuth).catch(() => {})
  }, [])

  const refreshUser = useCallback(() => {
    return authApi.userInfo().then(data => setUser(data))
  }, [])

  // No single backend endpoint reports whether credentials are an operator
  // or an admin, so this tries the operator login first (the common case)
  // and falls back to the admin login on failure, surfacing the operator
  // attempt's error if both fail.
  const login = useCallback(async (email, password) => {
    try {
      const res = await authApi.loginUser(email, password)
      const t = res?.value ?? res?.token?.token ?? res?.token
      if (!t || typeof t !== 'string') throw new Error('No token received from server')
      localStorage.setItem('vsdc_token', t)
      localStorage.setItem('vsdc_is_admin', '0')
      setToken(t)
      return { token: t, isAdmin: false }
    } catch (userErr) {
      try {
        const res = await authApi.loginAdmin(email, password)
        const t = res?.value ?? res?.token?.token ?? res?.token
        if (!t || typeof t !== 'string') throw new Error('No token received from server', { cause: userErr })
        localStorage.setItem('vsdc_token', t)
        localStorage.setItem('vsdc_is_admin', '1')
        setToken(t)
        return { token: t, isAdmin: true }
      } catch {
        throw userErr
      }
    }
  }, [])

  // Social sign-in (Google). Firebase-authenticated
  // sessions have no backend TIN/branch/device — they're treated as a plain
  // signed-in operator (never admin, since admin requires the backend role).
  const loginWithProvider = useCallback(async (provider) => {
    const result = await signInWithPopup(firebaseAuth, provider)
    return result.user
  }, [])

  useEffect(() => {
    if (!token) return
    if (localStorage.getItem('vsdc_is_admin') === '1') return  // admin guard ≠ api guard
    authApi.userInfo()
      .then(data => setUser(data))
      .catch(() => logout())
      .finally(() => setBackendAuthLoading(false))
  }, [token, logout])

  // Poll VSDC WAR health every 30 seconds
  useEffect(() => {
    function check() {
      pingVsdc().then(online => setVsdcStatus(online ? 'online' : 'offline'))
    }
    check()
    pollRef.current = setInterval(check, 30_000)
    return () => clearInterval(pollRef.current)
  }, [])

  const isAdmin = token ? localStorage.getItem('vsdc_is_admin') === '1' : false
  const isAuthenticated = !!token || !!firebaseUser
  const authLoading = backendAuthLoading || !firebaseReady

  const profile = user ? {
    name:     user.fullName     || user.taxPayerName || 'Operator',
    role:     user.taxPayerName || 'Device Operator',
    initials: getInitials(user.fullName || user.taxPayerName),
    tin:      user.tin          || '—',
    branch:   user.branchName   || '—',
    device:   user.sdcId        || user.serialNo || '—',
    isTrainingMode: user.isTrainingMode || false,
  } : isAdmin ? {
    name: 'Administrator', role: 'Admin', initials: 'AD',
    tin: '—', branch: '—', device: '—', isTrainingMode: false,
  } : firebaseUser ? {
    name:     firebaseUser.displayName || firebaseUser.email || 'Signed-in user',
    role:     SOCIAL_LABELS[firebaseUser.providerData[0]?.providerId] || 'Signed in',
    initials: getInitials(firebaseUser.displayName || firebaseUser.email || 'U'),
    tin: '—', branch: '—', device: '—', isTrainingMode: false,
    photoURL: firebaseUser.photoURL || null,
  } : null

  return (
    <AppContext.Provider value={{
      token, isAdmin, isAuthenticated, user: profile, rawUser: user,
      firebaseUser, login, loginWithProvider, logout, refreshUser,
      authLoading, vsdcStatus, setVsdcStatus,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
