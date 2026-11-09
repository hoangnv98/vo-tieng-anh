import { describe, expect, it } from 'vitest'
import { RepoError, isNetworkError, isNonRetryableCode, shouldRefreshBeforeFail } from './errors'
import * as fromIndex from './index'
import * as fromSupabase from './supabase'

describe('errors', () => {
  it('shouldRefreshBeforeFail chỉ true với 42501', () => {
    expect(shouldRefreshBeforeFail('42501')).toBe(true)
    for (const c of ['23505', 'network', 'PGRST301', '', undefined, null]) expect(shouldRefreshBeforeFail(c)).toBe(false)
  })

  it('isNonRetryableCode gồm lỗi dữ liệu hỏng (22007, 22008, 22003, 22P05); lỗi mạng/5xx thì không', () => {
    for (const c of ['23505', '23503', '23514', '22P02', '22007', '22008', '22003', '22P05', '42501']) expect(isNonRetryableCode(c)).toBe(true)
    for (const c of ['network', 'PGRST301', '57014', '', undefined, null]) expect(isNonRetryableCode(c)).toBe(false)
  })

  it('isNetworkError', () => {
    expect(isNetworkError({ status: 0 })).toBe(true)
    expect(isNetworkError({ name: 'AbortError' })).toBe(true)
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true)
    expect(isNetworkError({ status: 403, message: 'permission denied' })).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })

  it('re-export giữ cùng định danh qua supabase.ts và index.ts', () => {
    expect(fromSupabase.RepoError).toBe(RepoError)
    expect(fromIndex.RepoError).toBe(RepoError)
    expect(fromSupabase.isNonRetryableCode).toBe(isNonRetryableCode)
    expect(fromIndex.isNonRetryableCode).toBe(isNonRetryableCode)
    expect(fromIndex.shouldRefreshBeforeFail).toBe(shouldRefreshBeforeFail)
  })
})

describe('createRepository', () => {
  it('mode local trả LocalRepository/LocalAuth (async)', async () => {
    const storage = new Map<string, string>()
    ;(globalThis as { window?: unknown }).window ??= {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
        removeItem: (k: string) => void storage.delete(k),
      },
    }
    const { repo, auth } = await fromIndex.createRepository({ mode: 'local' })
    expect(auth.mode).toBe('local')
    expect(typeof repo.loadSnapshot).toBe('function')
  })

  it('mode supabase nạp động SupabaseRepository/SupabaseAuth', async () => {
    const { repo, auth } = await fromIndex.createRepository({
      mode: 'supabase',
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    })
    expect(auth.mode).toBe('supabase')
    expect(repo).toBeInstanceOf(fromSupabase.SupabaseRepository)
  })
})
