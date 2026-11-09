import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import type { Card, Item, Lesson, ReviewLogEntry, Settings, Snapshot, StudyDay } from '../domain/types'
import { addDays, localDay } from '../lib/dates'
import { STUDY_DAYS_WINDOW, defaultSettings } from './defaults'
import {
  LOAD_ERROR_MESSAGE,
  NO_SESSION_MESSAGE,
  RATE_LIMIT_MESSAGE,
  RepoError,
  SEND_LINK_ERROR_MESSAGE,
  SIGN_OUT_ERROR_MESSAGE,
  WRITE_ERROR_MESSAGE,
  isNetworkError,
  toRepoError,
} from './errors'
import type { PostgrestLikeError } from './errors'
import type { AuthService, AuthUser, Repository, StudyTimeDelta } from './types'

export {
  LOAD_ERROR_MESSAGE,
  NO_SESSION_MESSAGE,
  RATE_LIMIT_MESSAGE,
  RepoError,
  SEND_LINK_ERROR_MESSAGE,
  SIGN_OUT_ERROR_MESSAGE,
  WRITE_ERROR_MESSAGE,
  isNetworkError,
  isNonRetryableCode,
  shouldRefreshBeforeFail,
  toRepoError,
} from './errors'
export type { NetworkLikeError, PostgrestLikeError, RepoErrorOptions } from './errors'

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

function toAuthUser(user: User | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? null } : null
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
    const ins = await this.client
      .from('settings')
      .upsert(defaults, { onConflict: 'user_id', ignoreDuplicates: true })
      .select('*')
    if (ins.error) throw toRepoError(ins.error, LOAD_ERROR_MESSAGE, ins.status)
    const inserted = (ins.data as SettingsRow[] | null)?.[0]
    if (inserted) return toSettings(inserted)
    // Trùng (trigger đã tạo) → đọc lại.
    const again = await this.client.from('settings').select('*').maybeSingle()
    if (again.error) throw toRepoError(again.error, LOAD_ERROR_MESSAGE, again.status)
    const row = again.data as SettingsRow | null
    return row ? toSettings(row) : defaults
  }

  upsertLesson(l: Lesson): Promise<void> {
    return this.write(() => this.client.from('lessons').upsert(stripUserId(l), { onConflict: 'id' }))
  }

  async upsertLessons(lessons: Lesson[]): Promise<void> {
    if (lessons.length === 0) return
    return this.write(() => this.client.from('lessons').upsert(lessons.map(stripUserId), { onConflict: 'id' }))
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
    return this.write(() =>
      this.client.from('settings').upsert({ ...s, user_id: user.id }, { onConflict: 'user_id' }),
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
