import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Card, Lesson, Settings } from '../domain/types'
import { createTimeoutFetch } from '../lib/supabase'
import { defaultSettings } from './defaults'
import {
  LOAD_ERROR_MESSAGE,
  NO_SESSION_MESSAGE,
  PASSWORD_INVALID_MESSAGE,
  PASSWORD_REAUTH_MESSAGE,
  PASSWORD_SAME_MESSAGE,
  PASSWORD_SAVE_ERROR_MESSAGE,
  PASSWORD_SIGN_IN_ERROR_MESSAGE,
  PASSWORD_WEAK_MESSAGE,
  RATE_LIMIT_MESSAGE,
  RepoError,
  TOO_MANY_ATTEMPTS_MESSAGE,
  SCHEMA_OUTDATED_MESSAGE,
  SupabaseAuth,
  SupabaseRepository,
  WRITE_ERROR_MESSAGE,
  isNonRetryableCode,
  isSchemaOutdated,
  isSchemaOutdatedError,
  resetSchemaOutdatedForTest,
  setSchemaOutdatedNotifier,
  stripNewColumns,
  stripUserId,
  studyTimeRpcArgs,
  toCard,
  toIso,
  toLesson,
  toSettings,
  toPasswordSignInError,
  toSetPasswordError,
  toSignInError,
  type LessonRow,
  type SettingsRow,
} from './supabase'

interface Call {
  method: string
  args: unknown[]
}

interface Result {
  data: unknown
  error: { code?: string; message?: string; details?: string } | null
  status?: number
}

type Responder = (table: string, calls: Call[]) => Result

/** Builder giả: ghi lại chuỗi gọi, `await` trả về kết quả từ responder. */
function makeClient(responder: Responder, rpcResult: Result = { data: null, error: null }) {
  const queries: { table: string; calls: Call[] }[] = []
  const methods = ['select', 'order', 'limit', 'range', 'gt', 'gte', 'eq', 'upsert', 'insert', 'delete', 'maybeSingle']
  const from = vi.fn((table: string) => {
    const calls: Call[] = []
    queries.push({ table, calls })
    const builder: Record<string, unknown> = {}
    for (const m of methods) {
      builder[m] = (...args: unknown[]) => {
        calls.push({ method: m, args })
        return builder
      }
    }
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => responder(table, calls))
        .then(resolve, reject)
    return builder
  })
  const rpc = vi.fn(async () => rpcResult)
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: 'lan@vidu.com' } }, error: null })),
    getSession: vi.fn(async (): Promise<{ data: { session: unknown }; error: unknown }> => ({
      data: { session: { user: { id: 'u1', email: 'lan@vidu.com' } } },
      error: null,
    })),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null as unknown })),
    signInWithPassword: vi.fn(async (_c: { email: string; password: string }) => ({ data: {}, error: null as unknown })),
    updateUser: vi.fn(async (_a: { password?: string; data?: object }) => ({ data: {}, error: null as unknown })),
    signOut: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
  const client = { from, rpc, auth } as unknown as SupabaseClient
  return { client, from, rpc, auth, queries }
}

const hasMethod = (calls: Call[], m: string) => calls.some((c) => c.method === m)
const argsOf = (calls: Call[], m: string) => calls.find((c) => c.method === m)?.args

const now = () => new Date('2026-11-09T05:00:00Z')

const lesson: Lesson = {
  id: 'l1',
  user_id: 'local',
  number: 1,
  date: '2026-11-09',
  topic: 'Gọi món',
  notes: '',
  questions: '',
  mistakes: '',
  language: 'en',
  created_at: '2026-11-09T05:00:00.000Z',
  updated_at: '2026-11-09T05:00:00.000Z',
}

