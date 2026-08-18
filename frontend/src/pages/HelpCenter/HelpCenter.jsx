import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../lib/firebase'
import { useApp } from '../../context/AppContext'
import { logActivity } from '../../hooks/useActivityLog'

const FAQS = [
  { q: 'How often does data refresh?', a: 'Dashboard metrics poll every 60 seconds; predictive models retrain nightly.' },
  { q: 'Who can approve configuration changes?', a: 'Only users with the Administrator role can approve configuration changes.' },
  { q: 'How do I add a new resource for monitoring?', a: 'Go to Resources Management → Add Resource and fill in the device details.' },
  { q: 'Where can I see who changed a setting?', a: 'Log Audit records every action across the app with who, what and when.' },
  { q: 'Can I import data in bulk?', a: 'Yes — Resources, Alerts, and User Management all support CSV and JSON import from their Import button.' },
]

const CATEGORIES = ['Technical', 'Billing', 'Access Request', 'Bug Report', 'Feature Request', 'Other']

const EMPTY_FORM = { subject: '', message: '', category: 'Technical' }

export default function HelpCenter() {
  const { user } = useApp()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addDoc(collection(db, 'supportTickets'), {
        subject: form.subject.trim(),
        message: form.message.trim(),
        category: form.category,
        priority: 'Medium',
        assignee: '',
        createdBy: user?.name || 'Operator',
        createdAt: serverTimestamp(),
        status: 'Open',
        resolvedAt: null,
      })
      logActivity({ action: 'SUBMIT_SUPPORT_TICKET', category: 'System', summary: `Submitted support ticket: ${form.subject.trim()}` })
      setForm(EMPTY_FORM)
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="page-head" style={{ background: 'var(--surface)', border: '1px solid var(--ink-200)', borderRadius: 14, padding: '18px 20px', margin: 4, marginBottom: 10, marginLeft: 5 }}>
          <div>
            <div className="crumbs"><span>Home</span><span>›</span><span>Help Center</span></div>
            <h1>Help Center</h1>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, marginLeft: 5 }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Frequently asked questions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {FAQS.map(fq => (
                <div key={fq.q}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>{fq.q}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.6 }}>{fq.a}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Contact support</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input
                  className="form-input"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Subject"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea
                  className="form-input form-input--textarea"
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe the issue…"
                />
              </div>
              {error && <div className="settings-error" style={{ marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="submit" className="btn btn--primary" style={{ background: '#2563EB', borderColor: '#2563EB' }} disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit ticket'}
                </button>
                {sent && <span style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>Ticket submitted</span>}
              </div>
            </form>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ink-200)', fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.8 }}>
              Platform team: <span style={{ color: 'var(--ink-900)', fontWeight: 700 }}>support@inframonitor.io</span><br />
              On-call hotline: <span style={{ color: 'var(--ink-900)', fontWeight: 700 }}>+1 (555) 010-0000</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
