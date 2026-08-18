import { Link } from 'react-router-dom'
import BrandMark from '../ui/BrandMark'

export default function Footer() {
  return (
    <footer id="docs">
      <div className="inner">
        <div className="footer-brand">
          <div className="lnav__brand">
            <BrandMark size={32} />
            <span className="brand-name" style={{ color: 'var(--ink-900)' }}>InfraMonitor</span>
          </div>
          <p>Server room &amp; infrastructure management for teams who can&apos;t afford downtime — real-time monitoring, predictive analytics and predictive maintenance in one platform.</p>
        </div>

        <div>
          <h5>Platform</h5>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><a href="#features">Server monitoring</a></li>
            <li><a href="#features">Storage &amp; network</a></li>
            <li><a href="#features">Predictive analytics</a></li>
            <li><a href="#features">Reports &amp; audit log</a></li>
          </ul>
        </div>

        <div>
          <h5>Reliability</h5>
          <ul>
            <li><a href="#compliance">Predictive maintenance</a></li>
            <li><a href="#compliance">Role-based access</a></li>
            <li><a href="#compliance">Alert routing</a></li>
            <li><a href="#compliance">Audit trail</a></li>
          </ul>
        </div>

        <div>
          <h5>Company</h5>
          <ul>
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/contact">Contact us</Link></li>
            <li><a href="#">Status page</a></li>
            <li><a href="#">Changelog</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 InfraMonitor · Kigali, Rwanda</span>
        <span>Datacenter platform · Last sync Aug 4, 2026, 10:30 CAT</span>
      </div>
    </footer>
  )
}
