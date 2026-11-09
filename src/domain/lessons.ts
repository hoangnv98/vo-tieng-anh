import { addDays, endOfLocalDay } from '../lib/dates'
import { normalizeAnswer } from '../lib/text'
import { LANGUAGE_LABELS, isLanguage, lessonLanguage, matchesFilter } from './languageCore'
import type { Card, Item, Kind, Language, Lesson, StudyLanguageFilter } from './types'

/** Giới hạn khớp check constraint trong `supabase/schema.sql`. */
export const LIMITS = {
  numberMin: 1,
  numberMax: 999,
  topic: 80,
  notes: 2000,
  questions: 1000,
  mistakes: 500,
  en: 200,
  vi: 200,
  ipa: 120,
  note: 200,
} as const

export type LessonField = 'number' | 'date' | 'topic' | 'questions' | 'mistakes' | 'notes' | 'language'
export type ItemField = 'en' | 'vi' | 'ipa' | 'note'

export interface LessonInput {
  /** Giá trị thô từ ô nhập (chuỗi) hoặc số. */
  number: string | number
  date: string
  topic: string
  questions: string
  mistakes: string
  notes: string
  /** (T20) Ngôn ngữ của buổi. */
  language: Language
}

export interface ItemInput {
  kind: Kind
  en: string
  vi: string
  ipa: string
  note: string
}

export interface LessonValidationContext {
  /** Các buổi hiện có (để kiểm trùng số). */
  lessons: readonly Pick<Lesson, 'id' | 'number'>[]
  /** Id buổi đang sửa (bỏ qua chính nó khi kiểm trùng). */
  selfId?: string | null
  /** Hôm nay 'YYYY-MM-DD' (Asia/Ho_Chi_Minh). */
  today: string
}

/** `max(number) + 1`, 1 nếu chưa có buổi nào. */
export function nextLessonNumber(lessons: readonly Pick<Lesson, 'number'>[]): number {
  let max = 0
  for (const l of lessons) if (Number.isFinite(l.number) && l.number > max) max = l.number
  return max + 1
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function isValidDay(day: string): boolean {
  const m = DAY_RE.exec(day)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

function parseNumber(raw: string | number): number | null {
  const s = String(raw).trim()
  if (!/^\d+$/.test(s)) return null
  return Number(s)
}

const max = (n: number) => `Tối đa ${n} ký tự.`
/** "Tiếng Trung" → "tiếng Trung" (giữa câu). */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** Lỗi theo trường (6.6). Rỗng = hợp lệ. */
export function validateLesson(input: LessonInput, ctx: LessonValidationContext): Partial<Record<LessonField, string>> {
  const errors: Partial<Record<LessonField, string>> = {}

  const n = parseNumber(input.number)
  if (n === null || n < LIMITS.numberMin || n > LIMITS.numberMax) {
    errors.number = 'Số buổi phải từ 1 đến 999.'
  } else if (ctx.lessons.some((l) => l.number === n && l.id !== ctx.selfId)) {
    errors.number = `Đã có buổi số ${n}.`
  }

  const date = input.date.trim()
  if (!date) errors.date = 'Chọn ngày học.'
  else if (!isValidDay(date) || date > addDays(ctx.today, 1)) errors.date = 'Ngày không hợp lệ.'

  const topic = input.topic.trim()
  if (!topic) errors.topic = 'Nhập chủ đề buổi học.'
  else if (topic.length > LIMITS.topic) errors.topic = 'Chủ đề tối đa 80 ký tự.'

  if (input.questions.trim().length > LIMITS.questions) errors.questions = max(LIMITS.questions)
  if (input.mistakes.trim().length > LIMITS.mistakes) errors.mistakes = max(LIMITS.mistakes)
  if (input.notes.trim().length > LIMITS.notes) errors.notes = max(LIMITS.notes)

  // Chỉ xảy ra khi state hỏng: select không cho giá trị ngoài LANGUAGES.
  if (!isLanguage(input.language)) errors.language = 'Chọn ngôn ngữ.'

  return errors
}

/** Hàng trống hoàn toàn: en, vi, ipa, note đều rỗng (sau trim). */
export function isBlankItem(input: Pick<ItemInput, ItemField>): boolean {
  return !input.en.trim() && !input.vi.trim() && !input.ipa.trim() && !input.note.trim()
}

/**
 * Lỗi của một hàng mục. Hàng trống hoàn toàn → không lỗi (bị bỏ qua khi lưu),
 * trừ khi `required` (hàng ứng với item đã lưu: muốn bỏ thì bấm X).
 * `language` (mặc định 'en') quyết định câu lỗi thiếu ô đích: "Nhập tiếng Trung."…
 */
export function validateItem(
  input: ItemInput,
  opts: { required?: boolean; language?: Language } = {},
): Partial<Record<ItemField, string>> {
  const errors: Partial<Record<ItemField, string>> = {}
  if (!opts.required && isBlankItem(input)) return errors

  const en = input.en.trim()
  const vi = input.vi.trim()
  if (!en) errors.en = `Nhập ${lowerFirst(LANGUAGE_LABELS[opts.language ?? 'en'])}.`
  else if (en.length > LIMITS.en) errors.en = max(LIMITS.en)
  if (!vi) errors.vi = 'Nhập nghĩa tiếng Việt.'
  else if (vi.length > LIMITS.vi) errors.vi = max(LIMITS.vi)
  if (input.ipa.trim().length > LIMITS.ipa) errors.ipa = max(LIMITS.ipa)
  if (input.note.trim().length > LIMITS.note) errors.note = max(LIMITS.note)
  return errors
}

/**
 * Cảnh báo trùng `en` (so bằng `normalizeAnswer`) trong cùng buổi.
 * Trả `Map<chỉ số hàng, chỉ số hàng đầu tiên trùng>` (0-based); hàng đầu tiên không bị đánh dấu.
 */
export function duplicateRows(rows: readonly Pick<ItemInput, 'en'>[]): Map<number, number> {
  const first = new Map<string, number>()
  const dupes = new Map<number, number>()
  rows.forEach((r, i) => {
    const key = normalizeAnswer(r.en)
    if (!key) return
    const j = first.get(key)
    if (j === undefined) first.set(key, i)
    else dupes.set(i, j)
  })
  return dupes
}

export type MistakeSegment = { text: string; mark: boolean }

/** Tách `*từ*` thành đoạn được đánh dấu (gạch lượn đỏ). Dấu `*` lẻ giữ nguyên. */
export function parseMarked(text: string): MistakeSegment[] {
  const out: MistakeSegment[] = []
  const re = /\*([^*\n]+)\*/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), mark: false })
    out.push({ text: m[1], mark: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), mark: false })
  return out
}

