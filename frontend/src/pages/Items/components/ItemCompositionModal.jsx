import { useState, useEffect } from 'react'
import { operatorApi } from '../../../api/operator'
import { logActivity } from '../../../hooks/useActivityLog'
import ClassificationPicker from '../../../components/ui/ClassificationPicker'

const TYPE_OPTS = [
  { v: '1', l: 'Raw Material' },
  { v: '2', l: 'Finished Product' },
  { v: '3', l: 'Service (no stock)' },
]
const TAX_OPTS = [
  { v: 'A', l: 'A · Exempt (0%)' },
  { v: 'B', l: 'B · Standard 18%' },
  { v: 'C', l: 'C · Zero-rated' },
  { v: 'D', l: 'D · Non-VAT' },
]
const EMPTY_QUICK = { name: '', classificationCode: '', typeCode: '2', taxTypeCode: 'B', defaultUnitPrice: '', originalNationCode: 'RW', packagingUnitCode: 'CT', quantityUnitCode: 'U' }

export default function ItemCompositionModal({ item, onClose, onSaved }) {
  const [compositions,    setCompositions]    = useState([])
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState(null)

  const [searchInput,     setSearchInput]     = useState('')
  const [searchResults,   setSearchResults]   = useState([])
  const [searchLoading,   setSearchLoading]   = useState(false)
  const [searchOpen,      setSearchOpen]      = useState(false)
  const [showCreate,      setShowCreate]      = useState(false)
  const [quickForm,       setQuickForm]       = useState(EMPTY_QUICK)
  const [quickSaving,     setQuickSaving]     = useState(false)
  const [quickError,      setQuickError]      = useState(null)

  // Load existing compositions
  useEffect(() => {
    operatorApi.getItemCompositions(item.code)
      .then(async data => {
        const list = Array.isArray(data) ? data : []
        if (list.length === 0) { setCompositions([]); return }
        const enriched = await Promise.all(list.map(async c => {
          let name = c.componentItemCode
          try {
            const res = await operatorApi.searchItems(c.componentItemCode, 1, 5)
            const items = res?.items?.data ?? res?.data ?? []
            const found = items.find(i => i.code === c.componentItemCode)
            if (found) name = found.name
          } catch {}
          return { itemCode: c.componentItemCode, name, quantity: c.quantity, cost: c.cost }
        }))
        setCompositions(enriched)
      })
      .catch(() => setCompositions([]))
      .finally(() => setLoading(false))
  }, [item.code])

  async function handleSearch(q) {
    setSearchInput(q)
    setSearchOpen(true)
    setShowCreate(false)
    if (!q.trim() || q.length < 2) { setSearchResults([]); return }
    setSearchLoading(true)
    try {
      const res = await operatorApi.searchItems(q, 1, 10)
      const list = res?.items?.data ?? res?.data ?? []
      setSearchResults(list.filter(i => i.code !== item.code))
    } catch { setSearchResults([]) }
    finally { setSearchLoading(false) }
  }

  function addComponent(comp) {
    if (compositions.find(c => c.itemCode === comp.code)) return
    setCompositions(prev => [...prev, {
      itemCode: comp.code, name: comp.name,
      quantity: 1, cost: Number(comp.defaultUnitPrice) || 0,
    }])
    setSearchInput(''); setSearchResults([]); setSearchOpen(false); setShowCreate(false)
  }

  function setQ(k, v) { setQuickForm(f => ({ ...f, [k]: v })) }

  async function handleQuickCreate(e) {
    e.preventDefault()
    if (!quickForm.name.trim() || !quickForm.classificationCode || !quickForm.defaultUnitPrice) {
      setQuickError('Name, classification and price are required.')
      return
    }
    setQuickSaving(true); setQuickError(null)
    try {
      const res = await operatorApi.createItem({
        code: { countryCode: quickForm.originalNationCode, productType: quickForm.typeCode, packingUnit: quickForm.packagingUnitCode, quantityUnit: quickForm.quantityUnitCode },
        classificationCode: quickForm.classificationCode,
        typeCode: quickForm.typeCode,
        name: quickForm.name,
        originalNationCode: quickForm.originalNationCode,
        packagingUnitCode: quickForm.packagingUnitCode,
        quantityUnitCode: quickForm.quantityUnitCode,
        taxTypeCode: quickForm.taxTypeCode,
        defaultUnitPrice: Number(quickForm.defaultUnitPrice),
        insuranceApplicableYn: 'N',
        useYn: 'Y',
        cisProductId: quickForm.classificationCode,
      })
      logActivity({ action: 'CREATE_ITEM', category: 'System', summary: `Quick-created item "${quickForm.name}" for composition` })
      // Auto-add to composition
      const newItem = res?.item ?? res
      addComponent({
        code: newItem?.code || res?.code,
        name: quickForm.name,
        defaultUnitPrice: quickForm.defaultUnitPrice,
      })
      setQuickForm(EMPTY_QUICK); setShowCreate(false)
    } catch (err) {
      setQuickError(err.data?.errors?.[0]?.message || err.message || 'Could not create item. Check all fields.')
    } finally { setQuickSaving(false) }
  }

  function removeComponent(code) {
    setCompositions(prev => prev.filter(c => c.itemCode !== code))
  }

  function updateComp(code, field, value) {
    setCompositions(prev => prev.map(c => c.itemCode === code ? { ...c, [field]: value } : c))
  }

  async function handleSave() {
    if (compositions.length === 0) { setError('Add at least one component first.'); return }
    setSaving(true); setError(null)
    try {
      await operatorApi.saveItemComposition({
        itemCode: item.code,
        compositions: compositions.map(c => ({ itemCode: c.itemCode, quantity: Number(c.quantity), cost: Number(c.cost) }))
      })
      logActivity({ action: 'SAVE_COMPOSITION', category: 'System', summary: `Saved composition for "${item.name}" (${compositions.length} components)` })
      onSaved(); onClose()
    } catch (err) {
      setError(err.data?.resultMsg || err.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const totalCost = compositions.reduce((s, c) => s + Number(c.cost) * Number(c.quantity), 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 660, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--ink-200)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Item Composition</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>
              Define components/ingredients for <strong>{item.name}</strong>
            </p>
          </div>
          <button className="btn btn--sm" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 22 }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-500)' }}>Loading…</div>
          ) : (
            <>
              {error && <div className="settings-error" style={{ marginBottom: 14 }}>{error}</div>}

              {/* ── Search section ── */}
              <div style={{ marginBottom: 24 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                  Search &amp; Add Component
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    placeholder="Type item name or code to search…"
                    value={searchInput}
                    onChange={e => handleSearch(e.target.value)}
                    onFocus={() => (searchResults.length > 0 || showCreate) && setSearchOpen(true)}
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--ink-400)' }}>
                      Searching…
                    </span>
                  )}

                  {/* Search results dropdown */}
                  {searchOpen && !searchLoading && searchInput.length >= 2 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 10, zIndex: 20, boxShadow: '0 8px 30px rgba(0,0,0,.15)', maxHeight: 280, overflowY: 'auto' }}>
                      {searchResults.length > 0 ? (
                        searchResults.map((res, i) => (
                          <div key={res.id || res.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--ink-100)' : 'none' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                                {res.code} · {Number(res.defaultUnitPrice || 0).toLocaleString()} RWF
                              </div>
                            </div>
                            <button className="btn btn--sm btn--primary" style={{ flexShrink: 0 }} onClick={() => addComponent(res)} disabled={!!compositions.find(c => c.itemCode === res.code)}>
                              {compositions.find(c => c.itemCode === res.code) ? '✓ Added' : '+ Add'}
                            </button>
                          </div>
                        ))
                      ) : (
                        /* Not found — offer quick create */
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 10 }}>
                            No item found for <strong>"{searchInput}"</strong> in your catalog.
                          </div>
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => { setShowCreate(true); setSearchOpen(false); setQuickForm(f => ({ ...f, name: searchInput })) }}
                          >
                            + Create "{searchInput}" as new item
                          </button>
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-400)' }}>
                            The item will be registered in EBM and added to this composition.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-400)' }}>
                  Type at least 2 characters · click <strong>+ Add</strong> to add · not found? create it inline below
                </p>
              </div>

              {/* ── Quick create panel ── */}
              {showCreate && (
                <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: '2px solid var(--brand-300,#93c5fd)', background: 'var(--brand-50,#eff6ff)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--brand-700)' }}>
                      Create new item
                    </div>
                    <button className="btn btn--sm" onClick={() => { setShowCreate(false); setQuickError(null) }}>✕</button>
                  </div>

                  {quickError && <div className="settings-error" style={{ marginBottom: 12 }}>{quickError}</div>}

                  <form onSubmit={handleQuickCreate}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                      {/* Name — full width */}
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Item name <span style={{ color: 'var(--err)' }}>*</span></label>
                        <input className="form-input" required value={quickForm.name} onChange={e => setQ('name', e.target.value)} placeholder="e.g. Sugar 1kg" />
                      </div>

                      {/* Classification — full width */}
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Classification code <span style={{ color: 'var(--err)' }}>*</span></label>
                        <ClassificationPicker
                          value={quickForm.classificationCode}
                          onChange={v => setQ('classificationCode', v)}
                          onSelect={obj => {
                            setQ('classificationCode', obj.code || obj.itemClsCd)
                            if (obj.taxType || obj.taxTyCd) setQ('taxTypeCode', obj.taxType || obj.taxTyCd)
                          }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Item type <span style={{ color: 'var(--err)' }}>*</span></label>
                        <select className="form-input" value={quickForm.typeCode} onChange={e => setQ('typeCode', e.target.value)}>
                          {TYPE_OPTS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Tax type <span style={{ color: 'var(--err)' }}>*</span></label>
                        <select className="form-input" value={quickForm.taxTypeCode} onChange={e => setQ('taxTypeCode', e.target.value)}>
                          {TAX_OPTS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                        </select>
                      </div>

                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Unit price (RWF) <span style={{ color: 'var(--err)' }}>*</span></label>
                        <input className="form-input" type="number" required min="0" value={quickForm.defaultUnitPrice} onChange={e => setQ('defaultUnitPrice', e.target.value)} placeholder="e.g. 1200" />
                        <span className="form-hint">Used as default component cost in this composition</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button type="button" className="btn btn--sm" onClick={() => { setShowCreate(false); setQuickError(null) }}>Cancel</button>
                      <button type="submit" className="btn btn--sm btn--primary" disabled={quickSaving}>
                        {quickSaving ? 'Creating…' : 'Create & Add to composition'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Components list ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Components
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-400)', fontWeight: 400 }}>
                      {compositions.length} item{compositions.length !== 1 ? 's' : ''}
                    </span>
                  </label>
                  {compositions.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                      Total cost: <strong>{totalCost.toLocaleString()} RWF</strong>
                    </span>
                  )}
                </div>

                {compositions.length === 0 ? (
                  <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--ink-400)', border: '2px dashed var(--ink-200)', borderRadius: 10 }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>📦</div>
                    No components yet — search above to add items
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 36px', gap: 10, padding: '0 4px' }}>
                      {['Item', 'Qty', 'Cost (RWF)', ''].map((h, i) => (
                        <span key={i} style={{ fontSize: 11, color: 'var(--ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</span>
                      ))}
                    </div>
                    {compositions.map(comp => (
                      <div key={comp.itemCode} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 36px', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--ink-200)', background: 'var(--ink-50)' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{comp.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{comp.itemCode}</div>
                        </div>
                        <input type="number" className="form-input form-input--sm input--mono" value={comp.quantity} onChange={e => updateComp(comp.itemCode, 'quantity', e.target.value)} min="0.01" step="0.01" style={{ textAlign: 'center' }} />
                        <input type="number" className="form-input form-input--sm input--mono" value={comp.cost} onChange={e => updateComp(comp.itemCode, 'cost', e.target.value)} min="0" step="1" style={{ textAlign: 'right' }} />
                        <button className="btn btn--sm" style={{ padding: 0, width: 32, height: 32, display: 'grid', placeItems: 'center', color: 'var(--err)', borderColor: 'var(--err)', opacity: 0.7 }} onClick={() => removeComponent(comp.itemCode)} title="Remove">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--ink-200)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--surface)' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || loading || compositions.length === 0}>
            {saving ? 'Saving…' : `Save${compositions.length > 0 ? ` (${compositions.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
