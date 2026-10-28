import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { User } from '../api/types'
import { AuthContext, type RegisterData } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const logged = await api<User>('/auth/login', { method: 'POST', body: { email, password } })
    setUser(logged)
    return logged
  }, [])

  const register = useCallback(async (data: RegisterData) => {
    const created = await api<User>('/auth/register', { method: 'POST', body: data })
    setUser(created)
    return created
  }, [])

  const logout = useCallback(async () => {
    await api<void>('/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
