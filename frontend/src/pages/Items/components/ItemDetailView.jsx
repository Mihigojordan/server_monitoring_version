import { useState, useEffect } from 'react'
import { operatorApi } from '../../../api/operator'

const TAX_LABEL  = { A: 'A Exempt', B: 'B 18%', C: 'C Zero', D: 'D Non-VAT' }
const TYPE_LABEL = { '1': 'Raw Material', '2': 'Finished Product', '3': 'Service (no stock)', '4': 'Composed / Bundle' }

const AVATAR_COLORS = [
  { bg: 'var(--brand-100)', color: 'var(--brand-700)' },
  { bg: '#dcfce7',          color: 'var(--ok)'         },
  { bg: '#fef3c7',          color: '#b45309'            },
  { bg: '#ede9fe',          color: '#6d28d9'            },
  { bg: '#cffafe',          color: '#0e7490'            },
  { bg: '#ffe4e6',          color: '#be123c'            },
]

function avatarColor(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export default function ItemDetailView({
  item, editItem, editPrice, editSaving, setEditPrice,
  onOpenEditPrice, onSavePrice, onCancelEdit,
  onToggleActive, onComposition, onDelete, typeLabel,
}) {
  const [compositions,    setCompositions]    = useState([])
  const [compLoading,     setCompLoading]     = useState(false)

  // Load compositions whenever this item is a bundle (type 4) or has any stored compositions
  useEffect(() => {
    if (!item?.code) return
    setCompLoading(true)
    operatorApi.getItemCompositions(item.code)
      .then(async data => {
        const list = Array.isArray(data) ? data : []
        if (list.length === 0) { setCompositions([]); return }
        // Enrich names
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
      .finally(() => setCompLoading(false))
  }, [item?.code])

  if (!item) return null

  const { bg, color } = avatarColor(item.code || '??')
  const initials  = (item.name || item.code || '??').slice(0, 2).toUpperCase()
  const isEditing = editItem?.id === item.id
  const isActive  = item.useYn === 'Y'
  const isBundle  = item.typeCode === '4'
  const totalCost = compositions.reduce((s, c) => s + Number(c.cost) * Number(c.quantity), 0)

  return (
    <div style={{ padding: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: 18, fontWeight: 600 }}>Item Details</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--sm btn--ghost" onClick={onToggleActive} title={isActive ? 'Deactivate item' : 'Activate item'}>
            {isActive ? '✓ Active' : '○ Inactive'}
          </button>
          <button className="btn btn--sm btn--ghost" onClick={onComposition} title="View/edit composition">
            ◆ Composition
          </button>
          <button
            className="btn btn--sm btn--ghost"
            onClick={onDelete}
            title={isActive ? 'Deactivate before deleting — item may have sales history' : 'Delete item (inactive items only)'}
            style={{ color: isActive ? 'var(--ink-400)' : 'var(--err)', cursor: isActive ? 'not-allowed' : 'pointer' }}
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {/* Deactivate hint for active items */}
      {isActive && (
        <div style={{ marginBottom: 16, padding: '9px 14px', borderRadius: 8, background: '#fef9c3', border: '1px solid #fde047', fontSize: 12.5, color: '#92400e' }}>
          <strong>RRA requirement:</strong> Items with sales history must be <em>deactivated</em> (not deleted) to preserve the audit trail.
          Use the <strong>Active/Inactive</strong> toggle to deactivate, then delete only if the item has never been sold.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* ── Left column ── */}
        <div>
          {/* Item card */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.name}
                  {isBundle && <span style={{ fontSize: 10, background: '#ede9fe', color: '#6d28d9', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>Bundle</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{item.code}</div>
                {item.barcode && <div style={{ fontSize: 10, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>BCD {item.barcode}</div>}
              </div>
            </div>
          </div>

          {/* Basic info */}
          <InfoCard title="Basic Information">
            <DetailRow label="Item Type"             value={TYPE_LABEL[item.typeCode] || typeLabel || item.typeCode} />
            <DetailRow label="Classification"        value={item.classificationCode || '—'} mono />
            <DetailRow label="Tax Type"              value={TAX_LABEL[item.taxTypeCode] || item.taxTypeCode} />
            <DetailRow label="Status"                value={isActive ? 'Active' : 'Inactive'} />
            <DetailRow label="Insurance Applicable"  value={item.insuranceApplicableYn === 'Y' ? 'Yes' : 'No'} />
            <DetailRow label="CIS Product ID"        value={item.cisProductId || '—'} mono />
            {item.batchNo && <DetailRow label="Batch No" value={item.batchNo} mono />}
          </InfoCard>
        </div>

        {/* ── Right column ── */}
        <div>
          {/* Pricing */}
          <InfoCard title="Pricing" style={{ marginBottom: 16 }}>
            {isEditing ? (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Unit Price (RWF)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--ink-200)', borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} placeholder="0" />
                  <button className="btn btn--sm" onClick={onSavePrice} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</button>
                  <button className="btn btn--sm btn--ghost" onClick={onCancelEdit} disabled={editSaving}>Cancel</button>
                </div>
              </div>
            ) : (
              <DetailRow label="Default Unit Price" value={`${Number(item.defaultUnitPrice || 0).toLocaleString()} RWF`} action={onOpenEditPrice} actionLabel="Edit" />
            )}
            {item.groupPriceOne   && <DetailRow label="Group Price L1" value={`${Number(item.groupPriceOne).toLocaleString()} RWF`} />}
            {item.groupPriceTwo   && <DetailRow label="Group Price L2" value={`${Number(item.groupPriceTwo).toLocaleString()} RWF`} />}
            {item.groupPriceThree && <DetailRow label="Group Price L3" value={`${Number(item.groupPriceThree).toLocaleString()} RWF`} />}
            {item.groupPriceFour  && <DetailRow label="Group Price L4" value={`${Number(item.groupPriceFour).toLocaleString()} RWF`} />}
            {item.groupPriceFive  && <DetailRow label="Group Price L5" value={`${Number(item.groupPriceFive).toLocaleString()} RWF`} />}
            {item.saftyQuantity   && <DetailRow label="Safety Quantity" value={Number(item.saftyQuantity).toLocaleString()} />}
          </InfoCard>

          {/* Specifications */}
          <InfoCard title="Specifications">
            <DetailRow label="Quantity Unit"  value={item.quantityUnitCode  || '—'} mono />
            <DetailRow label="Packaging Unit" value={item.packagingUnitCode || '—'} mono />
            <DetailRow label="Origin Country" value={item.originalNationCode || '—'} />
          </InfoCard>
        </div>
      </div>

      {/* ── Composition section — shown for bundles OR if compositions exist ── */}
      {(isBundle || compositions.length > 0) && (
        <div style={{ marginTop: 24 }}>
          <InfoCard
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>
                  Composition
                  {compositions.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--ink-400)' }}>
                      {compositions.length} component{compositions.length !== 1 ? 's' : ''}
                      {totalCost > 0 && ` · total cost ${totalCost.toLocaleString()} RWF`}
                    </span>
                  )}
                </span>
                <button className="btn btn--sm" onClick={onComposition} style={{ fontSize: 12 }}>
                  ◆ Edit composition
                </button>
              </div>
            }
          >
            {compLoading ? (
              <div style={{ padding: '12px 0', color: 'var(--ink-500)', fontSize: 13 }}>Loading components…</div>
            ) : compositions.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--ink-400)', fontSize: 13, textAlign: 'center' }}>
                No components defined yet.{' '}
                <button className="btn btn--sm btn--primary" onClick={onComposition} style={{ marginLeft: 8 }}>+ Add components</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px', gap: 10, padding: '0 2px' }}>
                  {['Component', 'Qty', 'Cost (RWF)'].map(h => (
                    <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</span>
                  ))}
                </div>
                {compositions.map(c => (
                  <div key={c.itemCode} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--ink-200)', background: 'var(--ink-50)', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{c.itemCode}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'center' }}>{c.quantity}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'right' }}>{Number(c.cost).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </InfoCard>
        </div>
      )}
    </div>
  )
}

function InfoCard({ title, children, style }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 8, overflow: 'hidden', ...style }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ink-100)', background: 'var(--ink-50)', fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>
        {title}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

function DetailRow({ label, value, action, actionLabel, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-600)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, fontFamily: mono ? 'var(--font-mono)' : 'inherit', color: 'var(--ink-900)', textAlign: 'right' }}>
          {value}
        </div>
        {action && (
          <button className="btn btn--xs btn--ghost" onClick={action} style={{ fontSize: 11, padding: '4px 8px' }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