/** Sắp `date desc, number desc`. */
export function sortLessons<T extends Pick<Lesson, 'date' | 'number'>>(lessons: readonly T[]): T[] {
  return [...lessons].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.number - a.number))
}

export interface LessonCounts {
  items: number
  due: number
}

/**
 * Số mục và số thẻ đến hạn (state ≠ 0, chưa tạm ngưng, `due ≤` cuối ngày hôm nay) theo buổi.
 * `ttsSupported: false` → bỏ thẻ `listen` (khớp hàng đợi 4.4).
 */
export function lessonCounts(
  items: readonly Item[],
  cards: readonly Card[],
  today: string,
  opts: { ttsSupported?: boolean } = {},
): Map<string, LessonCounts> {
  const ttsSupported = opts.ttsSupported ?? true
  const out = new Map<string, LessonCounts>()
  const lessonOfItem = new Map<string, string>()
  for (const i of items) {
    if (!i.lesson_id) continue
    lessonOfItem.set(i.id, i.lesson_id)
    const c = out.get(i.lesson_id) ?? { items: 0, due: 0 }
    c.items += 1
    out.set(i.lesson_id, c)
  }
  const end = endOfLocalDay(today).getTime()
  for (const card of cards) {
    if (card.suspended || card.state === 0) continue
    if (!ttsSupported && card.direction === 'listen') continue
    const lessonId = lessonOfItem.get(card.item_id)
    if (!lessonId) continue
    const t = new Date(card.due).getTime()
    if (Number.isNaN(t) || t > end) continue
    out.get(lessonId)!.due += 1
  }
  return out
}

export type CardStatus = { variant: 'new' | 'learning' | 'forgot' | 'mastered'; lapses: number }

const MASTERED_STABILITY = 21

/** Trạng thái hiển thị của thẻ en_vi trên trang buổi học (6.5). */
export function cardStatus(card: Card): CardStatus {
  if (card.state === 0) return { variant: 'new', lapses: 0 }
  const stability = Number(card.fsrs?.stability)
  if (card.state !== 3 && Number.isFinite(stability) && stability >= MASTERED_STABILITY) {
    return { variant: 'mastered', lapses: card.lapses }
  }
  if (card.lapses > 0) return { variant: 'forgot', lapses: card.lapses }
  return { variant: 'learning', lapses: 0 }
}

/** (T20) Buổi mới nhất (`date desc, number desc`) trong ngôn ngữ lọc. */
export function latestLessonOf(lessons: readonly Lesson[], filter: StudyLanguageFilter): Lesson | undefined {
  return sortLessons(lessons).find((l) => matchesFilter(lessonLanguage(l), filter))
}

/** (T20) Ngôn ngữ mặc định của buổi mới (6.6 (9)): bộ lọc ≠ Tất cả → bộ lọc; ngược lại buổi gần nhất; không có buổi → 'en'. */
export function defaultLessonLanguage(lessons: readonly Lesson[], filter: StudyLanguageFilter): Language {
  if (filter !== 'all') return filter
  const latest = latestLessonOf(lessons, 'all')
  return latest ? lessonLanguage(latest) : 'en'
}