describe('SupabaseRepository.loadSnapshot', () => {
  it('truy vấn đủ 5 bảng, study_days lọc 120 ngày, tạo settings mặc định khi null', async () => {
    const created: Settings = {
      user_id: 'u1',
      display_name: 'lan',
      daily_goal_min: 15,
      new_cards_per_day: 15,
      voice_name: null,
      auto_speak: false,
      study_language: 'all',
    }
    const { client, queries } = makeClient((table, calls) => {
      if (table === 'settings' && hasMethod(calls, 'upsert')) {
        return { data: [{ ...created, created_at: 'x', updated_at: 'x' }], error: null }
      }
      if (table === 'settings') return { data: null, error: null }
      return { data: [], error: null }
    })
    const repo = new SupabaseRepository(client, { now })
    const snap = await repo.loadSnapshot()

    const reads = queries.filter((q) => !hasMethod(q.calls, 'upsert')).map((q) => q.table)
    expect(reads.sort()).toEqual(['cards', 'items', 'lessons', 'settings', 'study_days'])

    const sd = queries.find((q) => q.table === 'study_days')!
    expect(argsOf(sd.calls, 'gte')).toEqual(['day', '2026-07-12'])

    const up = queries.find((q) => q.table === 'settings' && hasMethod(q.calls, 'upsert'))!
    const [payload, opts] = argsOf(up.calls, 'upsert') as [Settings, Record<string, unknown>]
    expect(payload).toEqual(created)
    expect(opts).toMatchObject({ onConflict: 'user_id' })
    expect(snap.settings).toEqual(created)
  })

  it('phân trang keyset: Max rows 500 < PAGE_SIZE, 1200 hàng → đủ 1200, không trùng', async () => {
    const ids = Array.from({ length: 1200 }, (_, i) => `c${String(i).padStart(4, '0')}`)
    const cardRow = (id: string) => ({
      id, user_id: 'u1', item_id: 'i', direction: 'en_vi', due: '2026-11-09 05:00:00.123456+00', state: 0,
      reps: 0, lapses: 0, first_reviewed_at: null, suspended: false, fsrs: {},
      created_at: '2026-11-09T05:00:00.654321+00:00', updated_at: '2026-11-09T05:00:00+00:00',
    })
    const { client, queries } = makeClient((table, calls) => {
      if (table === 'settings') return { data: { ...defaultSettings('u1'), created_at: 'x', updated_at: 'x' }, error: null }
      if (table === 'cards') {
        const after = (argsOf(calls, 'gt')?.[1] as string | undefined) ?? ''
        const [limit] = argsOf(calls, 'limit') as [number]
        const page = ids.filter((id) => id > after).slice(0, Math.min(limit, 500))
        return { data: page.map(cardRow), error: null }
      }
      return { data: [], error: null }
    })
    const snap = await new SupabaseRepository(client, { now }).loadSnapshot()
    expect(snap.cards).toHaveLength(1200)
    expect(new Set(snap.cards.map((c) => c.id)).size).toBe(1200)
    // 500 + 500 + 200 + trang rỗng
    expect(queries.filter((q) => q.table === 'cards')).toHaveLength(4)
    expect(snap.cards[0].due).toBe('2026-11-09T05:00:00.123Z')
    expect(snap.cards[0].created_at).toBe('2026-11-09T05:00:00.654Z')
  })

  it('lessons/items/cards order theo id, study_days theo day', async () => {
    const { client, queries } = makeClient((table) =>
      table === 'settings' ? { data: { ...defaultSettings('u1') }, error: null } : { data: [], error: null },
    )
    await new SupabaseRepository(client, { now }).loadSnapshot()
    for (const t of ['lessons', 'items', 'cards']) {
      expect(argsOf(queries.find((q) => q.table === t)!.calls, 'order')).toEqual(['id'])
    }
    expect(argsOf(queries.find((q) => q.table === 'study_days')!.calls, 'order')).toEqual(['day'])
  })

  it('settings null + upsert ignoreDuplicates trả [] → đọc lại settings', async () => {
    let settingsReads = 0
    const fromTrigger = { ...defaultSettings('u1', 'lan@vidu.com'), daily_goal_min: 30 }
    const { client, queries } = makeClient((table, calls) => {
      if (table !== 'settings') return { data: [], error: null }
      if (hasMethod(calls, 'upsert')) return { data: [], error: null }
      settingsReads += 1
      return { data: settingsReads === 1 ? null : fromTrigger, error: null }
    })
    const snap = await new SupabaseRepository(client, { now }).loadSnapshot()
    const up = queries.find((q) => q.table === 'settings' && hasMethod(q.calls, 'upsert'))!
    expect((argsOf(up.calls, 'upsert') as unknown[])[1]).toMatchObject({ ignoreDuplicates: true })
    expect(settingsReads).toBe(2)
    expect(snap.settings).toEqual(fromTrigger)
  })

  it('lỗi PostgREST → RepoError message tiếng Việt, có code và cause', async () => {
    const { client } = makeClient((table) =>
      table === 'items'
        ? { data: null, error: { code: '42501', message: 'permission denied', details: 'secret' }, status: 403 }
        : { data: [], error: null },
    )
    const err = await new SupabaseRepository(client, { now }).loadSnapshot().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RepoError)
    expect((err as RepoError).message).toBe(LOAD_ERROR_MESSAGE)
    expect((err as RepoError).code).toBe('42501')
    expect((err as RepoError).cause).toBeInstanceOf(RepoError)
    expect(JSON.stringify((err as RepoError).cause)).not.toContain('secret')
  })
})

