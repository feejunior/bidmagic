import { createContext } from 'react'
import type { Role, User } from '../api/types'

export type RegisterData = {
  name: string
  email: string
  password: string
  role: Role
}

export type AuthState = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (data: RegisterData) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
