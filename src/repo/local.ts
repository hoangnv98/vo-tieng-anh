import type { Card, Item, Lesson, ReviewLogEntry, Settings, Snapshot, StudyDay } from '../domain/types'
import { asLanguage, asStudyLanguage } from '../domain/languageCore'
import { addDays, localDay } from '../lib/dates'
import { STUDY_DAYS_WINDOW, defaultSettings } from './defaults'
import type { AuthService, AuthUser, Repository, StudyTimeDelta } from './types'

export { STUDY_DAYS_WINDOW, defaultSettings } from './defaults'

export const LOCAL_USER_ID = 'local'
export const STORAGE_FULL_MESSAGE = 'Bộ nhớ trình duyệt đầy. Hãy xuất dữ liệu rồi xoá bớt.'

export const LOCAL_KEYS = {
  lessons: 'vta:v1:lessons',
  items: 'vta:v1:items',
  cards: 'vta:v1:cards',
  reviewLogs: 'vta:v1:review_logs',
  studyDays: 'vta:v1:study_days',
  settings: 'vta:v1:settings',
} as const

export function isQuotaExceeded(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { name?: unknown; code?: unknown }
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  )
}

export function corruptKey(key: string, at: Date): string {
  return `${key}:corrupt-${at.getTime()}`
}

/** Ngữ cảnh đọc/ghi của một LocalRepository. */
interface StoreCtx {
  storage: Storage
  now: () => Date
  /** Khoá chứa JSON hỏng mà chưa sao lưu được (bộ nhớ đầy) — không được ghi đè. */
  unbacked: Set<string>
}

/** Sao chuỗi hỏng sang `<key>:corrupt-<timestamp>` rồi gỡ khoá chính. Trả `false` nếu không sao được. */
function backupCorrupt(ctx: StoreCtx, key: string, raw: string): boolean {
  try {
    ctx.storage.setItem(corruptKey(key, ctx.now()), raw)
  } catch {
    ctx.unbacked.add(key)
    return false
  }
  try {
    ctx.storage.removeItem(key)
  } catch {
    // khoá chính còn đó nhưng đã có bản sao — ghi đè sau này an toàn
  }
  ctx.unbacked.delete(key)
  return true
}

/**
 * JSON hỏng → sao chuỗi gốc sang `<key>:corrupt-<timestamp>` (rồi gỡ khoá chính để không sao lặp),
 * trả fallback. Sao lưu thất bại → khoá bị đánh dấu `unbacked` và writeJson từ chối ghi đè.
 */
function readJson<T>(ctx: StoreCtx, key: string, fallback: T): T {
  const raw = ctx.storage.getItem(key)
  if (raw == null) {
    ctx.unbacked.delete(key)
    return fallback
  }
  try {
    const v = JSON.parse(raw) as T
    ctx.unbacked.delete(key)
    return v
  } catch {
    backupCorrupt(ctx, key, raw)
    return fallback
  }
}

function writeJson(ctx: StoreCtx, key: string, value: unknown): void {
  if (ctx.unbacked.has(key)) {
    // thử sao lưu lại (có thể người dùng đã giải phóng bộ nhớ); vẫn không được → không ghi đè dữ liệu hỏng
    const raw = ctx.storage.getItem(key)
    if (raw != null && !backupCorrupt(ctx, key, raw)) throw new Error(STORAGE_FULL_MESSAGE)
    ctx.unbacked.delete(key)
  }
  try {
    ctx.storage.setItem(key, JSON.stringify(value))
  } catch (e) {
    if (isQuotaExceeded(e)) throw new Error(STORAGE_FULL_MESSAGE, { cause: e })
    throw e
  }
}

function readArray<T>(ctx: StoreCtx, key: string): T[] {
  const v = readJson<unknown>(ctx, key, [])
  return Array.isArray(v) ? (v as T[]) : []
}

/** Upsert theo id: bản ghi mới thay bản cũ cùng id, giữ thứ tự cũ; id mới nối vào cuối. */
function upsertById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const result = existing.slice()
  const index = new Map(result.map((r, i) => [r.id, i]))
  for (const rec of incoming) {
    const i = index.get(rec.id)
    if (i === undefined) {
      index.set(rec.id, result.length)
      result.push(rec)
    } else {
      result[i] = rec
    }
  }
  return result
}

export interface LocalRepositoryOptions {
  /** Đồng hồ, cho phép test cố định "hôm nay". */
  now?: () => Date
}

export class LocalRepository implements Repository {
  private readonly ctx: StoreCtx
  private readonly now: () => Date