describe('SupabaseRepository ghi', () => {
  it('upsert bỏ user_id và onConflict id', async () => {
    const { client, queries } = makeClient(() => ({ data: null, error: null }))
    const repo = new SupabaseRepository(client, { now })
    await repo.upsertLesson(lesson)
    const q = queries[0]
    expect(q.table).toBe('lessons')
    const [payload, opts] = argsOf(q.calls, 'upsert') as [Record<string, unknown>, Record<string, unknown>]
    expect('user_id' in payload).toBe(false)
    expect(payload.id).toBe('l1')
    expect(opts).toEqual({ onConflict: 'id' })
  })

  it('upsertLessons: một upsert mảng, bỏ user_id, onConflict id; mảng rỗng không gọi mạng', async () => {
    const { client, queries, from } = makeClient(() => ({ data: null, error: null }))
    const repo = new SupabaseRepository(client, { now })
    await repo.upsertLessons([])
    expect(from).not.toHaveBeenCalled()
    await repo.upsertLessons([lesson, { ...lesson, id: 'l2' }])
    expect(queries).toHaveLength(1)
    expect(queries[0].table).toBe('lessons')
    const [payload, opts] = argsOf(queries[0].calls, 'upsert') as [Record<string, unknown>[], Record<string, unknown>]
    expect(payload.map((p) => p.id)).toEqual(['l1', 'l2'])
    expect(payload.every((p) => !('user_id' in p))).toBe(true)
    expect(opts).toEqual({ onConflict: 'id' })
  })

  it('upsertCards bỏ user_id mọi phần tử; mảng rỗng không gọi mạng', async () => {
    const { client, queries, from } = makeClient(() => ({ data: null, error: null }))
    const repo = new SupabaseRepository(client, { now })
    await repo.upsertCards([])
    expect(from).not.toHaveBeenCalled()
    const card = toCard({
      id: 'c1', user_id: 'local', item_id: 'i1', direction: 'listen', due: '2026-11-09T05:00:00Z', state: 0,
      reps: 0, lapses: 0, first_reviewed_at: null, suspended: false, fsrs: { a: 1 },
      created_at: '2026-11-09T05:00:00Z', updated_at: '2026-11-09T05:00:00Z',
    }) as Card
    await repo.upsertCards([card, { ...card, id: 'c2' }])
    const [payload] = argsOf(queries[0].calls, 'upsert') as [Record<string, unknown>[]]
    expect(payload).toHaveLength(2)
    expect(payload.every((p) => !('user_id' in p))).toBe(true)
    expect(payload[0].fsrs).toEqual({ a: 1 })
  })

  it('saveSettings gửi user_id của session, onConflict user_id', async () => {
    const { client, queries, auth } = makeClient(() => ({ data: null, error: null }))
    const repo = new SupabaseRepository(client, { now })
    const s: Settings = { user_id: 'local', display_name: 'Lan', daily_goal_min: 20, new_cards_per_day: 10, voice_name: null, auto_speak: true, study_language: 'all' }
    await repo.saveSettings(s)
    await repo.saveSettings(s)
    expect(auth.getUser).not.toHaveBeenCalled()
    expect(auth.getSession).toHaveBeenCalled()
    const [payload, opts] = argsOf(queries[0].calls, 'upsert') as [Settings, Record<string, unknown>]
    expect(payload.user_id).toBe('u1')
    expect(opts).toEqual({ onConflict: 'user_id' })
  })

  it('saveSettings offline (getSession lỗi mạng) → RepoError network, không phải no_session', async () => {
    const { client, auth, from } = makeClient(() => ({ data: null, error: null }))
    const repo = new SupabaseRepository(client, { now })
    const s = defaultSettings('local')
    auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 },
    })
    let err = (await repo.saveSettings(s).catch((e: unknown) => e)) as RepoError
    expect(err.code).toBe('network')
    expect(err.message).toBe(WRITE_ERROR_MESSAGE)
    auth.getSession.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    err = (await repo.saveSettings(s).catch((e: unknown) => e)) as RepoError
    expect(err.code).toBe('network')
    expect(from).not.toHaveBeenCalled()
  })

  it('saveSettings khi không có phiên → no_session', async () => {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    const err = (await new SupabaseRepository(client, { now }).saveSettings(defaultSettings('local')).catch((e: unknown) => e)) as RepoError
    expect(err.code).toBe('no_session')
    expect(err.message).toBe(NO_SESSION_MESSAGE)
  })

  it('lỗi ghi do fetch hỏng (status 0, không code) → code network', async () => {
    const { client } = makeClient(() => ({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 }))
    const err = (await new SupabaseRepository(client, { now }).upsertLesson(lesson).catch((e: unknown) => e)) as RepoError
    expect(err.code).toBe('network')
    expect(isNonRetryableCode(err.code)).toBe(false)
  })

  it('deleteLesson chỉ xoá bản ghi cha', async () => {
    const { client, queries } = makeClient(() => ({ data: null, error: null }))
    await new SupabaseRepository(client, { now }).deleteLesson('l1')
    expect(queries).toHaveLength(1)
    expect(queries[0].table).toBe('lessons')
    expect(argsOf(queries[0].calls, 'eq')).toEqual(['id', 'l1'])
  })

  it('lỗi ghi PostgREST → RepoError có code, không chứa payload', async () => {
    const { client } = makeClient(() => ({
      data: null,
      error: { code: '23505', message: 'duplicate key', details: 'Key (user_id, number)=(u1, 1) already exists.' },
      status: 409,
    }))
    const err = await new SupabaseRepository(client, { now }).upsertLesson(lesson).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RepoError)
    expect((err as RepoError).code).toBe('23505')
    expect((err as RepoError).status).toBe(409)
    expect((err as RepoError).message).not.toContain('Gọi món')
    expect((err as RepoError).message).not.toContain('Key')
  })

  it('addStudyTime gọi rpc add_study_time với đúng tên tham số và map kết quả', async () => {
    const { client, rpc } = makeClient(() => ({ data: null, error: null }), {
      data: { user_id: 'u1', day: '2026-11-09', seconds: 90, reviews: 3, shadowing_count: 1, updated_at: 'x' },
      error: null,
    })
    const day = await new SupabaseRepository(client, { now }).addStudyTime('2026-11-09', { seconds: 30, reviews: 1 })
    expect(rpc).toHaveBeenCalledWith('add_study_time', { p_day: '2026-11-09', p_seconds: 30, p_reviews: 1, p_shadowing: 0 })
    expect(day).toEqual({ user_id: 'u1', day: '2026-11-09', seconds: 90, reviews: 3, shadowing_count: 1 })
  })
})

