import { useState, useEffect, useCallback } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import ReactCountryFlag from 'react-country-flag'
import BrandMark from '../ui/BrandMark'
import { useApp } from '../../context/AppContext'
import { logActivity } from '../../hooks/useActivityLog'

const NAV = [
  {
    to: '/admin/dashboard', label: 'Dashboard', sub: 'Summary',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  },
  {
    to: '/admin/profile', label: 'My Profile', sub: 'Account',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round"/></svg>,
  },
  {
    to: '/admin/branches', label: 'Branches', sub: 'Management',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    to: '/admin/users', label: 'Device Users', sub: 'Management',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    to: '/admin/tax', label: 'Tax Config', sub: 'Management',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14l6-6M10 8.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zM15 15.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  },
  {
    to: '/admin/tools', label: 'EBM Tools', sub: 'Management',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    to: '/admin/logs', label: 'Activity Log', sub: 'Management',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    to: '/admin/settings', label: 'Settings', sub: 'Management',
    icon: <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
]
const LANGUAGES = [
  { code: 'en', label: 'English',     countryCode: 'GB' },
  { code: 'fr', label: 'Français',    countryCode: 'FR' },
  { code: 'rw', label: 'Kinyarwanda', countryCode: 'RW' },
]

export default function AdminShell({ children }) {
  const { logout } = useApp()
  const navigate   = useNavigate()

  const [collapsed,  setCollapsed]  = useState(false)
  const [theme,      setTheme]      = useState(() => localStorage.getItem('admin-theme') || 'light')
  const [lang,       setLang]       = useState(() => localStorage.getItem('admin-lang')  || 'en')
  const [langOpen,   setLangOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('admin-theme', theme)
  }, [theme])

  // Track fullscreen state
  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  function handleLogout() {
    logActivity({ action: 'SIGN_OUT', category: 'Auth', summary: 'Admin signed out of management console' })
    logout()
    navigate('/login', { replace: true })
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    logActivity({ action: 'CHANGE_THEME', category: 'System', summary: `Switched UI theme to ${next} mode` })
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  function selectLang(code) {
    const l = LANGUAGES.find(x => x.code === code)
    setLang(code)
    localStorage.setItem('admin-lang', code)
    setLangOpen(false)
    logActivity({ action: 'CHANGE_LANGUAGE', category: 'System', summary: `Changed interface language to ${l?.label || code}` })
  }

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  // Close lang dropdown on outside click
  const closeLang = useCallback((e) => {
    if (!e.target.closest('.lang-picker')) setLangOpen(false)
  }, [])
  useEffect(() => {
    if (langOpen) document.addEventListener('mousedown', closeLang)
    return () => document.removeEventListener('mousedown', closeLang)
  }, [langOpen, closeLang])

  // Close profile dropdown on outside click
  const closeProfile = useCallback((e) => {
    if (!e.target.closest('.profile-menu')) setProfileOpen(false)
  }, [])
  useEffect(() => {
    if (profileOpen) document.addEventListener('mousedown', closeProfile)
    return () => document.removeEventListener('mousedown', closeProfile)
  }, [profileOpen, closeProfile])

  return (
    <div className={`app admin-app${collapsed ? ' sidebar-collapsed' : ''}${theme === 'dark' ? ' theme-dark' : ''}`}>

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">

        {/* Brand */}
        <div className="sidebar__brand" style={{ justifyContent: 'center' }}>
          {collapsed ? <BrandMark size={26} /> : <BrandMark fill fillPct="80%" />}
        </div>

        {!collapsed && <div className="sidebar__section">Management</div>}

        <nav className="nav">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `nav__item${isActive ? ' is-active' : ''}${collapsed ? ' nav__item--icon' : ''}`}
            >
              {item.icon}
              {!collapsed && (
                <div className="nav__item-text">
                  <span className="nav__item-label">{item.label}</span>
                  <span className="nav__item-sub">{item.sub}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__device" style={{ marginTop: 'auto' }}>
          <div className="device-card">
            {!collapsed && (
              <>
                <div className="device-card__row">
                  <span>System status</span>
                  <b className="device-card__pulse">Online</b>
                </div>
                <div className="device-card__row">
                  <span>Role</span>
                  <b style={{ color: 'var(--brand-700)' }}>Administrator</b>
                </div>
              </>
            )}
            {collapsed && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                <span className="device-card__pulse" style={{ fontSize: 10 }}>●</span>
              </div>
            )}
            {!collapsed && (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', padding: '7px 0', border: '1px solid var(--ink-200)',
                    borderRadius: 7, background: 'transparent', color: 'var(--ink-600)',
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main">
        <div className="topbar">

          {/* Sidebar collapse toggle — lives in topbar */}
          <button
            className="icon-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6"  x2="21" y2="6"  strokeLinecap="round"/>
              <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round"/>
              <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Search */}
          <div className="search">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/>
            </svg>
            <input placeholder="Search users, branches, TINs…" aria-label="Search admin console" />
            <span className="kbd">⌘K</span>
          </div>

          <div className="topbar__actions">

            {/* Fullscreen toggle */}
            <button className="icon-btn" title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>
              {isFullscreen ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            <div className="lang-picker">
              <button className="icon-btn lang-btn" title="Language" onClick={() => setLangOpen(o => !o)}>
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
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>

            {/* Notifications */}
            <button className="icon-btn" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="dot" />
            </button>

            {/* User pill */}
            <div className="profile-menu">
              <button className="user-pill user-pill--btn" onClick={() => setProfileOpen(o => !o)}>
                <div className="avatar">AD</div>
                <div>
                  <div className="user-pill__name">InfraMonitor Admin</div>
                  <div className="user-pill__role">Administrator</div>
                </div>
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <Link className="profile-dropdown__item" to="/admin/profile" onClick={() => setProfileOpen(false)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round"/></svg>
                    My Profile
                  </Link>
                  <Link className="profile-dropdown__item" to="/admin/settings" onClick={() => setProfileOpen(false)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Settings
                  </Link>
                  <div className="profile-dropdown__divider" />
                  <button className="profile-dropdown__item profile-dropdown__item--danger" onClick={handleLogout}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
