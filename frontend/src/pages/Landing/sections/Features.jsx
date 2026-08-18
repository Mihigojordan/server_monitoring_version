const FEATURES = [
  {
    colorClass: 'ic-blue',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    title: 'Realtime monitoring',
    desc: 'Live health, CPU, memory and disk metrics across every server, storage array and network device in the room — refreshed every 60 seconds.',
    bullets: [
      'Server, storage & network monitoring in one pane',
      'Configurable warning & critical thresholds',
      'Onboard devices via SNMP/API in minutes',
    ],
  },
  {
    colorClass: 'ic-green',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Predictive analytics',
    desc: 'ML-driven forecasts for CPU, memory, storage and power draw so capacity planning happens before a threshold gets crossed, not after.',
    bullets: [
      'Monthly, quarterly and yearly trend ranges',
      'Actual vs. predicted overlays per resource',
      'Early warning before limits are hit',
    ],
  },
  {
    colorClass: 'ic-amber',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Predictive maintenance',
    desc: 'Failure risk scoring and remaining-useful-life estimates on the components most likely to take down a rack — fans, PSUs, disk shelves.',
    bullets: [
      'Risk score + RUL per component',
      'Concrete recommendations, not just alerts',
      'Prioritized by business impact',
    ],
  },
  {
    colorClass: 'ic-violet',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Enterprise governance',
    desc: 'Role-based access, a full audit trail and configurable alert channels keep every change to critical infrastructure accountable.',
    bullets: [],
  },
  {
    colorClass: 'ic-cyan',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Alerts & incident response',
    desc: 'Critical, warning and info alerts routed to the right team the moment a threshold is crossed, with one-click acknowledgement.',
    bullets: [],
  },
  {
    colorClass: 'ic-rose',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h8M8 9h3"/>
      </svg>
    ),
    title: 'Reports & audit log',
    desc: 'Capacity, uptime, incident and predictive-maintenance reports — scheduled or exported on demand, with every admin action logged.',
    bullets: [],
  },
]

export default function Features() {
  return (
    <section className="sec" id="features">
      <div className="inner" id="product">
        <div className="sec__hd">
          <span className="eyebrow">Built for the server room</span>
          <h2>Every rack, every reading, neatly tucked behind a calm UI.</h2>
          <p>From device onboarding to predictive risk scoring, InfraMonitor covers servers, storage and network gear and turns each one into a workflow your NOC actually enjoys.</p>
        </div>

        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <div className={`ic ${f.colorClass}`}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              {f.bullets.length > 0 && (
                <ul>
                  {f.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
