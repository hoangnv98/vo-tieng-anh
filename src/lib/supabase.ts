import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Mọi request tới Supabase bị huỷ sau 15s để replay hàng đợi không bị giữ lock vô hạn (2.4). */
export const REQUEST_TIMEOUT_MS = 15_000

/**
 * Bọc `fetch` với timeout, vẫn tôn trọng signal do supabase-js truyền vào.
 * Dùng `AbortSignal.timeout` / `AbortSignal.any` khi có; trình duyệt cũ (Safari < 17.4) thì fallback
 * `AbortController` + `setTimeout` (dọn timer khi request xong).
 */
export function createTimeoutFetch(baseFetch: typeof fetch = fetch, timeoutMs: number = REQUEST_TIMEOUT_MS): typeof fetch {
  const hasTimeout = typeof AbortSignal.timeout === 'function'
  const hasAny = typeof AbortSignal.any === 'function'
  return (input, init) => {
    const outer = init?.signal ?? null
    if (hasTimeout && (hasAny || !outer)) {
      const timeout = AbortSignal.timeout(timeoutMs)
      const signal = outer ? AbortSignal.any([outer, timeout]) : timeout
      return baseFetch(input, { ...init, signal })
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort(new DOMException('Request timed out', 'TimeoutError'))
    }, timeoutMs)
    const onOuterAbort = () => controller.abort(outer?.reason)
    if (outer) {
      if (outer.aborted) onOuterAbort()
      else outer.addEventListener('abort', onOuterAbort, { once: true })
    }
    const cleanup = () => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', onOuterAbort)
    }
    return baseFetch(input, { ...init, signal: controller.signal }).finally(cleanup)
  }
}

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: { fetch: createTimeoutFetch() },
  })
}

export type { SupabaseClient }