describe('hàm thuần', () => {
  it('isNonRetryableCode', () => {
    for (const c of ['23505', '23503', '23514', '22P02', '42501']) expect(isNonRetryableCode(c)).toBe(true)
    for (const c of ['network', 'PGRST301', '08006', '', undefined, null]) expect(isNonRetryableCode(c)).toBe(false)
  })
  it('toIso chuẩn hoá timestamptz Postgres (microsecond, +00, +07:00)', () => {
    expect(toIso('2026-11-09T05:00:00.123456+00:00')).toBe('2026-11-09T05:00:00.123Z')
    expect(toIso('2026-11-09 05:00:00+00')).toBe('2026-11-09T05:00:00.000Z')
    expect(toIso('2026-11-09T12:00:00.5+07:00')).toBe('2026-11-09T05:00:00.500Z')
    expect(toIso('2026-11-09T05:00:00.000Z')).toBe('2026-11-09T05:00:00.000Z')
    expect(toIso('khong-phai-ngay')).toBe('khong-phai-ngay')
  })
  it('defaultSettings: display_name = phần trước @', () => {
    expect(defaultSettings('u1', 'lan@vidu.com').display_name).toBe('lan')
    expect(defaultSettings('local').display_name).toBe('')
    expect(defaultSettings('u1').new_cards_per_day).toBe(15)
  })
  it('stripUserId', () => {
    expect(stripUserId({ id: 'a', user_id: 'local', x: 1 })).toEqual({ id: 'a', x: 1 })
  })
  it('studyTimeRpcArgs mặc định 0', () => {
    expect(studyTimeRpcArgs('2026-11-09', {})).toEqual({ p_day: '2026-11-09', p_seconds: 0, p_reviews: 0, p_shadowing: 0 })
  })
  it('toSignInError nhận rate limit theo status / message', () => {
    expect(toSignInError({ status: 429 }).message).toBe(RATE_LIMIT_MESSAGE)
    expect(toSignInError({ status: 400, message: 'Email rate limit exceeded' }).message).toBe(RATE_LIMIT_MESSAGE)
    expect(toSignInError({ status: 500, message: 'boom' }).message).not.toBe(RATE_LIMIT_MESSAGE)
  })
})

describe('SupabaseAuth', () => {
  it('signInWithEmail truyền redirect + shouldCreateUser; 429 → lỗi rate limit', async () => {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    const a = new SupabaseAuth(client)
    expect(a.mode).toBe('supabase')
    await a.signInWithEmail('lan@vidu.com', 'http://localhost:5173/login')
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'lan@vidu.com',
      options: { emailRedirectTo: 'http://localhost:5173/login', shouldCreateUser: true },
    })
    auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: { status: 429, message: 'too many', code: 'over_email_send_rate_limit' } })
    const err = await a.signInWithEmail('lan@vidu.com', 'x').catch((e: unknown) => e)
    expect((err as RepoError).message).toBe(RATE_LIMIT_MESSAGE)
    expect(await a.getSession()).toEqual({ id: 'u1', email: 'lan@vidu.com', hasPassword: false })
  })
})

