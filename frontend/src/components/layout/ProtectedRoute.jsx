import { Navigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, authLoading, isAdmin } = useApp()

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--ink-500)', fontSize: '14px' }}>Loading…</div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Admin trying to reach operator routes → send to admin area
  if (!adminOnly && isAdmin) return <Navigate to="/admin/users" replace />

  // Operator trying to reach admin routes → send to dashboard
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />

  return children
}
