import { addDays } from '../lib/dates'
import { deserializeCard } from '../lib/fsrs'
import type { PendingOpPayload, StudyTimeDelta } from '../repo/types'
import { LIMITS } from './lessons'
import { GOAL, NAME_MAX, NEW_CARDS, isIntInRange } from './settingsLimits'
import { DIRECTIONS, KINDS, type Card, type Direction, type Item, type Kind, type Lesson, type Settings, type Snapshot } from './types'

/** Nhập dữ liệu JSON (6.13-B): kiểm tra tệp xuất và lập kế hoạch gộp vào snapshot hiện tại. Hàm thuần. */

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024
/** Cửa sổ ngày học được nhập (khớp cửa sổ study_days của snapshot, 2.3). */
export const IMPORT_STUDY_WINDOW = 120

export type ImportFileError = 'not-json' | 'bad-shape' | 'too-large'

export const IMPORT_ERROR_MESSAGES: Record<ImportFileError, string> = {
  'too-large': 'Tệp quá lớn (tối đa 5 MB).',
  'not-json': 'Tệp không phải JSON hợp lệ.',
  'bad-shape': 'Tệp không đúng định dạng của Vở Tiếng Anh. Hãy chọn tệp đã xuất từ mục Cài đặt.',
}

export interface ImportFile {
  lessons: unknown[]
  items: unknown[]
  cards: unknown[]
  studyDays: unknown[]
  settings: unknown
}

type Rec = Record<string, unknown>

