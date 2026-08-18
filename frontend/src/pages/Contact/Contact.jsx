import { useState } from 'react'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'

const CHANNELS = [
  {
    colorClass: 'ic-blue',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16v16H4z" strokeLinecap="round" strokeLinejoin="round" /><path d="m4 6 8 7 8-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Sales & demos',
    desc: 'sales@inframonitor.rw · Walkthroughs tailored to your datacenter.',
  },
  {
    colorClass: 'ic-green',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
      </svg>
    ),
    title: 'Support',
    desc: 'support@inframonitor.rw · Tickets answered within 4 hours.',
  },
  {
    colorClass: 'ic-amber',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" />
      </svg>
    ),
    title: 'Operations coverage',
    desc: '24/7 on-call for critical alerts on monitored infrastructure.',
  },
]

const FAQS = [
  { q: 'How often does data refresh?', a: 'Dashboard metrics poll every 60 seconds; predictive models retrain nightly.' },
  { q: 'Who can approve configuration changes?', a: 'Only users with the Administrator role can approve configuration changes.' },
  { q: 'How do I add a new device for monitoring?', a: 'Go to Server Monitoring → Add Server and fill in the device details.' },
  { q: 'Where can I see who changed a setting?', a: 'The Audit Log records every admin action with user, time and IP address.' },
]

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', org: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <>
      <Navbar />
      <main>
        <div className="marketing-page-head">
          <div className="marketing-page-head__inner">
            <span className="eyebrow" style={{ marginBottom: 14 }}>Get in touch</span>
            <h1>Talk to the platform team.</h1>
            <p>
              Tell us about your server room and we&apos;ll walk you through onboarding, alert
              routing and your first predictive maintenance report.
            </p>
          </div>
        </div>

        <section className="sec">
          <div className="inner contact-grid">
            <div className="contact-form">
              {submitted ? (
                <div className="contact-success">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Thanks — the platform team will reach out shortly.
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="name">Full name</label>
                  <input
                    id="name"
                    className="form-input"
                    value={form.name}
                    onChange={update('name')}
                    placeholder="Jane Mukamana"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="email">Work email</label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={update('email')}
                    placeholder="jane@yourinstitution.rw"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="org">Organization</label>
                  <input
                    id="org"
                    className="form-input"
                    value={form.org}
                    onChange={update('org')}
                    placeholder="Institution or company name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="message">What are you looking to monitor?</label>
                  <textarea
                    id="message"
                    className="form-input form-input--textarea"
                    value={form.message}
                    onChange={update('message')}
                    placeholder="Servers, storage, network gear, rack count…"
                  />
                </div>

                <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
                  Request a demo
                </button>
              </form>
            </div>

            <div className="contact-info">
              <h3>Reach us directly</h3>
              <p>Prefer email or a call? Every channel below is monitored during business hours, with 24/7 coverage for critical alerts.</p>

              {CHANNELS.map((c) => (
                <div key={c.title} className="contact-channel">
                  <div className={`ic ${c.colorClass}`}>{c.icon}</div>
                  <div>
                    <div className="t">{c.title}</div>
                    <div className="d">{c.desc}</div>
                  </div>
                </div>
              ))}

              <div className="faq-list">
                {FAQS.map((f) => (
                  <div key={f.q} className="faq-item">
                    <h4>{f.q}</h4>
                    <p>{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
