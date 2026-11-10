import { createContext } from 'react'
import type { AuthUser } from '../repo/types'

export interface AuthContextValue {
  mode: 'local' | 'supabase'
  user: AuthUser | null
  loading: boolean
  signIn(email: string): Promise<void>
  /** (T21) Ném RepoError đã map; thành công thì `user` tới qua onChange (SIGNED_IN) trước khi resolve. */
  signInWithPassword(email: string, password: string): Promise<void>
  /** (T21) Đặt / đổi mật khẩu; `user.hasPassword` cập nhật qua USER_UPDATED. */
  setPassword(password: string): Promise<void>
  signOut(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
