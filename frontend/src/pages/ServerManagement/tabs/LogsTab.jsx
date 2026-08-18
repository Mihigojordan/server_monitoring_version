import { useState, useMemo } from 'react'
import { useSubcollection } from '../../../hooks/useSubcollection'
import { LOG_SEVERITIES, logSeverityMeta, LOG_SOURCES, fmtDateTime } from '../constants'

const EMPTY = { severity: 'Info', source: 'System', service: '', message: '' }

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function LogsTab({ serverId, server }) {
  const { rows, loading, error, setError, add } = useSubcollection('servers', serverId, 'logs', 'createdAt')
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('All')
  const [filterSource, setFilterSource] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(l => {
      if (filterSeverity !== 'All' && l.severity !== filterSeverity) return false
      if (filterSource !== 'All' && l.source !== filterSource) return false
      const t = l.createdAt?.toDate?.().getTime()
      if (dateFrom && (!t || t < new Date(`${dateFrom}T00:00:00`).getTime())) return false
      if (dateTo && (!t || t > new Date(`${dateTo}T23:59:59.999`).getTime())) return false
      if (q && !`${l.message} ${l.service}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, filterSeverity, filterSource, dateFrom, dateTo])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.message.trim()) return
    setSaving(true)
    setError(null)
    try {
      await add(form)
      setShowAdd(false)
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleDownload() {
    const text = filtered.map(l => `[${fmtDateTime(l.createdAt)}] ${l.severity} ${l.source}${l.service ? ` (${l.service})` : ''} — ${l.message}`).join('\n')
    downloadText(`${server?.name || 'server'}-logs.txt`, text || 'No log entries.')
  }

  return (
    <div>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          className="form-input" style={{ minWidth: 200, flex: 1, maxWidth: 280 }}
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search message, service…"
        />
        <select className="form-input" style={{ width: 'auto' }} value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="All">All severities</option>
          {LOG_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterSource} onChange={e => setFilterSource(e.target.value)}>
          <option value="All">All sources</option>
          {LOG_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="form-input" style={{ width: 'auto' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: 'var(--ink-400)' }}>–</span>
        <input type="date" className="form-input" style={{ width: 'auto' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <div style={{ flex: 1 }} />
        <button className="btn btn--sm" onClick={handleDownload} disabled={filtered.length === 0}>Download</button>
        <button className="btn btn--primary btn--sm" style={{ background: '#2563EB', borderColor: '#2563EB' }} onClick={() => setShowAdd(true)}>Add Log Entry</button>
      </div>

      {error && <div className="settings-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ padding: 14 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 12.5, background: '#0b1120', color: '#d1d5db',
          borderRadius: 8, padding: 16, maxHeight: 480, overflowY: 'auto',
        }}>
          {loading ? (
            <div style={{ color: '#9ca3af' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: '#9ca3af' }}>{rows.length === 0 ? 'No logs recorded for this server yet.' : 'No log entries match your filters.'}</div>
          ) : filtered.map(l => {
            const sev = logSeverityMeta(l.severity)
            return (
              <div key={l.id} style={{ marginBottom: 5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <span style={{ color: '#6b7280' }}>[{fmtDateTime(l.createdAt)}]</span>{' '}
                <span style={{ color: sev.text, fontWeight: 700 }}>{l.severity.toUpperCase()}</span>{' '}
                <span style={{ color: '#93c5fd' }}>{l.source}{l.service ? `/${l.service}` : ''}</span>{' — '}
                <span>{l.message}</span>
              </div>
            )
          })}
        </div>
      </div>

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal__head"><h3>Add Log Entry</h3>
              <button className="modal__close" onClick={() => setShowAdd(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                    {LOG_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Source</label>
                  <select className="form-input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                    {LOG_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Service (optional)</label>
                  <input className="form-input" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} placeholder="e.g. Nginx — matches the Services tab" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Message *</label>
                  <textarea className="form-input form-input--textarea" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                </div>
              </div>
              <div className="modal__body" style={{ paddingTop: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>{saving ? 'Saving…' : 'Add Entry'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
