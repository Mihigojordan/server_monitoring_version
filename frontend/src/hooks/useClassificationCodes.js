/**
 * useClassificationCodes — fetches classification codes from GET /codes/item/classification/list
 * with optional name/code search. Returns { codes, loading, search, setSearch }.
 */
import { useState, useEffect, useCallback } from 'react'
import { operatorApi } from '../api/operator'

export function useClassificationCodes() {
  const [codes,   setCodes]   = useState([])
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const res = await operatorApi.searchClassificationCodes(q)
      const data = res?.data ?? res ?? []
      setCodes(Array.isArray(data) ? data : [])
    } catch {
      setCodes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(search)
  }, [search, load])

  return { codes, loading, search, setSearch }
}
