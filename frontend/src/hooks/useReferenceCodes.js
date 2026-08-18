/**
 * useReferenceCodes — fetches RRA's general code tables (GET /codes/:branchId)
 * once per branch and exposes them grouped by category. `codesFor` looks up a
 * category by matching its RRA-provided name (which varies/typos between
 * deployments, e.g. "Cuntry") against a pattern, so callers don't need to
 * know RRA's exact category id or spelling.
 */
import { useState, useEffect, useCallback } from 'react'
import { operatorApi } from '../api/operator'

export function useReferenceCodes(branchId) {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [loaded,     setLoaded]     = useState(false)

  useEffect(() => {
    if (!branchId) return
    let cancelled = false
    setLoading(true)
    operatorApi.branchCodes(branchId)
      .then(res => {
        if (cancelled) return
        if (res?.resultCd === '000') setCategories(res?.data?.clsList ?? [])
        else if (res?.resultCd !== '001') setError(res?.resultMsg || 'Failed to load reference codes')
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) { setLoading(false); setLoaded(true) } })
    return () => { cancelled = true }
  }, [branchId])

  // Returns [{ v, l }] for the category whose cdClsNm matches `pattern`,
  // or `fallback` if no live category was found (not loaded yet, RRA down, etc.)
  const codesFor = useCallback((pattern, fallback = []) => {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i')
    const cat = categories.find(c => re.test(c.cdClsNm || ''))
    const list = cat?.dtlList
    if (!list || list.length === 0) return fallback
    return list.map(d => ({ v: d.cd, l: `${d.cd} · ${d.cdNm || ''}`.trim() }))
  }, [categories])

  return { categories, loading, error, loaded, codesFor }
}
