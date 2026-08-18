export function Section({ title, subtitle, action, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card__head">
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-500)' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="card__body">{children}</div>
    </div>
  )
}

export function SettingRow({ label, sub, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 0', borderBottom: '1px solid var(--ink-100)', gap: 20,
    }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-800)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 24 }}>{children}</div>
    </div>
  )
}

export function SaveBtn({ saving, saved, onClick, label = 'Save changes' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
      <button className="btn btn--primary" onClick={onClick} disabled={saving} type="button">
        {saving ? 'Saving…' : label}
      </button>
      {saved && <span className="chip chip--ok">✓ Saved</span>}
    </div>
  )
}
