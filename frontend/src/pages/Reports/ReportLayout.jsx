import { useState } from 'react'
import AppShell from '../../components/layout/AppShell'

export const today     = () => new Date().toISOString().split('T')[0]
export const monthStart = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

export async function downloadPdf(url, filename) {
  try {
    const token = localStorage.getItem('vsdc_token')
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    if (blob.size === 0) throw new Error('Empty response')
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
  } catch {
    window.open(url, '_blank')
  }
}

export function useReport(apiFn) {
  const [loading,      setLoading]      = useState(false)
  const [url,          setUrl]          = useState(null)
  const [error,        setError]        = useState(null)
  const [downloading,  setDownloading]  = useState(false)

  async function run(...args) {
    setLoading(true); setUrl(null); setError(null)
    try {
      const res = await apiFn(...args)
      setUrl(res?.url || null)
      if (!res?.url) setError('No PDF URL returned')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function download(filename) {
    if (!url) return
    setDownloading(true)
    await downloadPdf(url, filename)
    setDownloading(false)
  }

  return { loading, url, error, run, downloading, download, reset: () => { setUrl(null); setError(null) } }
}

export function ReportCard({ icon, title, desc, badge, filename, children, loading, url, error, download, downloading }) {
  return (
    <div className="card" style={{ 
      width: '100%', 
      border: 'none', 
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
      background: 'linear-gradient(to bottom, #ffffff, #fcfdfe)'
    }}>
      <div className="card__head" style={{ 
        padding: '24px 24px 16px',
        borderBottom: '1px solid var(--ink-100)',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, 
            background: 'linear-gradient(135deg, var(--brand-50), #fff)',
            border: '1px solid var(--brand-100)',
            color: 'var(--brand-700)', display: 'grid', placeItems: 'center', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(37,99,235,0.06)'
          }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--ink-900)', letterSpacing: '-0.02em' }}>{title}</h2>
              {badge && (
                <span className={`chip chip--${badge.variant} chip--plain`} style={{ 
                  fontSize: 10, 
                  padding: '1px 8px', 
                  borderRadius: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>{badge.label}</span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.5 }}>{desc}</p>
          </div>
        </div>
      </div>
      
      <div className="card__body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ 
          background: 'var(--ink-50)', 
          borderRadius: 12, 
          padding: 20, 
          border: '1px solid var(--ink-200)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <h4 style={{ margin: 0, fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Parameters</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {children}
          </div>
        </div>

        {error && (
          <div style={{ 
            padding: '12px 16px', background: '#fff1f2', border: '1px solid #fecaca', 
            borderRadius: 10, color: '#be123c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 
          }}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            {error}
          </div>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {url && (
            <button 
              className="btn btn--primary" 
              style={{ flex: 1, height: 42, borderRadius: 10, fontSize: 14 }} 
              onClick={() => download(filename)} 
              disabled={downloading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          )}
        </div>

        {loading && (
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            padding: 20, background: 'rgba(37,99,235,0.03)', borderRadius: 12, border: '1px dashed var(--brand-200)',
            gap: 12, fontSize: 13, color: 'var(--brand-600)', fontWeight: 500
          }}>
            <div className="spinner-sm" style={{ borderTopColor: 'var(--brand-600)' }} />
            Preparing document...
          </div>
        )}
      </div>
    </div>
  )
}

export function DateField({ label, value, onChange, max }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</label>
      <input 
        type="date" 
        className="form-input" 
        style={{ 
          borderRadius: 8, 
          background: '#fff', 
          border: '1px solid var(--ink-200)',
          height: 40,
          fontSize: 14
        }} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        max={max || today()} 
      />
    </div>
  )
}

export default function ReportLayout({ title, crumbs, children, url }) {
  return (
    <AppShell>
      <div className="page" style={{ 
        height: 'calc(100vh - 64px)', 
        display: 'flex', 
        flexDirection: 'column',
        padding: '24px 32px',
        background: 'var(--bg)'
      }}>
        <div className="page-head" style={{ marginBottom: 28 }}>
          <div>
            <div className="crumbs" style={{ marginBottom: 8, fontSize: 12, color: 'var(--ink-400)' }}>
              <span>Workspace</span>
              <span style={{ margin: '0 8px', opacity: 0.5 }}>/</span>
              <span>Reporting</span>
              <span style={{ margin: '0 8px', opacity: 0.5 }}>/</span>
              <span style={{ color: 'var(--ink-800)', fontWeight: 600 }}>{crumbs || title}</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink-900)', letterSpacing: '-0.03em' }}>{title}</h1>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: url ? '400px 1fr' : '1fr', 
          gap: 32, 
          flex: 1,
          minHeight: 0,
          alignItems: 'start'
        }}>
          <div style={{ 
            overflowY: 'auto', 
            paddingRight: 4,
            maxHeight: '100%'
          }}>
            {children}
          </div>

          {url ? (
            <div className="card" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden', 
              height: '100%',
              border: 'none',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 16,
              background: '#fff'
            }}>
              <div className="card__head" style={{ 
                padding: '16px 20px', 
                background: 'var(--ink-50)',
                borderBottom: '1px solid var(--ink-200)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)' }} />
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-800)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Document Preview
                  </h3>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-400)', fontWeight: 600 }}>
                  LIVE VIEW
                </div>
              </div>
              <div style={{ flex: 1, background: '#525659', position: 'relative' }}>
                <iframe 
                  src={`${url}#toolbar=0&navpanes=0`} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    border: 'none',
                  }}
                  title="PDF Preview"
                />
              </div>
            </div>
          ) : (
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.5)',
              borderRadius: 16,
              border: '2px dashed var(--ink-200)',
              color: 'var(--ink-400)',
              gap: 16
            }}>
              <div style={{ 
                width: 64, height: 64, borderRadius: '50%', 
                background: 'var(--ink-100)', display: 'grid', placeItems: 'center' 
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-500)' }}>No Report Generated</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Select parameters and click generate to view preview</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
