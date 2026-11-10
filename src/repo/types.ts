import type { Card, Item, Lesson, ReviewLogEntry, Settings, Snapshot, StudyDay } from '../domain/types'

export interface AuthUser {
  id: string
  email: string | null
  /** (T21) `user.user_metadata.has_password === true` (app ghi cùng request đặt mật khẩu); local: false. */
  hasPassword: boolean
}

export interface StudyTimeDelta {
  seconds?: number
  reviews?: number
  shadowing?: number
}

export interface Repository {
  /** Tải toàn bộ dữ liệu người dùng (không gồm review_logs; study_days 120 ngày gần nhất). */
  loadSnapshot(): Promise<Snapshot>
  upsertLesson(l: Lesson): Promise<void>
  /** Upsert nhiều buổi một lần (nhập dữ liệu 6.13-B). */
  upsertLessons(lessons: Lesson[]): Promise<void>
  /** Cascade items + cards + logs. */
  deleteLesson(id: string): Promise<void>
  upsertItems(items: Item[]): Promise<void>
  /** Cascade cards + logs. */
  deleteItem(id: string): Promise<void>
  upsertCards(cards: Card[]): Promise<void>
  addReviewLog(log: ReviewLogEntry): Promise<void>
  addStudyTime(day: string, delta: StudyTimeDelta): Promise<StudyDay>
  saveSettings(s: Settings): Promise<void>
  /** = loadSnapshot, dùng cho "Xuất dữ liệu". */
  exportAll(): Promise<Snapshot>
}

export interface AuthService {
  mode: 'local' | 'supabase'
  /** local: luôn trả { id: 'local', email: null, hasPassword: false }. */
  getSession(): Promise<AuthUser | null>
  signInWithEmail(email: string, redirectTo: string): Promise<void>
  /**
   * (T21) Đăng nhập email + mật khẩu. Ném `RepoError` đã map (6.15 (3)-C), `code` ∈
   * `rate_limit` | `invalid_credentials` | `network` | mã Auth khác / `unknown`. Không có `cause`.
   * local: no-op.
   */
  signInWithPassword(email: string, password: string): Promise<void>
  /**
   * (T21) Đặt / đổi mật khẩu cho phiên hiện tại: `updateUser({ password, data: { has_password: true } })`.
   * Ném `RepoError`, `code` ∈ `weak_password` | `same_password` | `reauthentication_needed` | `no_session`
   * | `rate_limit` | `network` | mã Auth khác / `unknown`. Không có `cause`. local: no-op.
   */
  setPassword(password: string): Promise<void>
  signOut(): Promise<void>
  onChange(cb: (user: AuthUser | null) => void): () => void
}

/** Payload của từng op ghi — mỗi biến thể ứng với một method ghi của Repository. */
export type PendingOpPayload =
  | { type: 'upsertLesson'; lesson: Lesson }
  | { type: 'upsertLessons'; lessons: Lesson[] }
  | { type: 'deleteLesson'; lessonId: string }
  | { type: 'upsertItems'; items: Item[] }
  | { type: 'deleteItem'; itemId: string }
  | { type: 'upsertCards'; cards: Card[] }
  | { type: 'addReviewLog'; log: ReviewLogEntry }
  | { type: 'addStudyTime'; day: string; delta: StudyTimeDelta }
  | { type: 'saveSettings'; settings: Settings }

export interface PendingOpMeta {
  /** uuid của op (không phải id bản ghi). */
  id: string
  /** ISO */
  createdAt: string
  attempts: number
}

export type PendingOp = PendingOpPayload & PendingOpMeta

export type PendingOpType = PendingOpPayload['type']
