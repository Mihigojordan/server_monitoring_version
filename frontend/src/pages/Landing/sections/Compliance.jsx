const CHECKLIST = [
  'Realtime monitoring, predictive analytics and predictive maintenance in one platform.',
  'Role-based access with a full, exportable audit trail for every change.',
  'Configurable alert channels — email, SMS or webhook — per severity.',
  '24/7 operations coverage with a 30-second average alert latency.',
]

const codeStyle = { fontFamily: 'var(--font-mono)', fontSize: '11.5px' }

const BADGES = [
  {
    colorClass: 'ic-blue',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    title: 'Reliability first',
    desc: 'Every feature is built assuming the network is down and the stakes are high.',
  },
  {
    colorClass: 'ic-green',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l5 5L21 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    title: 'Radical transparency',
    desc: null,
    descJsx: <p>Every action lands in the <code style={codeStyle}>audit log</code> — no black boxes for critical systems.</p>,
  },
  {
    colorClass: 'ic-amber',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" strokeLinecap="round"/></svg>,
    title: 'Real-time',
    desc: 'Metrics poll every 60 seconds; predictive models retrain nightly on the latest telemetry.',
  },
  {
    colorClass: 'ic-violet',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round"/></svg>,
    title: 'Built with operators',
    desc: 'Designed alongside the engineers who carry the pager, not just the executives who read the report.',
  },
]

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Compliance() {
  return (
    <section className="sec compliance" id="compliance">
      <div className="inner">
        <div>
          <span className="eyebrow">Reliability &amp; governance, by default</span>
          <h2>Built for teams who can&apos;t afford downtime.</h2>
          <p>InfraMonitor started inside a national datacenter operations team, built to replace spreadsheets and pager duty with real-time visibility and predictive maintenance.</p>
          <ul className="check-list">
            {CHECKLIST.map((item) => (
              <li key={item}>
                <span className="ck"><CheckIcon /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="badge-grid">
          {BADGES.map((badge) => (
            <div key={badge.title} className="badge">
              <div className="top">
                <div className={`ic ${badge.colorClass}`}>{badge.icon}</div>
                <h4>{badge.title}</h4>
              </div>
              {badge.descJsx ?? <p>{badge.desc}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