  constructor(storage: Storage = window.localStorage, options: LocalRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date())
    this.ctx = { storage, now: this.now, unbacked: new Set() }
  }

  private lessons(): Lesson[] {
    return readArray<Lesson>(this.ctx, LOCAL_KEYS.lessons)
  }
  private items(): Item[] {
    return readArray<Item>(this.ctx, LOCAL_KEYS.items)
  }
  private cards(): Card[] {
    return readArray<Card>(this.ctx, LOCAL_KEYS.cards)
  }
  private reviewLogs(): ReviewLogEntry[] {
    return readArray<ReviewLogEntry>(this.ctx, LOCAL_KEYS.reviewLogs)
  }
  private studyDays(): StudyDay[] {
    return readArray<StudyDay>(this.ctx, LOCAL_KEYS.studyDays)
  }

  async loadSnapshot(): Promise<Snapshot> {
    const from = addDays(localDay(this.now()), -STUDY_DAYS_WINDOW)
    const stored = readJson<Settings | null>(this.ctx, LOCAL_KEYS.settings, null)
    // (T20) Dữ liệu trước T20 thiếu `study_language`/`language` → 'all'/'en' (khoá vta:v1:* giữ nguyên).
    const settings: Settings =
      stored && typeof stored === 'object'
        ? {
            ...defaultSettings(LOCAL_USER_ID),
            ...stored,
            user_id: LOCAL_USER_ID,
            study_language: asStudyLanguage((stored as Partial<Settings>).study_language),
          }
        : defaultSettings(LOCAL_USER_ID)
    return {
      lessons: this.lessons().map((l) => ({ ...l, language: asLanguage(l.language) })),
      items: this.items(),
      cards: this.cards(),
      studyDays: this.studyDays().filter((d) => d.day >= from),
      settings,
    }
  }

  async upsertLesson(l: Lesson): Promise<void> {
    writeJson(this.ctx, LOCAL_KEYS.lessons, upsertById(this.lessons(), [{ ...l, user_id: LOCAL_USER_ID }]))
  }

  async upsertLessons(lessons: Lesson[]): Promise<void> {
    if (lessons.length === 0) return
    writeJson(
      this.ctx,
      LOCAL_KEYS.lessons,
      upsertById(
        this.lessons(),
        lessons.map((l) => ({ ...l, user_id: LOCAL_USER_ID })),
      ),
    )
  }

  async deleteLesson(id: string): Promise<void> {
    const items = this.items()
    const itemIds = new Set(items.filter((i) => i.lesson_id === id).map((i) => i.id))
    this.removeItemsCascade(itemIds, items)
    writeJson(
      this.ctx,
      LOCAL_KEYS.lessons,
      this.lessons().filter((l) => l.id !== id),
    )
  }

  async upsertItems(items: Item[]): Promise<void> {
    if (items.length === 0) return
    writeJson(
      this.ctx,
      LOCAL_KEYS.items,
      upsertById(
        this.items(),
        items.map((i) => ({ ...i, user_id: LOCAL_USER_ID })),
      ),
    )
  }

  async deleteItem(id: string): Promise<void> {
    this.removeItemsCascade(new Set([id]), this.items())
  }

  /** Xoá theo thứ tự lá → gốc (logs, cards, items) để lỗi giữa chừng không để lại bản ghi mồ côi trỏ lên. */
  private removeItemsCascade(itemIds: Set<string>, items: Item[]): void {
    if (itemIds.size === 0) return
    const cards = this.cards()
    const cardIds = new Set(cards.filter((c) => itemIds.has(c.item_id)).map((c) => c.id))
    if (cardIds.size > 0) {
      writeJson(
        this.ctx,
        LOCAL_KEYS.reviewLogs,
        this.reviewLogs().filter((r) => !cardIds.has(r.card_id)),
      )
      writeJson(
        this.ctx,
        LOCAL_KEYS.cards,
        cards.filter((c) => !cardIds.has(c.id)),
      )
    }
    writeJson(
      this.ctx,
      LOCAL_KEYS.items,
      items.filter((i) => !itemIds.has(i.id)),
    )
  }

  async upsertCards(cards: Card[]): Promise<void> {
    if (cards.length === 0) return
    writeJson(
      this.ctx,
      LOCAL_KEYS.cards,
      upsertById(
        this.cards(),
        cards.map((c) => ({ ...c, user_id: LOCAL_USER_ID })),
      ),
    )
  }

  async addReviewLog(log: ReviewLogEntry): Promise<void> {
    writeJson(this.ctx, LOCAL_KEYS.reviewLogs, upsertById(this.reviewLogs(), [{ ...log, user_id: LOCAL_USER_ID }]))
  }

  async addStudyTime(day: string, delta: StudyTimeDelta): Promise<StudyDay> {
    const days = this.studyDays()
    const i = days.findIndex((d) => d.day === day)
    const prev: StudyDay =
      i >= 0 ? days[i] : { user_id: LOCAL_USER_ID, day, seconds: 0, reviews: 0, shadowing_count: 0 }
    const next: StudyDay = {
      user_id: LOCAL_USER_ID,
      day,
      seconds: prev.seconds + (delta.seconds ?? 0),
      reviews: prev.reviews + (delta.reviews ?? 0),
      shadowing_count: prev.shadowing_count + (delta.shadowing ?? 0),
    }
    if (i >= 0) days[i] = next
    else days.push(next)
    writeJson(this.ctx, LOCAL_KEYS.studyDays, days)
    return next
  }

  async saveSettings(s: Settings): Promise<void> {
    writeJson(this.ctx, LOCAL_KEYS.settings, { ...s, user_id: LOCAL_USER_ID })
  }

  exportAll(): Promise<Snapshot> {
    return this.loadSnapshot()
  }
}

const LOCAL_USER: AuthUser = { id: LOCAL_USER_ID, email: null, hasPassword: false }

export class LocalAuth implements AuthService {
  readonly mode = 'local' as const

  async getSession(): Promise<AuthUser | null> {
    return { ...LOCAL_USER }
  }

  async signInWithEmail(): Promise<void> {}

  /** (T21) Mode local không có mật khẩu — UI không gọi tới. */
  async signInWithPassword(): Promise<void> {}

  async setPassword(): Promise<void> {}

  async signOut(): Promise<void> {}

  onChange(cb: (user: AuthUser | null) => void): () => void {
    cb({ ...LOCAL_USER })
    return () => {}
  }
}
