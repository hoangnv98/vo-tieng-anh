import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import type { Card, Item, Lesson, ReviewLogEntry, Settings, Snapshot, StudyDay } from '../domain/types'
import { asLanguage, asStudyLanguage } from '../domain/languageCore'
import { addDays, localDay } from '../lib/dates'
import { STUDY_DAYS_WINDOW, defaultSettings } from './defaults'
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
  SEND_LINK_ERROR_MESSAGE,
  SIGN_OUT_ERROR_MESSAGE,
  TOO_MANY_ATTEMPTS_MESSAGE,
  WRITE_ERROR_MESSAGE,
  isNetworkError,
  toRepoError,
} from './errors'
import type { PostgrestLikeError } from './errors'
import { markSchemaOutdated } from './schemaStatus'
import type { AuthService, AuthUser, Repository, StudyTimeDelta } from './types'

export {
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
  SEND_LINK_ERROR_MESSAGE,
  SIGN_OUT_ERROR_MESSAGE,
  TOO_MANY_ATTEMPTS_MESSAGE,
  WRITE_ERROR_MESSAGE,
  isNetworkError,
  isNonRetryableCode,
  shouldRefreshBeforeFail,
  toRepoError,
} from './errors'
export type { NetworkLikeError, PostgrestLikeError, RepoErrorOptions } from './errors'
export {
  SCHEMA_OUTDATED_MESSAGE,
  isSchemaOutdated,
  resetSchemaOutdatedForTest,
  setSchemaOutdatedNotifier,
} from './schemaStatus'

/**
 * Kích thước trang khi đọc snapshot. Phân trang keyset nên vẫn đúng nếu Dashboard đặt
 * "Max rows" nhỏ hơn số này (server trả trang ngắn hơn, ta chỉ dừng khi trang rỗng).
 */
export const PAGE_SIZE = 1000

// -----------------------------------------------------------------------------
// Kiểu hàng (snake_case) khớp supabase/schema.sql
// -----------------------------------------------------------------------------
export interface LessonRow {
  id: string
  user_id: string
  number: number
  date: string
  topic: string
  notes: string
  questions: string
  mistakes: string
  /** (T20) Thiếu khi server chưa chạy migration khối 9. */
  language?: string | null
  created_at: string
  updated_at: string
}