describe('(T21) SupabaseAuth — mật khẩu', () => {
  const EMAIL = 'lan@vidu.com'
  const SECRET = 'S3cret!'

  async function failSignIn(error: unknown, reject = false) {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    if (reject) auth.signInWithPassword.mockRejectedValueOnce(error)
    else auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error })
    const err = await new SupabaseAuth(client).signInWithPassword(EMAIL, SECRET).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RepoError)
    const r = err as RepoError
    // không rò lỗi gốc, mật khẩu hay email
    expect(r.cause).toBeUndefined()
    expect(r.message).not.toContain(SECRET)
    expect(r.message).not.toContain(EMAIL)
    return r
  }

  async function failSet(error: unknown, reject = false) {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    if (reject) auth.updateUser.mockRejectedValueOnce(error)
    else auth.updateUser.mockResolvedValueOnce({ data: {}, error })
    const err = await new SupabaseAuth(client).setPassword('S3cret!xyz').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RepoError)
    const r = err as RepoError
    expect(r.cause).toBeUndefined()
    expect(r.message).not.toContain('S3cret!xyz')
    return r
  }

  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('signInWithPassword gọi đúng một lần với email + mật khẩu; thành công thì resolve', async () => {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    await new SupabaseAuth(client).signInWithPassword(EMAIL, 'p')
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: 'p' })
  })

  it('signInWithPassword bỏ qua data.weakPassword (không phải lỗi)', async () => {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { weakPassword: { reasons: ['length'], message: 'weak' } },
      error: null,
    })
    await expect(new SupabaseAuth(client).signInWithPassword(EMAIL, SECRET)).resolves.toBeUndefined()
  })

  it('invalid_credentials (có code hoặc server cũ chỉ có message) → câu chung', async () => {
    for (const error of [
      { status: 400, code: 'invalid_credentials', message: `Invalid login credentials for ${EMAIL}` },
      { status: 400, message: 'Invalid login credentials' },
      { status: 400, code: 'email_not_confirmed' },
      { status: 400, code: 'user_not_found' },
    ]) {
      const r = await failSignIn(error)
      expect(r.message).toBe(PASSWORD_INVALID_MESSAGE)
      expect(r.code).toBe('invalid_credentials')
    }
  })

  it('rate limit → TOO_MANY_ATTEMPTS_MESSAGE', async () => {
    const r = await failSignIn({ status: 429, code: 'over_request_rate_limit' })
    expect(r.message).toBe(TOO_MANY_ATTEMPTS_MESSAGE)
    expect(r.code).toBe('rate_limit')
  })

  it('mạng / timeout → code network', async () => {
    for (const error of [
      { name: 'AuthRetryableFetchError', status: 0 },
      { name: 'TimeoutError', message: 'signal timed out' },
      { name: 'AbortError', message: 'The operation was aborted' },
    ]) {
      const r = await failSignIn(error)
      expect(r.code).toBe('network')
      expect(r.message).toBe(PASSWORD_SIGN_IN_ERROR_MESSAGE)
    }
  })

  it('client ném (reject) → vẫn ra RepoError, không giữ lỗi gốc', async () => {
    const thrown = new TypeError(`Failed to fetch ${SECRET} ${EMAIL}`)
    const r = await failSignIn(thrown, true)
    expect(r.code).toBe('network')
    const odd = await failSignIn('boom', true)
    expect(odd.message).toBe(PASSWORD_SIGN_IN_ERROR_MESSAGE)
    expect(odd.code).toBe('unknown')
  })

  it('lỗi khác → PASSWORD_SIGN_IN_ERROR_MESSAGE giữ code server', async () => {
    const r = await failSignIn({ status: 500, code: 'unexpected_failure', message: SECRET })
    expect(r.message).toBe(PASSWORD_SIGN_IN_ERROR_MESSAGE)
    expect(r.code).toBe('unexpected_failure')
  })

  it('console.warn chỉ nhận code/status', async () => {
    await failSignIn({ status: 400, code: 'invalid_credentials', message: `bad ${SECRET} ${EMAIL}` })
    expect(warnSpy).toHaveBeenCalled()
    const logged = JSON.stringify(warnSpy.mock.calls)
    expect(logged).not.toContain(SECRET)
    expect(logged).not.toContain(EMAIL)
  })

  it('setPassword gửi mật khẩu + cờ has_password trong cùng một updateUser', async () => {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    await new SupabaseAuth(client).setPassword('S3cret!xyz')
    expect(auth.updateUser).toHaveBeenCalledTimes(1)
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'S3cret!xyz', data: { has_password: true } })
    expect(auth.getSession).not.toHaveBeenCalled()
  })

  it('setPassword map lỗi theo bảng 6.15 (3)-C', async () => {
    const cases: [unknown, string, string][] = [
      [{ code: 'weak_password', name: 'AuthWeakPasswordError', status: 422 }, PASSWORD_WEAK_MESSAGE, 'weak_password'],
      [{ name: 'AuthWeakPasswordError' }, PASSWORD_WEAK_MESSAGE, 'weak_password'],
      [{ code: 'same_password', status: 422 }, PASSWORD_SAME_MESSAGE, 'same_password'],
      [{ code: 'reauthentication_needed', status: 400 }, PASSWORD_REAUTH_MESSAGE, 'reauthentication_needed'],
      [{ code: 'reauth_nonce_missing' }, PASSWORD_REAUTH_MESSAGE, 'reauthentication_needed'],
      [{ name: 'AuthSessionMissingError', status: 400 }, NO_SESSION_MESSAGE, 'no_session'],
      [{ code: 'session_not_found', status: 403 }, NO_SESSION_MESSAGE, 'no_session'],
      [{ status: 401 }, NO_SESSION_MESSAGE, 'no_session'],
      [{ status: 429, code: 'over_request_rate_limit' }, TOO_MANY_ATTEMPTS_MESSAGE, 'rate_limit'],
      [{ status: 0 }, PASSWORD_SAVE_ERROR_MESSAGE, 'network'],
      [{ name: 'TimeoutError' }, PASSWORD_SAVE_ERROR_MESSAGE, 'network'],
      [{ status: 500 }, PASSWORD_SAVE_ERROR_MESSAGE, 'unknown'],
    ]
    for (const [error, message, code] of cases) {
      const r = await failSet(error)
      expect(r.message, JSON.stringify(error)).toBe(message)
      expect(r.code, JSON.stringify(error)).toBe(code)
    }
  })

  it('setPassword: client ném → RepoError không cause', async () => {
    const r = await failSet(new TypeError('fetch failed S3cret!xyz'), true)
    expect(r.code).toBe('network')
  })

  it('hàm map thuần không giữ message gốc', () => {
    expect(toPasswordSignInError({ status: 400, code: 'invalid_credentials', message: SECRET }).message).toBe(PASSWORD_INVALID_MESSAGE)
    expect(toSetPasswordError({ code: 'same_password', message: SECRET }).message).toBe(PASSWORD_SAME_MESSAGE)
  })

  it('getSession đọc hasPassword từ user_metadata.has_password (chỉ true đúng kiểu)', async () => {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    const a = new SupabaseAuth(client)
    const withMeta = (user_metadata: unknown) =>
      auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1', email: EMAIL, user_metadata } } }, error: null })
    withMeta({ has_password: true })
    expect(await a.getSession()).toEqual({ id: 'u1', email: EMAIL, hasPassword: true })
    withMeta(undefined)
    expect((await a.getSession())?.hasPassword).toBe(false)
    withMeta({ has_password: 'yes' })
    expect((await a.getSession())?.hasPassword).toBe(false)
  })

  it('onChange (USER_UPDATED) truyền hasPassword mới', () => {
    const { client, auth } = makeClient(() => ({ data: null, error: null }))
    const seen: unknown[] = []
    new SupabaseAuth(client).onChange((u) => seen.push(u))
    const handler = (auth.onAuthStateChange.mock.calls[0] as unknown[])[0] as (e: string, s: unknown) => void
    handler('USER_UPDATED', { user: { id: 'u1', email: EMAIL, user_metadata: { has_password: true } } })
    expect(seen).toEqual([{ id: 'u1', email: EMAIL, hasPassword: true }])
  })
})

