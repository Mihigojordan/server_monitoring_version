import { Link } from 'react-router-dom'
import Navbar from '../../components/layout/Navbar'
import Footer from '../../components/layout/Footer'

const STATS = [
  { value: '2023', label: 'Founded' },
  { value: '40+', label: 'Institutions served' },
  { value: '12k+', label: 'Devices monitored' },
  { value: '99.95%', label: 'Platform uptime' },
]

const VALUES = [
  {
    colorClass: 'ic-green',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Reliability first',
    desc: 'Every feature is built assuming the network is down and the stakes are high.',
  },
  {
    colorClass: 'ic-green',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" strokeLinecap="round" />
      </svg>
    ),
    title: 'Radical transparency',
    desc: 'Every action is logged and auditable — no black boxes for critical systems.',
  },
  {
    colorClass: 'ic-green',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20s-7-4.4-9.5-9C1 8 2.5 4.5 6 4c2-.3 4 .8 6 3 2-2.2 4-3.3 6-3 3.5.5 5 4 3.5 7-2.5 4.6-9.5 9-9.5 9z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Built with operators',
    desc: 'Designed alongside the engineers who carry the pager, not just executives.',
  },
]

export default function About() {
  return (
    <>
      <Navbar />
      <main>
        <div className="marketing-page-head">
          <div className="marketing-page-head__inner">
            <span className="eyebrow" style={{ marginBottom: 14 }}>About InfraMonitor</span>
            <h1>Built for teams who can&apos;t afford downtime.</h1>
            <p>
              InfraMonitor started inside a national datacenter operations team, built to replace
              spreadsheets and pager duty with real-time visibility and predictive maintenance
              across servers, storage and network equipment.
            </p>
          </div>
        </div>

        <section className="sec">
          <div className="inner">
            <div className="stat-grid">
              {STATS.map((s) => (
                <div key={s.label} className="stat-card">
                  <div className="v">{s.value}</div>
                  <div className="l">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="inner">
            <div className="sec__hd">
              <span className="eyebrow">What we stand for</span>
              <h2>Our values</h2>
              <p>The same three things every InfraMonitor feature is built to protect.</p>
            </div>
            <div className="badge-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {VALUES.map((v) => (
                <div key={v.title} className="badge">
                  <div className="top">
                    <div className={`ic ${v.colorClass}`}>{v.icon}</div>
                    <h4>{v.title}</h4>
                  </div>
                  <p>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="cta-strip">
          <div>
            <h2>Ready to see it on your infrastructure?</h2>
            <p>Reach the platform team for a walkthrough tailored to your datacenter — or jump straight into the dashboard.</p>
          </div>
          <div className="btns">
            <Link className="btn btn--white btn--lg" to="/contact">Contact us</Link>
            <Link className="btn btn--outline-w btn--lg" to="/dashboard">Open dashboard</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
