import { useState, useEffect, useCallback } from 'react'
import AdminShell from '../../components/layout/AdminShell'
import { adminApi } from '../../api/admin'
import { logActivity } from '../../hooks/useActivityLog'

const EMPTY_FORM = {
  fullName: '', email: '', password: '', tin: '',
  phoneNumber: '', serialNo: '', mrc: '', imageLink: '',
}

const EDIT_FIELDS = [
  { label: 'Full Name',     name: 'fullName',    type: 'text' },
  { label: 'Phone Number',  name: 'phoneNumber', type: 'text' },
  { label: 'Device Serial', name: 'serialNo',    type: 'text' },
  { label: 'MRC',           name: 'mrc',         type: 'text' },
  { label: 'Branch ID',     name: 'branchId',    type: 'text' },
  { label: 'Taxpayer Name', name: 'taxPayerName',type: 'text' },
  { label: 'Province',      name: 'province',    type: 'text' },
  { label: 'District',      name: 'district',    type: 'text' },
  { label: 'Sector',        name: 'sector',      type: 'text' },
  { label: 'Address',       name: 'address',     type: 'text' },
  { label: 'New Password',  name: 'password',    type: 'password', placeholder: 'Leave blank to keep current' },
  { label: 'Image URL',     name: 'imageLink',   type: 'text' },
]

const AVATAR_COLORS = [
  { bg: 'var(--brand-100)', color: 'var(--brand-700)' },
  { bg: '#dcfce7', color: 'var(--ok)' },
  { bg: '#fef3c7', color: '#b45309' },
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#cffafe', color: '#0e7490' },
  { bg: '#ffe4e6', color: '#be123c' },
]

