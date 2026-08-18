import { Link } from 'react-router-dom'

const DEVICES = [
  { name: 'Storage-01', type: 'Storage · R1-U04', pct: 32, color: 'var(--brand-700)', status: 'ok' },
  { name: 'ESXi-Host-01', type: 'ESXi Host · R2-U10', pct: 41, color: 'var(--brand-700)', status: 'ok' },
  { name: 'ESXi-Host-03', type: 'ESXi Host · R2-U12', pct: 62, color: '#b45309', status: 'warn' },
  { name: 'Blade-Switch-03', type: 'Blade Switch · R3-U04', pct: 55, color: '#b45309', status: 'warn' },
]

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__inner">
        {/* Left column */}
        <div>
          <span className="eyebrow">
            <span className="pill">LIVE</span>
            Datacenter resource management &amp; predictive analytics
          </span>
          <h1>
            Server room &amp; infrastructure monitoring, <em>powered by predictive intelligence</em>.
          </h1>
          <p className="lead">
            InfraMonitor gives IT operations teams real-time visibility, ML-driven forecasting and
            predictive maintenance across every server, storage array and network device on the
            floor — built for mission-critical rooms that can&apos;t afford downtime.
          </p>
          <div className="hero__cta">
            <Link className="btn btn--primary btn--lg" to="/dashboard">
              Open the dashboard
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <a className="btn btn--lg" href="#product">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="6" rx="1" /><rect x="3" y="14" width="18" height="6" rx="1" />
                <path d="M7 7h.01M7 17h.01" strokeLinecap="round" />
              </svg>
              See the platform
            </a>
          </div>

          <div className="hero__trust">
            <div><strong>99.95%</strong>Platform uptime</div>
            <div><strong>150+</strong>Devices monitored per site</div>
            <div><strong>30 sec</strong>Alert latency</div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ position: 'relative' }}>
          <div className="float-card float-1">
            <div className="icon-wrap ic-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="label">System status</div>
              <div className="value">7 healthy · 1 warning</div>
            </div>
          </div>

          <div className="float-card float-2">
            <div className="icon-wrap ic-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.4-9.5-9C1 8 2.5 4.5 6 4c2-.3 4 .8 6 3 2-2.2 4-3.3 6-3 3.5.5 5 4 3.5 7-2.5 4.6-9.5 9-9.5 9z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="label">Predictive maintenance</div>
              <div className="value">3 risks flagged, 0 outages</div>
            </div>
          </div>

          <div className="device">
            <div className="device__bar">
              <span className="dot r" /><span className="dot y" /><span className="dot g" />
              <span className="url">inframonitor.local · /servers/overview</span>
            </div>
            <div className="device__body" style={{ background: 'var(--ink-50)' }}>
              <MockMonitor />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MockMonitor() {
  return (
    <div className="mock-mon">
      <div className="mock-mon__hd">
        <b>Datacenter Overview</b>
        <span>Refreshed 12s ago</span>
      </div>
      {DEVICES.map((d) => (
        <div className="mock-mon__row" key={d.name}>
          <span
            className="mock-mon__dot"
            style={{ background: d.status === 'ok' ? 'var(--ok)' : '#f59e0b' }}
          />
          <span className="mock-mon__name">
            {d.name}
            <div className="mock-mon__type">{d.type}</div>
          </span>
          <span className="mock-mon__bar"><i style={{ width: `${d.pct}%`, background: d.color }} /></span>
          <span className="mock-mon__pct">{d.pct}%</span>
        </div>
      ))}
      <div className="mock-mon__ft">8 devices · SNMP/API polling every 60s</div>
    </div>
  )
}