describe('createTimeoutFetch', () => {
  it('fallback AbortController khi thiếu AbortSignal.any/timeout: huỷ sau timeout, dọn timer', async () => {
    vi.useFakeTimers()
    const origAny = AbortSignal.any
    const origTimeout = AbortSignal.timeout
    try {
      Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true })
      Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true })
      let seen: AbortSignal | undefined
      const base = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        seen = init?.signal ?? undefined
        return new Promise<Response>((_, reject) => {
          seen?.addEventListener('abort', () => reject(seen?.reason))
        })
      }) as unknown as typeof fetch
      const f = createTimeoutFetch(base, 1000)
      const p = f('https://x.test').catch((e: unknown) => e)
      await vi.advanceTimersByTimeAsync(1000)
      const err = (await p) as DOMException
      expect(err.name).toBe('TimeoutError')
      expect(vi.getTimerCount()).toBe(0)

      const ok = vi.fn(async () => new Response('ok')) as unknown as typeof fetch
      await createTimeoutFetch(ok, 1000)('https://x.test')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      Object.defineProperty(AbortSignal, 'any', { value: origAny, configurable: true })
      Object.defineProperty(AbortSignal, 'timeout', { value: origTimeout, configurable: true })
      vi.useRealTimers()
    }
  })

  it('có AbortSignal.timeout: truyền signal vào fetch', async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return new Response('ok')
    }) as unknown as typeof fetch
    await createTimeoutFetch(base, 1000)('https://x.test', { signal: new AbortController().signal })
    expect(base).toHaveBeenCalledTimes(1)
  })
})

