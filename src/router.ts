import type { ComponentType } from 'react'
import { createBrowserRouter, redirect, type LoaderFunctionArgs } from 'react-router-dom'
import { RouteError } from './components/RouteError'
import { Shell } from './components/Shell'
import { config, initServices } from './state/services'

type RouteModule = { default: ComponentType }
const page = (load: () => Promise<RouteModule>) => async () => ({ Component: (await load()).default })

/** Đường dẫn nội bộ an toàn cho `?next`: cùng origin, bắt đầu `/`, không có `\\` hay ký tự điều khiển. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/')) return '/'
  for (let i = 0; i < next.length; i++) {
    const c = next.charCodeAt(i)
    if (c <= 0x1f || c === 0x7f || next[i] === '\\') return '/'
  }
  try {
    const u = new URL(next, window.location.origin)
    if (u.origin !== window.location.origin || !u.pathname.startsWith('/')) return '/'
    return u.pathname + u.search + u.hash
  } catch {
    return '/'
  }
}

const LOGIN_NEXT_KEY = 'vta:login-next'
const LOGIN_NEXT_TTL_MS = 15 * 60 * 1000

/** Lưu `next` (chỉ path + ts) để tab mở từ email vẫn dùng được; `null` thì xoá. */
export function saveLoginNext(path: string | null): void {
  try {
    if (path) localStorage.setItem(LOGIN_NEXT_KEY, JSON.stringify({ path, ts: Date.now() }))
    else localStorage.removeItem(LOGIN_NEXT_KEY)
  } catch {
    /* bỏ qua */
  }
}

/** Đọc + xoá `next` đã lưu (hết hạn sau 15 phút) → null nếu không có. */
export function consumeLoginNext(): string | null {
  try {
    const raw = localStorage.getItem(LOGIN_NEXT_KEY)
    localStorage.removeItem(LOGIN_NEXT_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { path?: unknown; ts?: unknown }
    if (typeof v.path !== 'string' || typeof v.ts !== 'number' || Date.now() - v.ts > LOGIN_NEXT_TTL_MS) return null
    return safeNext(v.path)
  } catch {
    return null
  }
}

/** Guard route gốc (2.5): supabase + chưa có session → /login?next=… Chế độ cục bộ không bao giờ redirect. */
async function requireSession({ request }: LoaderFunctionArgs) {
  if (config.mode !== 'supabase') return null
  const { auth } = await initServices()
  if (await auth.getSession()) return null
  const url = new URL(request.url)
  return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`)
}

/** `/login` khi đã có session → về `next` hoặc `/`. */
async function loginLoader({ request }: LoaderFunctionArgs) {
  if (config.mode !== 'supabase') return null
  const { auth } = await initServices()
  if (!(await auth.getSession())) return null
  return redirect(consumeLoginNext() ?? safeNext(new URL(request.url).searchParams.get('next')))
}

export function createAppRouter() {
  return createBrowserRouter([
    { path: '/login', loader: loginLoader, ErrorBoundary: RouteError, lazy: page(() => import('./routes/Login')) },
    {
      path: '/',
      Component: Shell,
      ErrorBoundary: RouteError,
      loader: requireSession,
      // không chạy lại guard mỗi lần đổi route con; Shell tự chuyển /login khi mất phiên
      shouldRevalidate: () => false,
      children: [
        { index: true, lazy: page(() => import('./routes/Today')) },
        { path: 'lessons', lazy: page(() => import('./routes/Lessons')) },
        { path: 'lessons/new', lazy: page(() => import('./routes/LessonEdit')) },
        { path: 'lessons/:id', lazy: page(() => import('./routes/LessonView')) },
        { path: 'lessons/:id/edit', lazy: page(() => import('./routes/LessonEdit')) },
        { path: 'review', lazy: page(() => import('./routes/Review')) },
        { path: 'patterns', lazy: page(() => import('./routes/Patterns')) },
        { path: 'patterns/:situationId', lazy: page(() => import('./routes/PatternSituation')) },
        { path: 'shadowing', lazy: page(() => import('./routes/Shadowing')) },
        { path: 'progress', lazy: page(() => import('./routes/Progress')) },
        { path: 'settings', lazy: page(() => import('./routes/Settings')) },
        { path: '*', lazy: page(() => import('./routes/NotFound')) },
      ],
    },
  ], {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_skipActionErrorRevalidation: true,
    },
  })
}