function isRecord(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Mức tệp: đủ 5 khoá; 4 khoá đầu là mảng; `settings` là object hoặc null. Khoá lạ bỏ qua. */
export function validateImportFile(json: unknown): { ok: true; file: ImportFile } | { ok: false; error: ImportFileError } {
  if (!isRecord(json)) return { ok: false, error: 'bad-shape' }
  const { lessons, items, cards, studyDays, settings } = json
  if (!Array.isArray(lessons) || !Array.isArray(items) || !Array.isArray(cards) || !Array.isArray(studyDays)) {
    return { ok: false, error: 'bad-shape' }
  }
  if (!('settings' in json) || !(settings === null || isRecord(settings))) return { ok: false, error: 'bad-shape' }
  return { ok: true, file: { lessons, items, cards, studyDays, settings } }
}

export interface ImportCount {
  add: number
  update: number
}

export interface ImportCounts {
  lessons: ImportCount
  items: ImportCount
  /** `add` gồm cả thẻ `en_vi` sẽ sinh cho `itemsNeedingCard`. */
  cards: ImportCount
  /** Số ngày có delta > 0. */
  studyDays: number
  skipped: number
}

export interface ImportPlan {
  /** User hiện tại — mọi bản ghi đã được gán `user_id` này. */
  userId: string
  lessons: Lesson[]
  items: Item[]
  cards: Card[]
  /** Item không có thẻ nào trong (tệp ∪ hiện có) → sinh `en_vi`. */
  itemsNeedingCard: string[]
  /** Chỉ ngày có delta > 0 ở ít nhất một trường. */
  studyDeltas: { day: string; delta: StudyTimeDelta }[]
  /** Đã hợp lệ hoá từng trường + user_id hiện tại; null nếu tệp không có. */
  settings: Settings | null
  counts: ImportCounts
  /** Để `console.warn`, không hiển thị chi tiết. */
  skippedReasons: Record<string, number>
}

/** Kế hoạch không có bản ghi nào để ghi (không tính cài đặt). */
export function isEmptyPlan(plan: ImportPlan): boolean {
  return (
    plan.lessons.length === 0 &&
    plan.items.length === 0 &&
    plan.cards.length === 0 &&
    plan.itemsNeedingCard.length === 0 &&
    plan.studyDeltas.length === 0
  )
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function isValidDay(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const m = DAY_RE.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

/** Cận trên kiểu `integer` của Postgres. */
export const PG_INT_MAX = 2_147_483_647
/** Cận trên mỗi ngày học khi nhập (tránh số vô lý/tràn). */
export const DAY_LIMITS = { seconds: 86_400, reviews: 100_000, shadowing: 100_000 } as const

/** ISO 8601 đầy đủ, bắt buộc có múi giờ (không để trình duyệt hiểu theo giờ máy). */
const ISO_RE = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i

/** Chuỗi ISO hợp lệ → chuẩn hoá `toISOString()`; ngược lại null. */
function normIso(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = ISO_RE.exec(v)
  if (!m || !isValidDay(m[1])) return null
  const t = Date.parse(v)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  const y = d.getUTCFullYear()
  return y >= 1 && y <= 9999 ? d.toISOString() : null
}

/** Postgres text/jsonb không chứa được U+0000 (22P05). */
function hasNul(s: string): boolean {
  return s.includes('\u0000')
}

function isId(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '' && v.length <= 200 && !hasNul(v)
}

function isIntUpTo(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max
}

/** Chuỗi tuỳ chọn: thiếu/null → ''; không phải chuỗi, chứa NUL hoặc quá dài → null (không hợp lệ). */
function optText(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string' || hasNul(v)) return null
  const t = v.trim()
  return t.length <= max ? t : null
}

/** Chuỗi bắt buộc trim 1..max, không chứa NUL; ngược lại null. */
function reqText(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || hasNul(v)) return null
  const t = v.trim()
  return t.length >= 1 && t.length <= max ? t : null
}

function isoOr(v: unknown, fallback: string): string {
  return normIso(v) ?? fallback
}

/** Từng trường không hợp lệ → giữ giá trị hiện tại; không trường nào hợp lệ → null. `user_id` = user hiện tại. */
function planSettings(raw: unknown, current: Settings, userId: string): Settings | null {
  if (!isRecord(raw)) return null
  const name =
    typeof raw.display_name === 'string' && !hasNul(raw.display_name) && raw.display_name.trim().length <= NAME_MAX
      ? raw.display_name.trim()
      : null
  const goal = isIntInRange(raw.daily_goal_min, GOAL) ? raw.daily_goal_min : null
  const newCards = isIntInRange(raw.new_cards_per_day, NEW_CARDS) ? raw.new_cards_per_day : null
  const voiceOk = raw.voice_name === null || (typeof raw.voice_name === 'string' && !hasNul(raw.voice_name) && raw.voice_name.length <= 200)
  const autoSpeak = typeof raw.auto_speak === 'boolean' ? raw.auto_speak : null
  if (name === null && goal === null && newCards === null && !voiceOk && autoSpeak === null) return null
  return {
    user_id: userId,
    display_name: name ?? current.display_name,
    daily_goal_min: goal ?? current.daily_goal_min,
    new_cards_per_day: newCards ?? current.new_cards_per_day,
    voice_name: voiceOk ? (raw.voice_name as string | null) : current.voice_name,
    auto_speak: autoSpeak ?? current.auto_speak,
  }
}

/** FSRS hợp lệ: deserialize được, stability/difficulty hữu hạn, state khớp cột `state`, không có NUL. Trả `dueAt` ISO. */
function checkFsrs(fsrs: Rec, state: number): string | null {
  let dueAt: Date
  try {
    dueAt = deserializeCard(fsrs).dueAt
  } catch {
    return null
  }
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (!finite(fsrs.stability) || !finite(fsrs.difficulty) || fsrs.state !== state) return null
  if (JSON.stringify(fsrs).includes('\\u0000')) return null
  const iso = dueAt.toISOString()
  return normIso(iso)
}

/**
 * Mức bản ghi (6.13 (3)-B): bản ghi không đạt bị bỏ qua và đếm vào `counts.skipped`.
 * Gộp theo id (add nếu id chưa có, update nếu có); không xoá gì. Trùng id trong tệp → giữ bản đầu.
 * `today` = 'YYYY-MM-DD' giờ VN; `now` dùng cho created_at/updated_at thiếu/hỏng.
 */
export function planImport(
  file: ImportFile,
  current: Snapshot,
  userId: string,
  today: string,
  now: Date = new Date(),
): ImportPlan {
  const nowIso = now.toISOString()
  const reasons: Record<string, number> = {}
  const skip = (reason: string) => {
    reasons[reason] = (reasons[reason] ?? 0) + 1
  }
  const counts: ImportCounts = {
    lessons: { add: 0, update: 0 },
    items: { add: 0, update: 0 },
    cards: { add: 0, update: 0 },
    studyDays: 0,
    skipped: 0,
  }

  // ---- lessons
  const curLessonIds = new Set(current.lessons.map((l) => l.id))
  const maxDate = addDays(today, 1)
  const lessons: Lesson[] = []
  const lessonIds = new Set<string>()
  for (const raw of file.lessons) {
    if (!isRecord(raw)) {
      skip('lesson-invalid')
      continue
    }
    const { id, number, date } = raw
    const topic = reqText(raw.topic, LIMITS.topic)
    const notes = optText(raw.notes, LIMITS.notes)
    const questions = optText(raw.questions, LIMITS.questions)
    const mistakes = optText(raw.mistakes, LIMITS.mistakes)
    if (
      !isId(id) ||
      typeof number !== 'number' ||
      !Number.isInteger(number) ||
      number < LIMITS.numberMin ||
      number > LIMITS.numberMax ||
      !isValidDay(date) ||
      date > maxDate ||
      topic === null ||
      notes === null ||
      questions === null ||
      mistakes === null
    ) {
      skip('lesson-invalid')
      continue
    }
    if (lessonIds.has(id)) {
      skip('lesson-duplicate-id')
      continue
    }
    lessonIds.add(id)
    lessons.push({
      id,
      user_id: userId,
      number,
      date,
      topic,
      notes,
      questions,
      mistakes,
      created_at: isoOr(raw.created_at, nowIso),
      updated_at: isoOr(raw.updated_at, nowIso),
    })
    if (curLessonIds.has(id)) counts.lessons.update++
    else counts.lessons.add++
  }

  // ---- items
  const knownLessons = new Set([...curLessonIds, ...lessonIds])
  const curItemIds = new Set(current.items.map((i) => i.id))
  /** pattern_id → id item hiện có. */
  const curPatterns = new Map<string, string>()
  for (const i of current.items) if (i.pattern_id !== null) curPatterns.set(i.pattern_id, i.id)
  const items: Item[] = []
  const itemIds = new Set<string>()
  const filePatterns = new Set<string>()
  file.items.forEach((raw, index) => {
    if (!isRecord(raw)) {
      skip('item-invalid')
      return
    }
    const { id, kind } = raw
    const en = reqText(raw.en, LIMITS.en)
    const vi = reqText(raw.vi, LIMITS.vi)
    const ipa = optText(raw.ipa, LIMITS.ipa)
    const note = optText(raw.note, LIMITS.note)
    const lessonId = raw.lesson_id === undefined ? null : raw.lesson_id
    const patternId = raw.pattern_id === undefined ? null : raw.pattern_id
    const position = raw.position === undefined || raw.position === null ? index : raw.position
    if (
      !isId(id) ||
      !(KINDS as readonly unknown[]).includes(kind) ||
      en === null ||
      vi === null ||
      ipa === null ||
      note === null ||
      !(lessonId === null || isId(lessonId)) ||
      !(patternId === null || isId(patternId)) ||
      !isIntUpTo(position, PG_INT_MAX)
    ) {
      skip('item-invalid')
      return
    }
    if (lessonId !== null && !knownLessons.has(lessonId)) {
      skip('item-unknown-lesson')
      return
    }
    if (itemIds.has(id)) {
      skip('item-duplicate-id')
      return
    }
    if (patternId !== null) {
      const owner = curPatterns.get(patternId)
      if ((owner !== undefined && owner !== id) || filePatterns.has(patternId)) {
        skip('item-duplicate-pattern')
        return
      }
      filePatterns.add(patternId)
    }
    itemIds.add(id)
    items.push({
      id,
      user_id: userId,
      lesson_id: lessonId,
      kind: kind as Kind,
      en,
      vi,
      ipa,
      note,
      pattern_id: patternId,
      position,
      created_at: isoOr(raw.created_at, nowIso),
      updated_at: isoOr(raw.updated_at, nowIso),
    })
    if (curItemIds.has(id)) counts.items.update++
    else counts.items.add++
  })

  // ---- cards
  const knownItems = new Set([...curItemIds, ...itemIds])
  const curCardIds = new Set(current.cards.map((c) => c.id))
  /** `${item_id}|${direction}` → id thẻ hiện có. */
  const curPairs = new Map(current.cards.map((c) => [`${c.item_id}|${c.direction}`, c.id]))
  const cards: Card[] = []
  const cardIds = new Set<string>()
  const filePairs = new Set<string>()
  for (const raw of file.cards) {
    if (!isRecord(raw)) {
      skip('card-invalid')
      continue
    }
    const { id, item_id: itemId, direction, state, reps, lapses } = raw
    const due = normIso(raw.due)
    const suspended = raw.suspended === undefined ? false : raw.suspended
    const firstReviewedRaw = raw.first_reviewed_at === undefined ? null : raw.first_reviewed_at
    const firstReviewed = firstReviewedRaw === null ? null : normIso(firstReviewedRaw)
    if (
      !isId(id) ||
      !isId(itemId) ||
      !(DIRECTIONS as readonly unknown[]).includes(direction) ||
      due === null ||
      !(state === 0 || state === 1 || state === 2 || state === 3) ||
      !isIntUpTo(reps, PG_INT_MAX) ||
      !isIntUpTo(lapses, PG_INT_MAX) ||
      typeof suspended !== 'boolean' ||
      (firstReviewedRaw !== null && firstReviewed === null)
    ) {
      skip('card-invalid')
      continue
    }
    // `due` theo FSRS (nguồn sự thật của lịch); lệch với cột `due` → lấy `fsrs.dueAt`
    const fsrsDue = isRecord(raw.fsrs) ? checkFsrs(raw.fsrs, state) : null
    if (fsrsDue === null || !isRecord(raw.fsrs)) {
      skip('card-bad-fsrs')
      continue
    }
    if (!knownItems.has(itemId)) {
      skip('card-unknown-item')
      continue
    }
    if (cardIds.has(id)) {
      skip('card-duplicate-id')
      continue
    }
    const pair = `${itemId}|${direction as string}`
    const owner = curPairs.get(pair)
    if ((owner !== undefined && owner !== id) || filePairs.has(pair)) {
      skip('card-duplicate-direction')
      continue
    }
    filePairs.add(pair)
    cardIds.add(id)
    cards.push({
      id,
      user_id: userId,
      item_id: itemId,
      direction: direction as Direction,
      due: fsrsDue,
      state,
      reps,
      lapses,
      first_reviewed_at: firstReviewed,
      suspended,
      fsrs: raw.fsrs,
      created_at: isoOr(raw.created_at, nowIso),
      updated_at: isoOr(raw.updated_at, nowIso),
    })
    if (curCardIds.has(id)) counts.cards.update++
    else counts.cards.add++
  }

  const withCard = new Set([...current.cards.map((c) => c.item_id), ...cards.map((c) => c.item_id)])
  const itemsNeedingCard = items.filter((i) => !withCard.has(i.id)).map((i) => i.id)
  counts.cards.add += itemsNeedingCard.length

  // ---- study days
  const from = addDays(today, -IMPORT_STUDY_WINDOW)
  const existing = new Map(current.studyDays.map((d) => [d.day, d]))
  const seenDays = new Set<string>()
  const studyDeltas: { day: string; delta: StudyTimeDelta }[] = []
  for (const raw of file.studyDays) {
    if (!isRecord(raw) || !isValidDay(raw.day)) {
      skip('day-invalid')
      continue
    }
    const day = raw.day
    const field = (v: unknown) => (v === undefined || v === null ? 0 : v)
    const seconds = field(raw.seconds)
    const reviews = field(raw.reviews)
    const shadowing = field(raw.shadowing_count)
    if (
      !isIntUpTo(seconds, DAY_LIMITS.seconds) ||
      !isIntUpTo(reviews, DAY_LIMITS.reviews) ||
      !isIntUpTo(shadowing, DAY_LIMITS.shadowing)
    ) {
      skip('day-invalid')
      continue
    }
    if (day < from || day > today) {
      skip('day-out-of-window')
      continue
    }
    if (seenDays.has(day)) {
      skip('day-duplicate')
      continue
    }
    seenDays.add(day)
    const cur = existing.get(day)
    const delta: StudyTimeDelta = {
      seconds: Math.max(0, seconds - (cur?.seconds ?? 0)),
      reviews: Math.max(0, reviews - (cur?.reviews ?? 0)),
      shadowing: Math.max(0, shadowing - (cur?.shadowing_count ?? 0)),
    }
    if ((delta.seconds ?? 0) > 0 || (delta.reviews ?? 0) > 0 || (delta.shadowing ?? 0) > 0) {
      studyDeltas.push({ day, delta })
    }
  }
  counts.studyDays = studyDeltas.length

  counts.skipped = Object.values(reasons).reduce((a, b) => a + b, 0)

  return {
    userId,
    lessons,
    items,
    cards,
    itemsNeedingCard,
    studyDeltas,
    settings: planSettings(file.settings, current.settings, userId),
    counts,
    skippedReasons: reasons,
  }
}

export const IMPORT_CHUNK = { lessons: 200, items: 200, cards: 100 } as const

function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/**
 * Op ghi của một lần nhập (6.13-B (5).5), theo thứ tự lessons → items → cards → settings → study_days.
 * - Item thường chia chunk 200; item có `pattern_id` mỗi item một op, để lỗi "mẫu đã có trên server"
 *   (23505, 2.4.11) chỉ bỏ đúng item đó.
 * - Thẻ chia theo chunk item: thẻ của item ở op item k nằm trong (các) op thẻ riêng của k (≤ 100 thẻ/op),
 *   nên khi op item k bị bỏ, syncEngine bỏ kèm đúng các op thẻ phụ thuộc. Thẻ của item không nằm trong
 *   kế hoạch (đã có sẵn) đi nhóm riêng ở cuối.
 * `cards` = `plan.cards` + thẻ en_vi sinh cho `itemsNeedingCard`.
 */
export function buildImportOps(plan: ImportPlan, cards: readonly Card[], includeSettings: boolean): PendingOpPayload[] {
  const plain = plan.items.filter((i) => i.pattern_id === null)
  const patterned = plan.items.filter((i) => i.pattern_id !== null)
  const itemGroups = [...chunk(plain, IMPORT_CHUNK.items), ...patterned.map((i) => [i])]

  const groupOf = new Map<string, number>()
  itemGroups.forEach((g, k) => g.forEach((i) => groupOf.set(i.id, k)))
  const cardGroups: Card[][] = itemGroups.map(() => [])
  const others: Card[] = []
  for (const c of cards) {
    const k = groupOf.get(c.item_id)
    if (k === undefined) others.push(c)
    else cardGroups[k].push(c)
  }

  const cardOps = (list: readonly Card[]) =>
    chunk(list, IMPORT_CHUNK.cards).map((c) => ({ type: 'upsertCards' as const, cards: c }))

  return [
    ...chunk(plan.lessons, IMPORT_CHUNK.lessons).map((lessons) => ({ type: 'upsertLessons' as const, lessons })),
    ...itemGroups.map((items) => ({ type: 'upsertItems' as const, items })),
    ...cardGroups.flatMap(cardOps),
    ...cardOps(others),
    ...(includeSettings && plan.settings ? [{ type: 'saveSettings' as const, settings: plan.settings }] : []),
    ...plan.studyDeltas.map((d) => ({ type: 'addStudyTime' as const, day: d.day, delta: d.delta })),
  ]
}
