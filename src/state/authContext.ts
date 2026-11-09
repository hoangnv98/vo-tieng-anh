import { createContext } from 'react'
import type { AuthUser } from '../repo/types'

export interface AuthContextValue {
  mode: 'local' | 'supabase'
  user: AuthUser | null
  loading: boolean
  signIn(email: string): Promise<void>
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
