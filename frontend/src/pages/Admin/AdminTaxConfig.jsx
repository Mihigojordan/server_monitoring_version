import { useState, useEffect } from 'react'
import AdminShell from '../../components/layout/AdminShell'
import { adminApi } from '../../api/admin'
import { logActivity } from '../../hooks/useActivityLog'

const TAX_DESCS = {
  A: 'Exempt — medicines, basic food, financial services',
  B: 'Standard VAT 18% — most goods and services',
  C: 'Zero-rated — exports, some agricultural inputs',
  D: 'Non-VAT taxpayers',
}

export default function AdminTaxConfig() {
  const [taxes,   setTaxes]   = useState([])
  const [edits,   setEdits]   = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState({})
  const [saved,   setSaved]   = useState({})
  const [error,   setError]   = useState(null)

  useEffect(() => {
    adminApi.listTax()
      .then(data => {
        const list = Array.isArray(data) ? data : data?.data ?? []
        setTaxes(list)
        const init = {}
        list.forEach(t => { init[t.id] = { rate: t.rate ?? 0, isActive: t.isActive ?? true } })
        setEdits(init)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function save(tax) {
    setSaving(s => ({ ...s, [tax.id]: true }))
    setError(null)
    try {
      const edit = edits[tax.id]
      await adminApi.updateTax(tax.id, { rate: Number(edit.rate), isActive: edit.isActive })
      logActivity({ action: 'UPDATE_TAX', category: 'Tax', summary: `Updated tax type ${tax.taxType}: rate=${edit.rate}%, active=${edit.isActive}` })
      setSaved(s => ({ ...s, [tax.id]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [tax.id]: false })), 2500)
    } catch (err) {
      setError(err.message)
      logActivity({ action: 'UPDATE_TAX', category: 'Tax', summary: `Failed to update tax type ${tax.taxType}`, status: 'error', detail: err.message })
    } finally {
      setSaving(s => ({ ...s, [tax.id]: false }))
    }
  }

  return (
    <AdminShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Admin</span><span>›</span><span>Tax Configuration</span></div>
            <h1>Tax Configuration</h1>
          </div>
        </div>

        <div style={{ maxWidth: 780 }}>
          <div className="card">
            <div className="card__head">
              <div>
                <h3 style={{ margin: 0 }}>VAT Rate Table</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>RRA EBM 2.1 — Article 4</p>
              </div>
            </div>
            <div className="card__body">
              {error && <div className="settings-error" style={{ marginBottom: 12 }}>{error}</div>}
              {loading ? (
                <div style={{ color: 'var(--ink-500)', padding: '12px 0' }}>Loading…</div>
              ) : (
                <table className="data" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Code</th>
                      <th>Description</th>
                      <th className="num" style={{ width: 130 }}>Rate (%)</th>
                      <th style={{ width: 80, textAlign: 'center' }}>Active</th>
                      <th style={{ width: 110 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {taxes.map(tax => {
                      const key  = tax.taxType
                      const edit = edits[tax.id] ?? { rate: tax.rate ?? 0, isActive: tax.isActive ?? true }
                      return (
                        <tr key={tax.id}>
                          <td>
                            <span className={`tax-chip tax-${key}`}>{key}</span>
                          </td>
                          <td style={{ color: 'var(--ink-600)', fontSize: 13 }}>{TAX_DESCS[key] ?? '—'}</td>
                          <td className="num">
                            <input
                              type="number" min={0} max={100} step={0.01}
                              className="input input--mono"
                              style={{ width: 90, textAlign: 'right' }}
                              value={edit.rate}
                              onChange={e => setEdits(prev => ({ ...prev, [tax.id]: { ...prev[tax.id], rate: e.target.value } }))}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={edit.isActive}
                              style={{ accentColor: 'var(--brand-600)', width: 15, height: 15, cursor: 'pointer' }}
                              onChange={e => setEdits(prev => ({ ...prev, [tax.id]: { ...prev[tax.id], isActive: e.target.checked } }))}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                              {saved[tax.id] && <span className="chip chip--ok">✓ Saved</span>}
                              <button
                                className="btn btn--sm btn--primary"
                                onClick={() => save(tax)}
                                disabled={saving[tax.id]}
                              >
                                {saving[tax.id] ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
