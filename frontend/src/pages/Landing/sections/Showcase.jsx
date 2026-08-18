import { Link } from 'react-router-dom'
import BrandMark from '../../../components/ui/BrandMark'
import Chip from '../../../components/ui/Chip'

const RESOURCE_ROWS = [
  { name: 'CPU usage', width: '42%', color: 'var(--brand-700)', value: '42%' },
  { name: 'Memory usage', width: '58%', color: 'var(--ok)', value: '58%' },
  { name: 'Storage usage', width: '65%', color: '#6d28d9', value: '65%' },
  { name: 'Power draw (kW)', width: '78%', color: 'var(--warn)', value: '78%' },
]

const RECENT = [
  { id: 'CRIT-018', device: 'ESXi-Host-03', sev: 'Critical', detail: 'CPU sustained above 90%' },
  { id: 'WARN-041', device: 'Blade-Switch-03', sev: 'Warning', detail: 'Fan speed degraded' },
  { id: 'WARN-039', device: 'Storage-03', sev: 'Warning', detail: 'Capacity crossed 80%' },
  { id: 'CRIT-017', device: 'Core-FW-01', sev: 'Critical', detail: 'Lost redundant power feed' },
]

export default function Showcase() {
  return (
    <section className="showcase">
      <div className="showcase__inner">
        <div>
          <span className="eyebrow">Live operations</span>
          <h2 style={{ fontSize: '36px', lineHeight: 1.18, letterSpacing: '-.022em', margin: '14px 0', fontWeight: 800 }}>
            A dashboard your NOC can actually read at 3 a.m.
          </h2>
          <p style={{ color: 'var(--ink-600)', fontSize: '15px', lineHeight: 1.6 }}>
            Resource utilization, storage growth, network throughput, predictive risk scores and the
            live alerts queue — all in one calm screen designed for operators, not just executives.
          </p>
          <div style={{ marginTop: '22px', display: 'flex', gap: '10px' }}>
            <Link className="btn btn--primary" to="/dashboard">Open dashboard</Link>
            <a className="btn" href="#features">See what&apos;s monitored</a>
          </div>
        </div>

        <div className="showcase__art">
          <div className="showcase__art-hd">
            <BrandMark size={26} />
            <b>Today · Aug 4, 2026</b>
            <Chip variant="ok" style={{ marginLeft: 'auto' }}>All systems normal</Chip>
          </div>

          <div className="ms-bar">
            {RESOURCE_ROWS.map((row) => (
              <div key={row.name} className="stat-row">
                <span className="name">{row.name}</span>
                <span className="bar">
                  <i style={{ width: row.width, background: row.color }} />
                </span>
                <span className="v">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="ms-recents">
            <h5>Live alerts queue</h5>
            {RECENT.map((a) => (
              <div key={a.id} className="row">
                <span className="id">{a.id}</span>
                <span>{a.device}</span>
                <span>{a.sev}</span>
                <span className="amt">{a.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
