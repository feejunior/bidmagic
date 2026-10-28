import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from '../auth/useAuth'

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="muted">Carregando...</p>
  }
  if (!user) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  }
  if (user.role !== role) {
    return <Navigate to="/" replace />
  }
  return children
}
