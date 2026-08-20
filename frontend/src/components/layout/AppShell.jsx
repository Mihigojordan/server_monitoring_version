import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import ReactCountryFlag from 'react-country-flag'
import BrandMark from '../ui/BrandMark'
import { useApp } from '../../context/AppContext'
import { logActivity } from '../../hooks/useActivityLog'

const NAV_ITEMS = [
  {
    to: '/system-overview', label: 'Dashboard',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="3" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="14" width="7" height="7" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    to: 'group:infrastructure', label: 'Device Management',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2 2 7l10 5 10-5-10-5Z" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    children: [
      { to: '/server-management', label: 'Server Management' },
      { to: '/storage-management', label: 'Storage Management' },
      { to: '/network-management', label: 'Network Management' },
    ],
  },
  {
    to: '/predictive-maintenance', label: 'Predictive Maintenance',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    to: 'group:predictive', label: 'Predictive Analytics',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 15l3.5-4.5 3 3L19 6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="19" cy="6" r="1.6" fill="currentColor" stroke="none"/></svg>,
    children: [
      { to: '/predictive-analytics/servers', label: 'Server Analytics' },
      { to: '/predictive-analytics/storage', label: 'Storage Analytics' },
      { to: '/predictive-analytics/switches', label: 'Switch Analytics' },
    ],
  },
  {
    to: '/alerts', label: 'Alerts Center',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round"/></svg>,
  },
  {
    to: '/resource-utilization', label: 'Resource Utilization',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="3" width="7" height="5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="12" width="7" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="16" width="7" height="5" rx="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    to: '/report-management', label: 'Report Management',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 17H7A5 5 0 0 1 7 7h2m6 10h2a5 5 0 0 0 0-10h-2" strokeLinecap="round" strokeLinejoin="round"/><line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round"/></svg>,
  },
  {
    to: 'group:reports', label: 'Reports & Compliance',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    children: [
      { to: '/cost-reporting', label: 'Cost & TCO Reporting' },
      { to: '/compliance-audit', label: 'Compliance & Security Audit' },
    ],
  },
  {
    to: 'group:support', label: 'Support',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.9 4.9 4.24 4.24M14.86 14.86l4.24 4.24M14.86 9.14l4.24-4.24M4.9 19.1l4.24-4.24" strokeLinecap="round"/></svg>,
    children: [
      { to: '/support-tickets', label: 'Support Tickets' },
      { to: '/support-utilization', label: 'Support Utilization' },
      { to: '/help-center', label: 'Help Center' },
    ],
  },
  {
    to: 'group:admin', label: 'Administration',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round"/><line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round"/><line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="9" cy="18" r="2" fill="var(--surface)"/></svg>,
    children: [
      { to: '/user-management', label: 'User Management' },
      { to: '/logs', label: 'Log Audit' },
      { to: '/system-configuration', label: 'System Configuration' },
    ],
  },
]

const LANGUAGES = [
  { code: 'en', label: 'English', countryCode: 'GB' },
  { code: 'fr', label: 'Français', countryCode: 'FR' },
  { code: 'rw', label: 'Kinyarwanda', countryCode: 'RW' },
]