function avatarColor(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

const TABS = ['All', 'Initialized', 'Pending', 'Training']

export default function AdminUsers() {
  const [users,   setUsers]   = useState([])
  const [meta,    setMeta]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('All')
  const [search,  setSearch]  = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)
  const [saveErr,  setSaveErr]  = useState(null)

  const [editUser,   setEditUser]   = useState(null)
  const [editForm,   setEditForm]   = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editErr,    setEditErr]    = useState(null)

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.listUsers(page)
      const list = res?.data ?? res ?? []
      setUsers(Array.isArray(list) ? list : list?.data ?? [])
      setMeta(list?.meta ?? null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaveErr(null)
    setSaving(true)
    try {
      await adminApi.createUser({ ...form, tin: Number(form.tin) })
      logActivity({ action: 'CREATE_USER', category: 'Users', summary: `Created device user "${form.fullName}" (${form.email}, TIN: ${form.tin})` })
      setShowForm(false)
      setForm(EMPTY_FORM)
      loadUsers()
    } catch (err) {
      setSaveErr(err.data?.errors?.[0]?.message || err.message)
      logActivity({ action: 'CREATE_USER', category: 'Users', summary: `Failed to create user "${form.fullName}"`, status: 'error', detail: err.message })
    } finally {
      setSaving(false)
    }
  }

  function openEdit(user) {
    setEditUser(user)
    setEditForm({
      fullName:    user.fullName    || '',
      phoneNumber: user.phoneNumber || '',
      serialNo:    user.serialNo    || '',
      mrc:         user.mrc         || '',
      branchId:    user.branchId    || '',
      taxPayerName:user.taxPayerName|| '',
      province:    user.province    || '',
      district:    user.district    || '',
      sector:      user.sector      || '',
      address:     user.address     || '',
      password:    '',
      imageLink:   user.imageLink   || '',
    })
    setEditErr(null)
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditErr(null)
    setEditSaving(true)
    try {
      const payload = { email: editUser.email, tin: Number(editUser.tin) }
      EDIT_FIELDS.forEach(({ name }) => {
        if (name === 'password' && !editForm[name]) return
        if (editForm[name] !== undefined && editForm[name] !== '') payload[name] = editForm[name]
      })
      await adminApi.updateUser(payload)
      logActivity({ action: 'UPDATE_USER', category: 'Users', summary: `Updated device user "${editUser.fullName || editUser.email}"` })
      setEditUser(null)
      loadUsers()
    } catch (err) {
      setEditErr(err.data?.errors?.[0]?.message || err.message)
      logActivity({ action: 'UPDATE_USER', category: 'Users', summary: `Failed to update user "${editUser.fullName}"`, status: 'error', detail: err.message })
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this device user? This cannot be undone.')) return
    try {
      await adminApi.deleteUser(id)
      logActivity({ action: 'DELETE_USER', category: 'Users', summary: `Deleted device user ID: ${id}` })
      loadUsers()
    } catch (err) {
      alert(err.message)
      logActivity({ action: 'DELETE_USER', category: 'Users', summary: `Failed to delete user ID: ${id}`, status: 'error', detail: err.message })
    }
  }

  // Client-side filtering
  const filtered = users.filter(u => {
    if (tab === 'Initialized' && !u.sdcId) return false
    if (tab === 'Pending'     && (u.sdcId || u.isTrainingMode)) return false
    if (tab === 'Training'    && !u.isTrainingMode) return false
    if (search) {
      const s = search.toLowerCase()
      if (!((u.fullName || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s))) return false
    }
    return true
  })

  const total       = meta?.total ?? users.length
  const initialized = users.filter(u => u.sdcId).length
  const pending     = users.filter(u => !u.sdcId && !u.isTrainingMode).length
  const training    = users.filter(u => u.isTrainingMode).length

  const totalPages  = meta ? meta.lastPage ?? Math.ceil(meta.total / (meta.perPage || 20)) : 1
  const currentPage = meta?.page ?? 1

  return (
    <AdminShell>
      <div className="page">
        <div className="page-head">
          <div>
            <div className="crumbs"><span>Admin</span><span>›</span><span>Device Users</span></div>
            <h1>Device Users</h1>
          </div>
          <div className="page-head__actions">
            <button className="btn btn--primary" onClick={() => { setShowForm(s => !s); setSaveErr(null) }}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
              {showForm ? 'Cancel' : 'Add Device User'}
            </button>
          </div>
        </div>

        {/* KPI grid */}
        {!loading && (
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi__label">Total Users</div>
              <div className="kpi__value">{total}</div>
              <span className="kpi__delta kpi__delta--up">▲ operators</span>
              <span className="kpi__sub">device operators</span>
            </div>
            <div className="kpi">
              <div className="kpi__label">Initialized</div>
              <div className="kpi__value">{initialized}</div>
              <span className="kpi__delta kpi__delta--up">▲ active EBMs</span>
            </div>
            <div className="kpi">
              <div className="kpi__label">Pending Init</div>
              <div className="kpi__value">{pending}</div>
              <span className={`kpi__delta kpi__delta--${pending > 0 ? 'down' : 'up'}`}>
                {pending > 0 ? `${pending} overdue` : 'All clear'}
              </span>
            </div>
            <div className="kpi">
              <div className="kpi__label">Training Mode</div>
              <div className="kpi__value">{training}</div>
              <span className={`kpi__delta kpi__delta--${training > 0 ? 'down' : 'up'}`}>
                {training > 0 ? 'in training' : 'None active'}
              </span>
            </div>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20, maxWidth: 720 }}>
            <div className="card__head"><h3>New Device User</h3></div>
            <div className="card__body">
              {saveErr && <div className="settings-error" style={{ marginBottom: 16 }}>{saveErr}</div>}
              <form onSubmit={handleCreate}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <Field label="Full Name"       name="fullName"    value={form.fullName}    onChange={handleChange} required placeholder="John Doe" />
                  <Field label="Email"           name="email"       value={form.email}       onChange={handleChange} required type="email" placeholder="operator@company.rw" />
                  <Field label="Password"        name="password"    value={form.password}    onChange={handleChange} required type="password" placeholder="Min 8 characters" />
                  <Field label="TIN (9 digits)"  name="tin"         value={form.tin}         onChange={handleChange} required placeholder="999909100" />
                  <Field label="Phone Number"    name="phoneNumber" value={form.phoneNumber} onChange={handleChange} required placeholder="0788123456" />
                  <Field label="Device Serial"   name="serialNo"    value={form.serialNo}    onChange={handleChange} required placeholder="EBM-SN-0001" />
                  <Field label="MRC"             name="mrc"         value={form.mrc}         onChange={handleChange} required placeholder="Sandbox MRC value" hint="From the EBM device or sandbox" />
                  <Field label="Image URL"       name="imageLink"   value={form.imageLink}   onChange={handleChange} placeholder="https://…" />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn btn--primary" disabled={saving}>
                    {saving ? 'Creating…' : 'Create Device User'}
                  </button>
                  <button type="button" className="btn" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setSaveErr(null) }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editUser && (
          <div className="modal-backdrop" onClick={() => setEditUser(null)}>
            <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
              <div className="modal__head">
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Editing</div>
                  <h3 style={{ margin: 0 }}>{editUser.fullName || editUser.email}</h3>
                </div>
                <button className="modal__close" onClick={() => setEditUser(null)} aria-label="Close">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
                </button>
              </div>
              <div className="modal__body">
                {editErr && <div className="settings-error" style={{ marginBottom: 14 }}>{editErr}</div>}
                <form onSubmit={handleEdit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                    {EDIT_FIELDS.map(f => (
                      <Field
                        key={f.name + (f.type === 'password' ? '_pw' : '')}
                        label={f.label} name={f.name} type={f.type}
                        value={editForm[f.name] ?? ''}
                        onChange={e => setEditForm(ef => ({ ...ef, [f.name]: e.target.value }))}
                        placeholder={f.placeholder}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button type="submit" className="btn btn--primary" disabled={editSaving}>
                      {editSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button type="button" className="btn" onClick={() => setEditUser(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table card */}
        <div className="card">
          {/* Filter bar */}
          <div className="filterbar">
            <div className="tab-bar">
              {TABS.map(t => (
                <button key={t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            <div className="field">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/></svg>
              <input
                placeholder="Search name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="table-wrap">
            {error && <div className="settings-error" style={{ margin: 16 }}>{error}</div>}
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-500)' }}>Loading users…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-500)' }}>
                No device users found.
              </div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>TIN</th>
                    <th>Serial No</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const initials = (u.fullName || u.email || '??').slice(0, 2).toUpperCase()
                    const { bg, color } = avatarColor(u.email || u.id)
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar" style={{ background: bg, color, borderRadius: 8, width: 30, height: 30, fontSize: 11 }}>{initials}</div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{u.fullName || '—'}</div>
                              <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="mono">{u.tin}</td>
                        <td className="mono">{u.serialNo || '—'}</td>
                        <td>{u.branchName || u.branchId || '—'}</td>
                        <td>
                          {u.sdcId
                            ? <span className="chip chip--ok">Initialized</span>
                            : <span className="chip chip--warn">Pending</span>
                          }
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn--sm" onClick={() => openEdit(u)}>Edit</button>
                            <button className="btn btn--danger btn--sm" onClick={() => handleDelete(u.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="pagination">
              <span>
                Showing {((currentPage - 1) * (meta?.perPage || 20)) + 1}–{Math.min(currentPage * (meta?.perPage || 20), total)} of {total} users
              </span>
              <div className="pages">
                <button onClick={() => loadUsers(currentPage - 1)} disabled={currentPage <= 1}>‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={p === currentPage ? 'is-active' : ''} onClick={() => loadUsers(p)}>{p}</button>
                ))}
                <button onClick={() => loadUsers(currentPage + 1)} disabled={currentPage >= totalPages}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}

function Field({ label, name, value, onChange, required, type = 'text', placeholder, hint }) {
  const id = name || label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}{required && <span style={{ color: 'var(--err)', marginLeft: 2 }}>*</span>}
      </label>
      <input
        id={id} name={name} type={type}
        className="form-input"
        value={value} onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  )
}
