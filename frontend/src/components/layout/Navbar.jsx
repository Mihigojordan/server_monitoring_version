import { Link, useLocation } from 'react-router-dom'
import { useActiveSection } from '../../hooks/useActiveSection'
import BrandMark from '../ui/BrandMark'

const SECTION_LINKS = [
  { label: 'Platform', href: '#features', id: 'features' },
  { label: 'How it works', href: '#workflow', id: 'workflow' },
  { label: 'Reliability', href: '#compliance', id: 'compliance' },
  { label: 'Docs', href: '#docs', id: 'docs' },
]

const PAGE_LINKS = [
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export default function Navbar() {
  const activeId = useActiveSection()
  const { pathname } = useLocation()

  return (
    <header className="lnav">
      <div className="lnav__inner">
        <Link className="lnav__brand" to="/">
          <BrandMark size={32} />
          <span>
            <span className="brand-name">InfraMonitor</span>
          </span>
        </Link>

        <nav className="lnav__links">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.id}
              href={pathname === '/' ? link.href : `/${link.href}`}
              style={
                activeId === link.id
                  ? { color: 'var(--brand-700)', borderBottomColor: 'var(--brand-700)' }
                  : {}
              }
            >
              {link.label}
            </a>
          ))}
          {PAGE_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={
                pathname === link.to
                  ? { color: 'var(--brand-700)', borderBottomColor: 'var(--brand-700)' }
                  : {}
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="lnav__cta">
          <Link className="btn btn--ghost btn--sm" to="/dashboard">Sign in</Link>
          <Link className="btn btn--primary btn--sm" to="/dashboard">
            Open dashboard
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  )
}