export interface ItemRow {
  id: string
  user_id: string
  lesson_id: string | null
  kind: Item['kind']
  en: string
  vi: string
  ipa: string
  note: string
  pattern_id: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface CardRow {
  id: string
  user_id: string
  item_id: string
  direction: Card['direction']
  due: string
  state: number
  reps: number
  lapses: number
  first_reviewed_at: string | null
  suspended: boolean
  fsrs: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ReviewLogRow {
  id: string
  user_id: string
  card_id: string
  rating: number
  reviewed_at: string
  duration_ms: number
  revlog: Record<string, unknown>
  created_at: string
}

export interface StudyDayRow {
  user_id: string
  day: string
  seconds: number
  reviews: number
  shadowing_count: number
  updated_at: string
}

export interface SettingsRow {
  user_id: string
  display_name: string
  daily_goal_min: number
  new_cards_per_day: number
  voice_name: string | null
  auto_speak: boolean
  /** (T20) Thiếu khi server chưa chạy migration khối 9. */
  study_language?: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// Map hàng → domain (hàm thuần)
// -----------------------------------------------------------------------------
const PG_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/i

/**
 * Postgres/PostgREST trả timestamptz dạng `2026-11-09T10:00:00.123456+00:00` (hoặc `… 10:00:00+00`);
 * domain cần ISO `…sssZ` để so sánh chuỗi. Chuẩn hoá (cắt phần lẻ còn mili giây, múi `±HH:MM`) trước khi parse.
 */
export function toIso(value: string): string {
  const m = PG_TIMESTAMP.exec(value)
  let normalized = value
  if (m) {
    const [, date, time, frac, tz] = m
    const ms = frac ? frac.slice(0, 4).padEnd(4, '0') : ''
    let zone = 'Z'
    if (tz && tz.toUpperCase() !== 'Z') {
      const digits = tz.slice(1).replace(':', '')
      zone = `${tz[0]}${digits.slice(0, 2)}:${digits.slice(2) || '00'}`
    }
    normalized = `${date}T${time.length === 5 ? `${time}:00` : time}${ms}${zone}`
  }
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? value : d.toISOString()
}

function toIsoOrNull(value: string | null): string | null {
  return value == null ? null : toIso(value)
}

export function toLesson(r: LessonRow): Lesson {
  return {
    id: r.id,
    user_id: r.user_id,
    number: r.number,
    date: r.date,
    topic: r.topic,
    notes: r.notes ?? '',
    questions: r.questions ?? '',
    mistakes: r.mistakes ?? '',
    language: asLanguage(r.language),
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  }
}

export function toItem(r: ItemRow): Item {
  return {
    id: r.id,
    user_id: r.user_id,
    lesson_id: r.lesson_id ?? null,
    kind: r.kind,
    en: r.en,
    vi: r.vi,
    ipa: r.ipa ?? '',
    note: r.note ?? '',
    pattern_id: r.pattern_id ?? null,
    position: r.position,
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  }
}

export function toCard(r: CardRow): Card {
  return {
    id: r.id,
    user_id: r.user_id,
    item_id: r.item_id,
    direction: r.direction,
    due: toIso(r.due),
    state: r.state as Card['state'],
    reps: r.reps,
    lapses: r.lapses,
    first_reviewed_at: toIsoOrNull(r.first_reviewed_at),
    suspended: r.suspended,
    fsrs: r.fsrs ?? {},
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  }
}

export function toStudyDay(r: StudyDayRow): StudyDay {
  return {
    user_id: r.user_id,
    day: r.day,
    seconds: r.seconds,
    reviews: r.reviews,
    shadowing_count: r.shadowing_count,
  }
}

export function toSettings(r: SettingsRow): Settings {
  return {
    user_id: r.user_id,
    display_name: r.display_name ?? '',
    daily_goal_min: r.daily_goal_min,
    new_cards_per_day: r.new_cards_per_day,
    voice_name: r.voice_name ?? null,
    auto_speak: r.auto_speak,
    study_language: asStudyLanguage(r.study_language),
  }
}

// -----------------------------------------------------------------------------
// Payload domain → hàng
// -----------------------------------------------------------------------------
/**
 * Bỏ `user_id`: DB có `default auth.uid()`, và op trong hàng đợi có thể mang `user_id = 'local'`
 * (bản ghi tạo trước khi có session) — gửi lên sẽ vi phạm RLS `with check`.
 */
export function stripUserId<T extends { user_id: string }>(record: T): Omit<T, 'user_id'> {
  const { user_id: _omit, ...rest } = record
  void _omit
  return rest
}

export function studyTimeRpcArgs(day: string, delta: StudyTimeDelta) {
  return {
    p_day: day,
    p_seconds: delta.seconds ?? 0,
    p_reviews: delta.reviews ?? 0,
    p_shadowing: delta.shadowing ?? 0,
  }
}

// -----------------------------------------------------------------------------
// (T20) Server chưa chạy migration khối 9 (SPEC 3.2)
// -----------------------------------------------------------------------------
/** Cột thêm ở T20; server cũ không có → PostgREST trả PGRST204. */
const NEW_COLUMNS = ['language', 'study_language'] as const

const NEW_COLUMN_RE = /\b(?:study_)?language\b/

/**
 * PostgREST không tìm thấy **cột mới T20** trong schema cache ("Could not find the 'language' column…").
 * PGRST204 vì cột khác (lỗi thật, không phải server chưa migrate) → false, để lỗi đi đường thường.
 */
export function isSchemaOutdatedError(e: PostgrestLikeError | null | undefined): boolean {
  if (e?.code !== 'PGRST204') return false
  return typeof e.message === 'string' && NEW_COLUMN_RE.test(e.message)
}

/** Bỏ `language`/`study_language` khỏi payload để gửi lại lên server chưa migrate. */
export function stripNewColumns<T extends object>(payload: T): Omit<T, (typeof NEW_COLUMNS)[number]> {
  const rest = { ...payload } as Record<string, unknown>
  for (const c of NEW_COLUMNS) delete rest[c]
  return rest as Omit<T, (typeof NEW_COLUMNS)[number]>
}

/** (T21) `hasPassword` chỉ true khi `user_metadata.has_password === true` (đúng kiểu boolean). */
function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null
  const meta = user.user_metadata as Record<string, unknown> | null | undefined
  return { id: user.id, email: user.email ?? null, hasPassword: meta?.has_password === true }
}

// -----------------------------------------------------------------------------
// Repository
// -----------------------------------------------------------------------------
interface QueryResult {
  data: unknown
  error: PostgrestLikeError | null
  status?: number
}

export interface SupabaseRepositoryOptions {
  /** Đồng hồ, cho phép test cố định "hôm nay". */
  now?: () => Date
}

export class SupabaseRepository implements Repository {
  private readonly client: SupabaseClient
  private readonly now: () => Date

  constructor(client: SupabaseClient, options: SupabaseRepositoryOptions = {}) {
    this.client = client
    this.now = options.now ?? (() => new Date())
  }

  /**
   * User hiện tại từ `auth.getSession()` (đọc storage cục bộ; chỉ đi mạng khi phải refresh token hết hạn).
   * Không cache nên luôn phản ánh phiên hiện tại — không cần lắng nghe onAuthStateChange.
   * Lỗi mạng → `code: 'network'` (thử lại được); chỉ khi thật sự không có phiên → `code: 'no_session'`.
   */
  private async currentUser(): Promise<AuthUser> {
    let res: Awaited<ReturnType<SupabaseClient['auth']['getSession']>>
    try {
      res = await this.client.auth.getSession()
    } catch (e) {
      if (isNetworkError(e)) throw new RepoError(WRITE_ERROR_MESSAGE, { code: 'network', cause: e })
      throw new RepoError(NO_SESSION_MESSAGE, { code: 'no_session', cause: e })
    }
    const { data, error } = res
    if (error) {
      if (isNetworkError(error)) throw new RepoError(WRITE_ERROR_MESSAGE, { code: 'network', status: error.status })
      throw new RepoError(NO_SESSION_MESSAGE, { code: 'no_session', status: error.status })
    }
    const user = toAuthUser(data.session?.user)
    if (!user) throw new RepoError(NO_SESSION_MESSAGE, { code: 'no_session' })
    return user
  }

  /**
   * Lấy toàn bộ hàng bằng phân trang keyset (`order(key).gt(key, last).limit(PAGE_SIZE)`).
   * Chỉ dừng khi trang rỗng — không dựa vào "trang ngắn" vì Max rows của project có thể < PAGE_SIZE.
   */
  private async selectAll<T>(key: keyof T & string, build: (after: string | null) => PromiseLike<QueryResult>): Promise<T[]> {
    const rows: T[] = []
    let after: string | null = null
    for (;;) {
      const res = await build(after)
      if (res.error) throw toRepoError(res.error, LOAD_ERROR_MESSAGE, res.status)
      const page = (res.data ?? []) as T[]
      if (page.length === 0) return rows
      rows.push(...page)
      const next = String(page[page.length - 1][key])
      if (next === after) return rows // phòng vệ: server bỏ qua filter → không lặp vô hạn
      after = next
    }
  }

  /** Một trang keyset; `since` chỉ dùng cho study_days (`day >= since`). */
  private page(table: string, key: string, after: string | null, since?: string): PromiseLike<QueryResult> {
    let q = this.client.from(table).select('*')
    if (since !== undefined) q = q.gte(key, since)
    if (after !== null) q = q.gt(key, after)
    return q.order(key).limit(PAGE_SIZE)
  }

  private async write(run: () => PromiseLike<QueryResult>): Promise<void> {
    const res = await run()
    if (res.error) throw toRepoError(res.error, WRITE_ERROR_MESSAGE, res.status)
  }

  /**
   * Ghi có cột mới T20. Server chưa migrate (PGRST204) → gửi lại **một lần** không có cột mới,
   * đặt cờ `schemaOutdated` và báo toast 1 lần/phiên. PGRST204 không ném ra (không vào dead-letter).
   * Luôn thử bản đủ cột trước, để chủ project chạy migration giữa phiên thì lần ghi sau đã lưu được ngôn ngữ.
   */
  private async writeWithNewColumns(
    run: (stripped: boolean) => PromiseLike<QueryResult>,
    message: string = WRITE_ERROR_MESSAGE,
  ): Promise<QueryResult> {
    const res = await run(false)
    if (!isSchemaOutdatedError(res.error)) {
      if (res.error) throw toRepoError(res.error, message, res.status)
      return res
    }
    markSchemaOutdated()
    const retry = await run(true)
    if (retry.error) throw toRepoError(retry.error, message, retry.status)
    return retry
  }

  async loadSnapshot(): Promise<Snapshot> {
    try {
      const sinceDay = addDays(localDay(this.now()), -STUDY_DAYS_WINDOW)
      const [lessons, items, cards, studyDays, settingsRes] = await Promise.all([
        this.selectAll<LessonRow>('id', (after) => this.page('lessons', 'id', after)),
        this.selectAll<ItemRow>('id', (after) => this.page('items', 'id', after)),
        this.selectAll<CardRow>('id', (after) => this.page('cards', 'id', after)),
        this.selectAll<StudyDayRow>('day', (after) => this.page('study_days', 'day', after, sinceDay)),
        this.client.from('settings').select('*').maybeSingle(),
      ])
      if (settingsRes.error) throw toRepoError(settingsRes.error, LOAD_ERROR_MESSAGE, settingsRes.status)
      const settingsRow = settingsRes.data as SettingsRow | null
      const settings = settingsRow ? toSettings(settingsRow) : await this.createDefaultSettings()
      return {
        lessons: lessons.map(toLesson),
        items: items.map(toItem),
        cards: cards.map(toCard),
        studyDays: studyDays.map(toStudyDay),
        settings,
      }
    } catch (e) {
      const code = e instanceof RepoError ? e.code : undefined
      const status = e instanceof RepoError ? e.status : undefined
      throw new RepoError(LOAD_ERROR_MESSAGE, { code, status, cause: e })
    }
  }

  /** Trigger handle_new_user chưa chạy → tạo hàng mặc định (không ghi đè nếu trigger vừa chạy xong). */
  private async createDefaultSettings(): Promise<Settings> {
    const user = await this.currentUser()
    const defaults = defaultSettings(user.id, user.email)
    const ins = await this.writeWithNewColumns(
      (stripped) =>
        this.client
          .from('settings')
          .upsert(stripped ? stripNewColumns(defaults) : defaults, { onConflict: 'user_id', ignoreDuplicates: true })
          .select('*'),
      LOAD_ERROR_MESSAGE,
    )
    const inserted = (ins.data as SettingsRow[] | null)?.[0]
    if (inserted) return toSettings(inserted)
    // Trùng (trigger đã tạo) → đọc lại.
    const again = await this.client.from('settings').select('*').maybeSingle()
    if (again.error) throw toRepoError(again.error, LOAD_ERROR_MESSAGE, again.status)
    const row = again.data as SettingsRow | null
    return row ? toSettings(row) : defaults
  }

  async upsertLesson(l: Lesson): Promise<void> {
    const row = stripUserId(l)
    await this.writeWithNewColumns((stripped) =>
      this.client.from('lessons').upsert(stripped ? stripNewColumns(row) : row, { onConflict: 'id' }),
    )
  }

  async upsertLessons(lessons: Lesson[]): Promise<void> {
    if (lessons.length === 0) return
    const rows = lessons.map(stripUserId)
    await this.writeWithNewColumns((stripped) =>
      this.client.from('lessons').upsert(stripped ? rows.map(stripNewColumns) : rows, { onConflict: 'id' }),
    )
  }

  deleteLesson(id: string): Promise<void> {
    // FK on delete cascade: items.lesson_id → cards.item_id → review_logs.card_id
    return this.write(() => this.client.from('lessons').delete().eq('id', id))
  }

  async upsertItems(items: Item[]): Promise<void> {
    if (items.length === 0) return
    return this.write(() => this.client.from('items').upsert(items.map(stripUserId), { onConflict: 'id' }))
  }

  deleteItem(id: string): Promise<void> {
    // FK on delete cascade: cards.item_id → review_logs.card_id
    return this.write(() => this.client.from('items').delete().eq('id', id))
  }

  async upsertCards(cards: Card[]): Promise<void> {
    if (cards.length === 0) return
    return this.write(() => this.client.from('cards').upsert(cards.map(stripUserId), { onConflict: 'id' }))
  }

  addReviewLog(log: ReviewLogEntry): Promise<void> {
    return this.write(() => this.client.from('review_logs').upsert(stripUserId(log), { onConflict: 'id' }))
  }

  async addStudyTime(day: string, delta: StudyTimeDelta): Promise<StudyDay> {
    const res = (await this.client.rpc('add_study_time', studyTimeRpcArgs(day, delta))) as QueryResult
    if (res.error) throw toRepoError(res.error, WRITE_ERROR_MESSAGE, res.status)
    const row = (Array.isArray(res.data) ? res.data[0] : res.data) as StudyDayRow | null | undefined
    if (!row) throw new RepoError(WRITE_ERROR_MESSAGE, { code: 'empty_result', status: res.status })
    return toStudyDay(row)
  }

  async saveSettings(s: Settings): Promise<void> {
    const user = await this.currentUser()
    const row = { ...s, user_id: user.id }
    await this.writeWithNewColumns((stripped) =>
      this.client.from('settings').upsert(stripped ? stripNewColumns(row) : row, { onConflict: 'user_id' }),
    )
  }

  exportAll(): Promise<Snapshot> {
    return this.loadSnapshot()
  }
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------
interface AuthLikeError {
  name?: string
  message?: string
  status?: number
  code?: string
}

export function isRateLimitError(e: AuthLikeError): boolean {
  return (
    e.status === 429 ||
    e.code === 'over_email_send_rate_limit' ||
    e.code === 'over_request_rate_limit' ||
    /rate limit/i.test(e.message ?? '')
  )
}

/** Đổi lỗi Auth thành RepoError với microcopy 6.1. Không giữ email trong lỗi. */
export function toSignInError(e: AuthLikeError): RepoError {
  if (isRateLimitError(e)) return new RepoError(RATE_LIMIT_MESSAGE, { code: 'rate_limit', status: e.status })
  return new RepoError(SEND_LINK_ERROR_MESSAGE, { code: e.code ?? 'network', status: e.status })
}

const INVALID_CREDENTIAL_CODES: ReadonlySet<string> = new Set(['invalid_credentials', 'email_not_confirmed', 'user_not_found'])
const REAUTH_CODES: ReadonlySet<string> = new Set(['reauthentication_needed', 'reauth_nonce_missing', 'reauthentication_not_valid'])
const NO_SESSION_CODES: ReadonlySet<string> = new Set(['session_not_found', 'session_expired', 'bad_jwt'])

/** Chỉ ghi `code`/`status` — không bao giờ ghi message gốc, email hay mật khẩu. */
function warnAuth(where: string, e: AuthLikeError): void {
  console.warn(`[auth] ${where}`, { code: e.code, status: e.status })
}

/**
 * (T21) Lỗi đăng nhập mật khẩu → RepoError (6.15 (3)-C). Sai thông tin / chưa xác thực / không có user
 * gộp chung một câu để không lộ email có tồn tại. Không có `cause`, không giữ message gốc.
 */
export function toPasswordSignInError(e: AuthLikeError): RepoError {
  const status = e.status
  if (isRateLimitError(e)) return new RepoError(TOO_MANY_ATTEMPTS_MESSAGE, { code: 'rate_limit', status })
  if ((e.code && INVALID_CREDENTIAL_CODES.has(e.code)) || (status === 400 && /invalid login credentials/i.test(e.message ?? ''))) {
    return new RepoError(PASSWORD_INVALID_MESSAGE, { code: 'invalid_credentials', status })
  }
  if (isNetworkError(e)) return new RepoError(PASSWORD_SIGN_IN_ERROR_MESSAGE, { code: 'network', status })
  return new RepoError(PASSWORD_SIGN_IN_ERROR_MESSAGE, { code: e.code ?? 'unknown', status })
}

/** (T21) Lỗi đặt / đổi mật khẩu → RepoError (6.15 (3)-C). Không có `cause`, không giữ message gốc. */
export function toSetPasswordError(e: AuthLikeError): RepoError {
  const status = e.status
  if (e.code === 'weak_password' || e.name === 'AuthWeakPasswordError') {
    return new RepoError(PASSWORD_WEAK_MESSAGE, { code: 'weak_password', status })
  }
  if (e.code === 'same_password') return new RepoError(PASSWORD_SAME_MESSAGE, { code: 'same_password', status })
  if (e.code && REAUTH_CODES.has(e.code)) {
    return new RepoError(PASSWORD_REAUTH_MESSAGE, { code: 'reauthentication_needed', status })
  }
  if (e.name === 'AuthSessionMissingError' || (e.code && NO_SESSION_CODES.has(e.code)) || status === 401) {
    return new RepoError(NO_SESSION_MESSAGE, { code: 'no_session', status })
  }
  if (isRateLimitError(e)) return new RepoError(TOO_MANY_ATTEMPTS_MESSAGE, { code: 'rate_limit', status })
  if (isNetworkError(e)) return new RepoError(PASSWORD_SAVE_ERROR_MESSAGE, { code: 'network', status })
  return new RepoError(PASSWORD_SAVE_ERROR_MESSAGE, { code: e.code ?? 'unknown', status })
}

/** Lỗi bị ném (không phải `res.error`) → chỉ giữ name/code/status/message để map, bỏ mọi thứ khác. */
function asAuthLikeError(e: unknown): AuthLikeError {
  if (typeof e !== 'object' || e === null) return {}
  const x = e as AuthLikeError
  return { name: x.name, code: x.code, status: x.status, message: x.message }
}

export class SupabaseAuth implements AuthService {
  readonly mode = 'supabase' as const
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async getSession(): Promise<AuthUser | null> {
    const { data, error } = await this.client.auth.getSession()
    if (error) return null
    return toAuthUser(data.session?.user)
  }

  async signInWithEmail(email: string, redirectTo: string): Promise<void> {
    let error: AuthLikeError | null
    try {
      const res = await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      })
      error = res.error
    } catch (e) {
      error = (typeof e === 'object' && e !== null ? e : {}) as AuthLikeError
    }
    if (error) throw toSignInError(error)
  }

  /** (T21) `data.weakPassword` (mật khẩu cũ không còn đạt chính sách) bị bỏ qua — không phải lỗi (12.1.42). */
  async signInWithPassword(email: string, password: string): Promise<void> {
    let error: AuthLikeError | null
    try {
      const res = await this.client.auth.signInWithPassword({ email, password })
      error = res.error
    } catch (e) {
      error = asAuthLikeError(e)
    }
    if (!error) return
    const err = toPasswordSignInError(error)
    warnAuth('signInWithPassword', error)
    throw err
  }

  /** (T21) Mật khẩu và cờ `has_password` đi cùng một `PUT /user` → có mật khẩu thì có cờ. */
  async setPassword(password: string): Promise<void> {
    let error: AuthLikeError | null
    try {
      const res = await this.client.auth.updateUser({ password, data: { has_password: true } })
      error = res.error
    } catch (e) {
      error = asAuthLikeError(e)
    }
    if (!error) return
    const err = toSetPasswordError(error)
    warnAuth('setPassword', error)
    throw err
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut()
    if (error) throw new RepoError(SIGN_OUT_ERROR_MESSAGE, { code: error.code, status: error.status })
  }

  /** Callback chạy đồng bộ trong onAuthStateChange — không gọi supabase trực tiếp bên trong (supabase-js có thể deadlock). */
  onChange(cb: (user: AuthUser | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session: Session | null) => {
      cb(toAuthUser(session?.user))
    })
    return () => data.subscription.unsubscribe()
  }
}
