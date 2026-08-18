import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

function localKey(collectionName, docId) {
  return `infra_${collectionName}_${docId}`
}

function readLocal(collectionName, docId, fallback) {
  try {
    const raw = localStorage.getItem(localKey(collectionName, docId))
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function writeLocal(collectionName, docId, value) {
  try {
    localStorage.setItem(localKey(collectionName, docId), JSON.stringify(value))
  } catch {
    // localStorage can throw (quota, private mode) — Firestore write is the source of truth
  }
}

/**
 * Firestore-backed document state with a localStorage mirror.
 *
 * `value` starts from localStorage (instant, synchronous) and is
 * reconciled with Firestore once the initial fetch resolves. `save()`
 * writes to both, so a Firestore outage/misconfigured rules degrades to
 * "changes stick locally" instead of silently losing the edit.
 *
 * `fallback` is only read on the very first render (frozen via useState's
 * lazy initializer) — callers pass a fresh object literal each render, and
 * this hook never needs to react to it changing.
 */
export function useFirestoreDoc(collectionName, docId, fallback) {
  const [initialFallback] = useState(() => fallback)
  const [value, setValue] = useState(() => readLocal(collectionName, docId, initialFallback))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, collectionName, docId))
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) {
          const merged = { ...initialFallback, ...snap.data() }
          setValue(merged)
          writeLocal(collectionName, docId, merged)
        }
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        // Firestore unreachable/rules deny read — keep the localStorage value, just flag it.
        setError(err)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [collectionName, docId, initialFallback])

  const save = useCallback(async (nextValue) => {
    setValue(nextValue)
    writeLocal(collectionName, docId, nextValue)
    try {
      await setDoc(doc(db, collectionName, docId), nextValue, { merge: true })
      setError(null)
      return true
    } catch (err) {
      setError(err)
      return false
    }
  }, [collectionName, docId])

  return { value, setValue, loading, error, save }
}