export default function AppShell({ children }) {
  const { user, logout, vsdcStatus } = useApp()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('op-theme') || 'light')
  const [lang, setLang] = useState(() => localStorage.getItem('op-lang') || 'en')
  const [langOpen, setLangOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const profileRef = useRef(null)

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('op-theme', theme)
  }, [theme])

  // Track fullscreen
  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Close lang dropdown on outside click
  const closeLang = useCallback((e) => {
    if (!e.target.closest('.lang-picker')) setLangOpen(false)
  }, [])
  useEffect(() => {
    if (langOpen) document.addEventListener('mousedown', closeLang)
    return () => document.removeEventListener('mousedown', closeLang)
  }, [langOpen, closeLang])

  // Close profile dropdown on outside click
  useEffect(() => {
    function handler(e) { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleLogout() {
    logActivity({ action: 'SIGN_OUT', category: 'Auth', summary: 'Operator ' + displayUser.name + ' signed out' });
    logout();
    navigate('/login', { replace: true });
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    logActivity({ action: 'CHANGE_THEME', category: 'System', summary: 'Switched UI theme to ' + next + ' mode' })
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { })
    } else {
      document.exitFullscreen().catch(() => { })
    }
  }

  function selectLang(code) {
    const l = LANGUAGES.find(x => x.code === code)
    setLang(code)
    localStorage.setItem('op-lang', code)
    setLangOpen(false)
    logActivity({ action: 'CHANGE_LANGUAGE', category: 'System', summary: `Changed interface language to ${l?.label || code}` })
  }

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  const displayUser = user || {
    name: 'Operator', role: 'Device Operator', initials: 'OP',
    tin: '—', branch: '—', device: '—', isTrainingMode: false,
  }

  const [openGroups, setOpenGroups] = useState(() => {
    // Open group if active child exists
    const path = window.location.pathname
    const group = NAV_ITEMS.find(n => n.children?.some(c => path.startsWith(c.to.split('?')[0])))
    return group ? [group.to] : []
  })

  function toggleGroup(to) {
    setOpenGroups(prev => prev.includes(to) ? prev.filter(x => x !== to) : [...prev, to])
  }

  return (
    <div className={`app operator-app${collapsed ? ' sidebar-collapsed' : ''}${theme === 'dark' ? ' theme-dark' : ''}`}>

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <BrandMark size={38} />
          {!collapsed && (
            <div className="sidebar__brand-text">
              <div className="brand-name">InfraMonitor</div>
              <div className="brand-sub">Infra Management</div>
            </div>
          )}
        </div>

        {!collapsed && <div className="sidebar__section">Operations</div>}

        <nav className="nav">
          {NAV_ITEMS.map(item => {
            if (item.children && !collapsed) {
              const isOpen = openGroups.includes(item.to)
              const hasActiveChild = item.children.some(c => window.location.pathname.startsWith(c.to.split('?')[0]))
              return (
                <div key={item.to} className={`nav__group${isOpen ? ' is-open' : ''}${hasActiveChild ? ' has-active' : ''}`}>
                  <button className="nav__item nav__item--group" onClick={() => toggleGroup(item.to)}>
                    {item.icon}
                    <div className="nav__item-text">
                      <span className="nav__item-label">{item.label}</span>
                      <span className="nav__item-sub">{item.sub}</span>
                    </div>
                    <svg className="nav__group-chevron" viewBox="0 0 16 16" fill="none" width="12" height="12">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="nav__children">
                    {item.children.map(child => (
                      <NavLink key={child.to} to={child.to} className={({ isActive }) => `nav__child${isActive ? ' is-active' : ''}`}>
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )
            }

            return (
              <NavLink
                key={item.to}
                to={item.children ? item.children[0].to : item.to}
                title={collapsed ? item.label : undefined}
                className={() => {
                  const isActive = item.children
                    ? item.children.some(c => window.location.pathname.startsWith(c.to.split('?')[0]))
                    : window.location.pathname.startsWith(item.to.split('?')[0])
                  return `nav__item${isActive ? ' is-active' : ''}${collapsed ? ' nav__item--icon' : ''}`
                }}
              >
                {item.icon}
                {!collapsed && (
                  <div className="nav__item-text">
                    <span className="nav__item-label">{item.label}</span>
                    <span className="nav__item-sub">{item.sub}</span>
                  </div>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar__device" style={{ marginTop: 'auto' }}>
          <div className="device-card">
            {!collapsed ? (
              <>
                <div className="device-card__row">
                  <span>System status</span>
                  <b className={`device-card__pulse${vsdcStatus === 'offline' ? ' device-card__pulse--offline' : vsdcStatus === 'checking' ? ' device-card__pulse--checking' : ''}`}>
                    {vsdcStatus === 'online' ? 'Online' : vsdcStatus === 'offline' ? 'Offline' : '…'}
                  </b>
                </div>
                <div className="device-card__row">
                  <span>TIN</span>
                  <b style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{displayUser.tin}</b>
                </div>
                <div className="device-card__row">
                  <span>Branch</span>
                  <b style={{ fontSize: 11.5 }}>{displayUser.branch}</b>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                <span className="device-card__pulse" style={{ fontSize: 10 }}>●</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main">
        <div className="topbar">

          {/* Sidebar collapse toggle */}
          <button
            className="icon-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
              <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
              <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
            </svg>
          </button>

          {/* Search */}
          <div className="search">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input placeholder="Search items, invoices, TINs…" aria-label="Search" />
            <span className="kbd">⌘K</span>
          </div>

          {displayUser.isTrainingMode && (
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#92400e', background: '#fef3c7', border: '1px solid #f59e0b', padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
              Training Mode
            </span>
          )}

          <div className="topbar__actions">

            {/* Fullscreen */}
            <button className="icon-btn" title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>
              {isFullscreen ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Language picker */}
            <div className="lang-picker">
              <button className="icon-btn" title="Language" onClick={() => setLangOpen(o => !o)}>
                <ReactCountryFlag
                  countryCode={currentLang.countryCode}
                  svg
                  style={{ width: 22, height: 16, borderRadius: 2 }}
                  title={currentLang.label}
                />
              </button>
              {langOpen && (
                <div className="lang-dropdown">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      className={`lang-dropdown__item${lang === l.code ? ' is-active' : ''}`}
                      onClick={() => selectLang(l.code)}
                      title={l.label}
                    >
                      <ReactCountryFlag
                        countryCode={l.countryCode}
                        svg
                        style={{ width: 26, height: 19, borderRadius: 2 }}
                        title={l.label}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dark / light toggle */}
            <button className="icon-btn" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
              {theme === 'dark' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Notifications */}
            <button className="icon-btn" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="dot" />
            </button>

            {/* User pill with dropdown */}
            <div className="profile-menu" ref={profileRef}>
              <button
                className="user-pill user-pill--btn"
                onClick={() => setProfileOpen(o => !o)}
                aria-expanded={profileOpen}
              >
                <div className="avatar">{displayUser.initials}</div>
                <div>
                  <div className="user-pill__name">{displayUser.name}</div>
                  <div className="user-pill__role">{displayUser.role}</div>
                </div>
                <svg viewBox="0 0 16 16" fill="none" width="12" height="12" style={{ marginLeft: 4, color: 'var(--ink-400)', flexShrink: 0 }}>
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {profileOpen && (
                <div className="profile-dropdown">
                  <NavLink to="/settings" className="profile-dropdown__item" onClick={() => setProfileOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Settings
                  </NavLink>
                  <div className="profile-dropdown__divider" />
                  <button className="profile-dropdown__item profile-dropdown__item--danger" onClick={handleLogout}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {children}
      </main>
    </div>
  )
}
