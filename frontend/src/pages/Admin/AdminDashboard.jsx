import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../../components/layout/AdminShell'
import { adminApi } from '../../api/admin'
import { operatorApi } from '../../api/operator'
import { logActivity } from '../../hooks/useActivityLog'

// Spark data — static representative points (API has no time-series)
const SPARKS = {
  users:       '0,24 10,20 20,22 30,16 40,18 50,10 60,14 70,6 80,8',
  initialized: '0,22 10,18 20,20 30,12 40,16 50,8 60,12 70,4 80,6',
  branches:    '0,18 10,22 20,16 30,20 40,14 50,12 60,16 70,10 80,12',
  pending:     '0,12 10,16 20,10 30,14 40,8 50,12 60,6 70,16 80,10',
}

function KpiCard({ label, value, delta, deltaDir, sub, spark, sparkColor }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value ?? '—'}</div>
      {delta && (
        <span className={`kpi__delta kpi__delta--${deltaDir}`}>{delta}</span>
      )}
      {sub && <span className="kpi__sub">{sub}</span>}
      {spark && (
        <svg className="kpi__spark" width="80" height="32" viewBox="0 0 80 32" fill="none" aria-hidden="true">
          <polyline points={spark} stroke={sparkColor || 'currentColor'} strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [notices, setNotices] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    adminApi.stats()
      .then(data => {
        setStats(data)
        logActivity({ action: 'VIEW_DASHBOARD', category: 'System', summary: 'Admin viewed system overview dashboard' })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))

    // Load real notices from RRA EBM
    operatorApi.notices()
      .then(res => {
        const list = res?.notices?.data ?? res?.data ?? res ?? []
        setNotices(Array.isArray(list) ? list.slice(0, 4) : [])
      })
      .catch(() => setNotices([]))
  }, [])

  return (
    <AdminShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Admin</span><span>·</span><span>Dashboard</span></div>
            <h1>System Overview</h1>
          </div>
        </div>

        {/* Quick actions */}
        <div className="quick-actions">
          <button className="quick" onClick={() => navigate('/admin/users')}>
            <span className="ic b">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round"/></svg>
            </span>
            <div><div className="t">Add Device User</div><div className="s">Register operator</div></div>
            <span className="arr">→</span>
          </button>
          <button className="quick" onClick={() => navigate('/admin/branches')}>
            <span className="ic g">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </span>
            <div><div className="t">Manage Branches</div><div className="s">View all locations</div></div>
            <span className="arr">→</span>
          </button>
          <button className="quick" onClick={() => navigate('/admin/tax')}>
            <span className="ic a">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14l6-6M10 8.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zM15 15.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" strokeLinecap="round"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </span>
            <div><div className="t">Tax Config</div><div className="s">VAT rate table</div></div>
            <span className="arr">→</span>
          </button>
          <button className="quick" onClick={() => navigate('/admin/tools')}>
            <span className="ic v">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round"/></svg>
            </span>
            <div><div className="t">EBM Tools</div><div className="s">Sync &amp; reprogram</div></div>
            <span className="arr">→</span>
          </button>
        </div>

        {error && <div className="settings-error" style={{ marginBottom: 20 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
            <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
            </svg>
            <div style={{ marginTop: 10, fontSize: 13 }}>Loading statistics…</div>
          </div>
        ) : stats && (
          <>
            {/* KPI grid */}
            <div className="kpi-grid">
              <KpiCard
                label="Total Users"
                value={stats.users.total}
                delta="▲ active"
                deltaDir="up"
                sub="device operators"
                spark={SPARKS.users}
                sparkColor="#2563eb"
              />
              <KpiCard
                label="Initialized Devices"
                value={stats.users.initialized}
                delta="▲ active EBMs"
                deltaDir="up"
                sub="signed in"
                spark={SPARKS.initialized}
                sparkColor="#1f9d55"
              />
              <KpiCard
                label="Total Branches"
                value={stats.branches.total}
                delta="▲ locations"
                deltaDir="up"
                sub="registered"
                spark={SPARKS.branches}
                sparkColor="#0284c7"
              />
              <KpiCard
                label="Pending Init"
                value={stats.users.pending}
                delta={stats.users.pending > 0 ? `${stats.users.pending} overdue` : 'All clear'}
                deltaDir={stats.users.pending > 0 ? 'down' : 'up'}
                sub="awaiting initialization"
                spark={SPARKS.pending}
                sparkColor="#dc2626"
              />
            </div>

            {/* Charts row */}
            <div className="dashboard-grid">
              {/* Area chart */}
              <div className="card chart-area">
                <div className="chart-area__hd">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>System Activity — last 14 days</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>Users &amp; device initializations</p>
                  </div>
                  <div className="chart-area__legend">
                    <span><i style={{ background: 'var(--brand-700)' }} />Net users</span>
                    <span><i style={{ background: '#1f9d55' }} />Initialized</span>
                  </div>
                </div>
                <svg className="chart-svg" viewBox="0 0 720 240" preserveAspectRatio="none">
                  <title>System activity — last 14 days</title>
                  <defs>
                    <linearGradient id="adminChartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#143a72" stopOpacity=".22"/>
                      <stop offset="100%" stopColor="#143a72" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <g className="chart-grid">
                    <line x1="40" y1="40" x2="700" y2="40"/>
                    <line x1="40" y1="90" x2="700" y2="90"/>
                    <line x1="40" y1="140" x2="700" y2="140"/>
                    <line x1="40" y1="190" x2="700" y2="190"/>
                  </g>
                  <g className="chart-axis">
                    <text x="0" y="44">60</text>
                    <text x="0" y="94">40</text>
                    <text x="0" y="144">20</text>
                    <text x="0" y="194">0</text>
                    <text x="50" y="220">Apr 19</text>
                    <text x="170" y="220">Apr 22</text>
                    <text x="290" y="220">Apr 25</text>
                    <text x="410" y="220">Apr 28</text>
                    <text x="530" y="220">May 1</text>
                    <text x="650" y="220">May 2</text>
                  </g>
                  <path d="M50,160 L100,140 150,150 200,120 250,135 300,100 350,118 400,90 450,110 500,75 550,95 600,60 650,80 690,55 L690,200 L50,200 Z" fill="url(#adminChartGrad)" />
                  <polyline points="50,160 100,140 150,150 200,120 250,135 300,100 350,118 400,90 450,110 500,75 550,95 600,60 650,80 690,55" stroke="#143a72" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="50,180 100,170 150,175 200,160 250,168 300,150 350,158 400,140 450,148 500,128 550,140 600,118 650,128 690,110" stroke="#1f9d55" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="690" cy="55" r="4" fill="#143a72" stroke="#fff" strokeWidth="2"/>
                  <circle cx="690" cy="110" r="4" fill="#1f9d55" stroke="#fff" strokeWidth="2"/>
                </svg>
              </div>

              {/* Donut chart — driven by stats.tax.types when available */}
              <div className="card">
                <div className="card__head">
                  <div>
                    <h3>Tax type breakdown</h3>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>Active tax types</p>
                  </div>
                </div>
                {(() => {
                  const TAX_META = {
                    A: { color: '#6d28d9', label: 'A · Exempt' },
                    B: { color: '#2563eb', label: 'B · 18% Standard' },
                    C: { color: '#1f9d55', label: 'C · Zero-rated' },
                    D: { color: '#d97706', label: 'D · Non-VAT' },
                  }
                  // Use API data if available, else equal 25% fallback
                  const types = stats.tax?.types?.length > 0
                    ? stats.tax.types.map(t => ({ ...t, color: TAX_META[t.taxType]?.color || '#888', label: TAX_META[t.taxType]?.label || t.taxType }))
                    : Object.entries(TAX_META).map(([k, v]) => ({ taxType: k, pct: 25, color: v.color, label: v.label }))

                  // Build strokeDasharray / strokeDashoffset for each segment
                  let offset = 25
                  const segments = types.map(t => {
                    const pct = t.pct ?? 25
                    const seg = { ...t, pct, dasharray: `${pct} ${100 - pct}`, dashoffset: offset }
                    offset -= pct
                    return seg
                  })

                  return (
                    <div className="donut-wrap">
                      <div className="donut">
                        <svg viewBox="0 0 36 36" width="140" height="140">
                          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e9ecf2" strokeWidth="3.6"/>
                          {segments.map(s => (
                            <circle key={s.taxType} cx="18" cy="18" r="15.9155" fill="none"
                              stroke={s.color} strokeWidth="3.6"
                              strokeDasharray={s.dasharray}
                              strokeDashoffset={s.dashoffset}
                              transform="rotate(-90 18 18)" strokeLinecap="butt"/>
                          ))}
                        </svg>
                        <div className="center">
                          <b>{stats.tax?.active ?? types.length}</b>
                          <span>Tax types</span>
                        </div>
                      </div>
                      <div className="donut-list">
                        {segments.map(s => (
                          <div className="row" key={s.taxType}>
                            <i style={{ background: s.color }}/>
                            <span>{s.label}</span>
                            <span className="v">{s.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Recents + Notices */}
            <div className="row-flex" style={{ marginBottom: 18 }}>
              {/* Recently added users */}
              <div className="card">
                <div className="card__head">
                  <div>
                    <h3>Recently Added Users</h3>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>Latest device operators</p>
                  </div>
                  <button className="btn btn--ghost btn--sm" onClick={() => navigate('/admin/users')}>View all →</button>
                </div>
                <div className="recents-list">
                  {(stats.recentUsers?.slice(0, 5) ?? []).map(u => {
                    const initials = (u.fullName || u.email || '??').slice(0, 2).toUpperCase()
                    return (
                      <div key={u.id}>
                        <div className="av">{initials}</div>
                        <div>
                          <div className="t">{u.fullName || '—'}</div>
                          <div className="s">{u.email}</div>
                        </div>
                        <div className="amt">
                          {u.sdcId
                            ? <span className="chip chip--ok">Initialized</span>
                            : <span className="chip chip--warn">Pending</span>
                          }
                        </div>
                      </div>
                    )
                  })}
                  {(!stats.recentUsers || stats.recentUsers.length === 0) && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No recent users</div>
                  )}
                </div>
              </div>

              {/* System notices */}
              <div className="card">
                <div className="card__head">
                  <div>
                    <h3>System Notices</h3>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>RRA announcements</p>
                  </div>
                </div>
                <div>
                  {notices.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>
                      No notices available
                    </div>
                  ) : notices.map((n, i) => (
                    <div className="notice" key={n.noticeNo || i}>
                      <div className="ic">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div>
                        <b>{n.title}</b>
                        {n.content && <p>{n.content.slice(0, 120)}{n.content.length > 120 ? '…' : ''}</p>}
                        <time>{n.registeredAt ? new Date(n.registeredAt).toLocaleDateString() : ''} · RRA</time>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Branch performance table */}
            <div className="card">
              <div className="card__head">
                <div>
                  <h3>Performance by branch</h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>All registered branches</p>
                </div>
                <div className="tab-bar">
                  <button className="is-active">Users</button>
                  <button>Branches</button>
                  <button>Status</button>
                </div>
              </div>
              <div>
                {stats.branches?.list?.length > 0 ? (() => {
                  const maxUsers = Math.max(...stats.branches.list.map(b => b.userCount || 0), 1)
                  return stats.branches.list.map(b => (
                    <div className="branch-row" key={b.id}>
                      <div className="name">
                        <b>{b.branchName || `Branch ${b.branchId}`}</b>
                        <span>Bhf {b.branchId} · {b.tin}</span>
                      </div>
                      <div className="num">{b.userCount ?? 0}</div>
                      <div className="num">{b.isHeadquarter === 'Y' ? 'HQ' : 'Sub'}</div>
                      <div className="bar"><i style={{ width: `${Math.round(((b.userCount || 0) / maxUsers) * 100)}%` }} /></div>
                      <div>
                        {b.branchStatusCode === 'A'
                          ? <span className="chip chip--ok">Active</span>
                          : <span className="chip chip--warn">Inactive</span>
                        }
                      </div>
                    </div>
                  ))
                })() : (
                  <div style={{ padding: '24px 20px', color: 'var(--ink-500)', fontSize: 13 }}>No branch data available</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
