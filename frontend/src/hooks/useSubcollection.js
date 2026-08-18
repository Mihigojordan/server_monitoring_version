import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * Live CRUD binding for a Firestore subcollection nested under a parent
 * document, e.g. servers/{parentId}/issues or storageDevices/{parentId}/volumes.
 */
export function useSubcollection(parentCollection, parentId, name, orderField = 'createdAt') {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!parentId) return
    const q = query(collection(db, parentCollection, parentId, name), orderBy(orderField, 'desc'))
    const unsub = onSnapshot(
      q,
      snap => { setRows(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err => { setError(err.message); setLoading(false) }
    )
    return unsub
  }, [parentCollection, parentId, name, orderField])

  async function add(payload) {
    await addDoc(collection(db, parentCollection, parentId, name), { ...payload, createdAt: serverTimestamp() })
  }
  async function update(id, payload) {
    await updateDoc(doc(db, parentCollection, parentId, name, id), payload)
  }
  async function remove(id) {
    await deleteDoc(doc(db, parentCollection, parentId, name, id))
  }

  return { rows, loading, error, setError, add, update, remove }
}
