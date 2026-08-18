import { useState, useEffect, useRef } from 'react'
import { operatorApi } from '../../api/operator'

export default function ClassificationPicker({ value, onChange, onSelect, required, disabled, id = 'classCode' }) {
  const [query,    setQuery]    = useState(value || '')
  const [display,  setDisplay]  = useState(value || '')
  const [selected, setSelected] = useState(null)        // { code, name } after selection
  const [results,  setResults]  = useState([])
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const timer   = useRef(null)
  const wrapRef = useRef(null)

  // `value` only fed the initial useState above — once mounted, an external
  // update (e.g. auto-filled from picking a product elsewhere on the page)
  // never reached the visible input. Re-sync display whenever the parent's
  // value changes, without touching `query` (that only drives the debounced
  // search from the user's own typing — syncing it here would flash the
  // search dropdown open right after an auto-fill).
  useEffect(() => {
    setDisplay(value || '')
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search — runs on query (not display)
  useEffect(() => {
    clearTimeout(timer.current)
    if (!query || query.length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await operatorApi.searchClassificationCodes(query)
        const data = res?.data ?? res ?? []
        setResults(Array.isArray(data) ? data.slice(0, 20) : [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [query])

  function select(obj) {
    const code = obj.code || obj.itemClsCd || ''
    const name = obj.name || obj.itemClsNm || ''
    setQuery(code)
    setDisplay(code)
    setSelected({ code, name })
    onChange(code)
    if (onSelect) onSelect(obj)
    setOpen(false)
    setResults([])
  }

  function handleChange(e) {
    const val = e.target.value
    setDisplay(val)
    setQuery(val)
    setSelected(null)
    onChange(val)
    setOpen(true)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        id={id}
        className="form-input"
        required={required}
        disabled={disabled}
        placeholder="Type code or name (e.g. 5020110100 or Mineral Water)"
        value={display}
        autoComplete="off"
        onChange={handleChange}
        onFocus={() => !disabled && query.length >= 2 && setOpen(true)}
        style={disabled ? { background: 'var(--ink-50)', color: 'var(--ink-600)' } : undefined}
      />
      {selected?.name && (
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4, paddingLeft: 2 }}>
          {selected.name}
        </div>
      )}
      {open && query.length >= 2 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.10)', maxHeight: 240, overflowY: 'auto',
        }}>
          {loading && (
            <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ink-500)' }}>Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ink-500)' }}>No results — type the code directly</div>
          )}
          {results.map((c, i) => (
            <button
              key={c.code || c.itemClsCd || i}
              type="button"
              onClick={() => select(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 14px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                borderTop: i > 0 ? '1px solid var(--ink-100)' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand-700)', minWidth: 100 }}>
                {c.code || c.itemClsCd}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-800)' }}>
                {c.name || c.itemClsNm}
              </span>
              {(c.taxType || c.taxTyCd) && (
                <span className={`tax-chip tax-${c.taxType || c.taxTyCd}`} style={{ marginLeft: 'auto' }}>
                  {c.taxType || c.taxTyCd}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