describe('(T20) cột ngôn ngữ', () => {
  beforeEach(() => resetSchemaOutdatedForTest())

  const oldLessonRow = (): LessonRow => {
    const { language: _omit, ...row } = { ...lesson, user_id: 'u1', created_at: '2026-11-09T05:00:00+00:00', updated_at: '2026-11-09T05:00:00+00:00' }
    void _omit
    return row
  }

  it('row thiếu language → en; null → en; zh giữ; mã lạ → en', () => {
    expect(toLesson(oldLessonRow()).language).toBe('en')
    expect(toLesson({ ...oldLessonRow(), language: null }).language).toBe('en')
    expect(toLesson({ ...oldLessonRow(), language: 'zh' }).language).toBe('zh')
    expect(toLesson({ ...oldLessonRow(), language: 'fr' }).language).toBe('en')
  })

  it('settings thiếu study_language → all; hợp lệ giữ; defaultSettings có all', () => {
    const row: SettingsRow = { ...defaultSettings('u1'), created_at: 'x', updated_at: 'x' }
    const { study_language: _omit, ...old } = row
    void _omit
    expect(toSettings(old as SettingsRow).study_language).toBe('all')
    expect(toSettings({ ...row, study_language: 'ja' }).study_language).toBe('ja')
    expect(toSettings({ ...row, study_language: 'xx' }).study_language).toBe('all')
    expect(defaultSettings('u1').study_language).toBe('all')
  })

  it('loadSnapshot từ server chưa migrate → language en, study_language all', async () => {
    const { client } = makeClient((table) => {
      if (table === 'settings') {
        const { study_language: _omit, ...s } = { ...defaultSettings('u1'), created_at: 'x', updated_at: 'x' }
        void _omit
        return { data: s, error: null }
      }
      if (table === 'lessons') return { data: [oldLessonRow()], error: null }
      return { data: [], error: null }
    })
    const snap = await new SupabaseRepository(client, { now }).loadSnapshot()
    expect(snap.lessons[0].language).toBe('en')
    expect(snap.settings.study_language).toBe('all')
  })

  it('isSchemaOutdatedError / stripNewColumns', () => {
    expect(isSchemaOutdatedError({ code: 'PGRST204', message: "Could not find the 'language' column of 'lessons' in the schema cache" })).toBe(true)
    expect(isSchemaOutdatedError({ code: 'PGRST204', message: "Could not find the 'study_language' column of 'settings' in the schema cache" })).toBe(true)
    // PGRST204 vì cột khác / không có message → không phải "server chưa migrate T20".
    expect(isSchemaOutdatedError({ code: 'PGRST204', message: "Could not find the 'topic' column of 'lessons' in the schema cache" })).toBe(false)
    expect(isSchemaOutdatedError({ code: 'PGRST204', message: "Could not find the 'languages' column" })).toBe(false)
    expect(isSchemaOutdatedError({ code: 'PGRST204' })).toBe(false)
    expect(isSchemaOutdatedError({ code: '23505', message: 'language' })).toBe(false)
    expect(isSchemaOutdatedError(null)).toBe(false)
    expect(stripNewColumns({ a: 1, language: 'zh', study_language: 'all' })).toEqual({ a: 1 })
  })

  const PGRST204 = { code: 'PGRST204', message: "Could not find the 'language' column of 'lessons' in the schema cache" }
  /** Server chưa migrate: payload có cột mới → PGRST204; không có → ok. */
  const outdated = (calls: Call[]) => {
    const [payload] = argsOf(calls, 'upsert') as [Record<string, unknown> | Record<string, unknown>[]]
    const rows = Array.isArray(payload) ? payload : [payload]
    return rows.some((r) => 'language' in r || 'study_language' in r)
      ? { data: null, error: PGRST204, status: 400 }
      : { data: null, error: null, status: 201 }
  }

  it('PGRST204 → gửi lại không cột mới; callback 1 lần dù lỗi 3 lần', async () => {
    const notify = vi.fn()
    setSchemaOutdatedNotifier(notify)
    const { client, queries } = makeClient((_t, calls) => outdated(calls))
    const repo = new SupabaseRepository(client, { now })

    await repo.upsertLesson({ ...lesson, language: 'zh' })
    await repo.upsertLessons([{ ...lesson, id: 'l2', language: 'ja' }])
    await repo.saveSettings({ ...defaultSettings('u1'), study_language: 'zh' })

    const upserts = queries.filter((q) => hasMethod(q.calls, 'upsert'))
    expect(upserts.map((q) => q.table)).toEqual(['lessons', 'lessons', 'lessons', 'lessons', 'settings', 'settings'])
    const payloadOf = (i: number) => argsOf(upserts[i].calls, 'upsert')![0]
    expect(payloadOf(0)).toMatchObject({ language: 'zh' })
    expect(payloadOf(1)).not.toHaveProperty('language')
    expect(payloadOf(1)).toMatchObject({ id: 'l1', topic: 'Gọi món' })
    expect((payloadOf(3) as Record<string, unknown>[])[0]).not.toHaveProperty('language')
    expect(payloadOf(5)).not.toHaveProperty('study_language')
    expect(payloadOf(5)).toMatchObject({ user_id: 'u1', daily_goal_min: 15 })

    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(SCHEMA_OUTDATED_MESSAGE)
    expect(isSchemaOutdated()).toBe(true)
  })

  it('lỗi khác PGRST204 không gửi lại, ném RepoError như cũ; server đã migrate gửi 1 lần có cột mới', async () => {
    const notify = vi.fn()
    setSchemaOutdatedNotifier(notify)
    const bad = makeClient(() => ({ data: null, error: { code: '23514' }, status: 400 }))
    await expect(new SupabaseRepository(bad.client, { now }).upsertLesson(lesson)).rejects.toMatchObject({ code: '23514' })
    expect(bad.queries).toHaveLength(1)

    const ok = makeClient(() => ({ data: null, error: null }))
    await new SupabaseRepository(ok.client, { now }).upsertLesson({ ...lesson, language: 'ko' })
    expect(ok.queries).toHaveLength(1)
    expect(argsOf(ok.queries[0].calls, 'upsert')![0]).toMatchObject({ language: 'ko' })
    expect(notify).not.toHaveBeenCalled()
    expect(isSchemaOutdated()).toBe(false)
  })

  it('PGRST204 vì cột khác → không gửi lại, không toast, ném RepoError', async () => {
    const notify = vi.fn()
    setSchemaOutdatedNotifier(notify)
    const other = { code: 'PGRST204', message: "Could not find the 'topic' column of 'lessons' in the schema cache" }
    const { client, queries } = makeClient(() => ({ data: null, error: other, status: 400 }))
    await expect(new SupabaseRepository(client, { now }).upsertLesson(lesson)).rejects.toMatchObject({ code: 'PGRST204' })
    expect(queries).toHaveLength(1)
    expect(notify).not.toHaveBeenCalled()
    expect(isSchemaOutdated()).toBe(false)
  })

  it('PGRST204 cả lần gửi lại → ném lỗi (không nuốt)', async () => {
    const { client, queries } = makeClient(() => ({ data: null, error: PGRST204, status: 400 }))
    await expect(new SupabaseRepository(client, { now }).upsertLesson(lesson)).rejects.toMatchObject({ code: 'PGRST204' })
    expect(queries).toHaveLength(2)
  })

  it('notifier đặt sau khi đã gặp PGRST204 → báo ngay 1 lần', async () => {
    const { client } = makeClient((_t, calls) => outdated(calls))
    await new SupabaseRepository(client, { now }).upsertLesson(lesson)
    const notify = vi.fn()
    setSchemaOutdatedNotifier(notify)
    setSchemaOutdatedNotifier(notify)
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('tạo settings mặc định trên server chưa migrate → gửi lại không study_language', async () => {
    const { client, queries } = makeClient((table, calls) => {
      if (table === 'settings' && hasMethod(calls, 'upsert')) {
        const r = outdated(calls)
        if (r.error) return r
        const [payload] = argsOf(calls, 'upsert') as [Record<string, unknown>]
        return { data: [{ ...payload, created_at: 'x', updated_at: 'x' }], error: null }
      }
      if (table === 'settings') return { data: null, error: null }
      return { data: [], error: null }
    })
    const snap = await new SupabaseRepository(client, { now }).loadSnapshot()
    expect(snap.settings).toEqual(defaultSettings('u1', 'lan@vidu.com'))
    expect(queries.filter((q) => q.table === 'settings' && hasMethod(q.calls, 'upsert'))).toHaveLength(2)
  })
})
