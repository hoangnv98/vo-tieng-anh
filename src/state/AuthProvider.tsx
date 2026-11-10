import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from '../repo/types'
import { AuthContext, type AuthContextValue } from './authContext'
import { services } from './services'

const LOCAL_USER: AuthUser = { id: 'local', email: null, hasPassword: false }

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

// (T21) so cả `hasPassword` để USER_UPDATED sau khi đặt mật khẩu làm Cài đặt render lại
// (DataProvider chỉ phụ thuộc `user.id` nên không tải lại snapshot).
function sameUser(a: AuthUser | null, b: AuthUser | null): boolean {
  return a?.id === b?.id && a?.email === b?.email && a?.hasPassword === b?.hasPassword
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = services()
  const [state, setState] = useState<AuthState>(() =>
    auth.mode === 'local' ? { user: LOCAL_USER, loading: false } : { user: null, loading: true },
  )

  useEffect(() => {
    if (auth.mode === 'local') return
    let alive = true
    // giữ nguyên object khi user không đổi (TOKEN_REFRESHED) để không kích hoạt tải lại
    const set = (user: AuthUser | null) =>
      setState((prev) => (sameUser(prev.user, user) && !prev.loading ? prev : { user, loading: false }))
    auth.getSession().then(
      (u) => alive && set(u),
      () => alive && set(null),
    )
    const off = auth.onChange((u) => alive && set(u))
    return () => {
      alive = false
      off()
    }
  }, [auth])

  const signIn = useCallback(
    (email: string) => auth.signInWithEmail(email, `${window.location.origin}/login`),
    [auth],
  )
  const signInWithPassword = useCallback(
    (email: string, password: string) => auth.signInWithPassword(email, password),
    [auth],
  )
  const setPassword = useCallback((password: string) => auth.setPassword(password), [auth])
  const signOut = useCallback(() => auth.signOut(), [auth])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: auth.mode,
      user: state.user,
      loading: state.loading,
      signIn,
      signInWithPassword,
      setPassword,
      signOut,
    }),
    [auth.mode, state, signIn, signInWithPassword, setPassword, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
