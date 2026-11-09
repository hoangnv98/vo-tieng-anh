import { endOfLocalDay, localDay } from '../lib/dates'
import type { Card, Direction, Item, Language, Settings } from './types'

export { shouldUnlockSiblings } from '../lib/fsrs'

const SECONDS_PER_CARD = 20
/** Thời gian trả lời tối đa tính cho một lần chấm (4.5, 6.7(5)). */
export const MAX_DURATION_MS = 60_000
const REQUEUE_WINDOW_MS = 15 * 60_000
const MAX_TIMES_SHOWN = 3
const SIBLING_DIRECTIONS = ['vi_en', 'listen'] as const satisfies readonly Direction[]
const DIRECTION_ORDER = { en_vi: 0, vi_en: 1, listen: 2 } as const satisfies Record<Direction, number>
const NEW_PER_DAY_MIN = 5
const NEW_PER_DAY_MAX = 30
const NEW_PER_DAY_DEFAULT = 15

/** `due` dạng ms; chuỗi hỏng → `Infinity` (xếp cuối, xem `isDue`). */
function dueMs(card: Card): number {
  const t = new Date(card.due).getTime()
  return Number.isNaN(t) ? Infinity : t
}

/** `created_at` dạng ms; chuỗi hỏng → 0. */
function createdMs(card: Card): number {
  const t = new Date(card.created_at).getTime()
  return Number.isNaN(t) ? 0 : t
}

function byId(a: Card, b: Card): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Theo `due` tăng dần, hoà thì theo `id`. */
function byDue(a: Card, b: Card): number {
  const da = dueMs(a)
  const db = dueMs(b)
  return da !== db ? (da < db ? -1 : 1) : byId(a, b)
}

/** Thẻ mới: `created_at` → `item.position` → chiều (en_vi < vi_en < listen) → `id`. */
function byNewOrder(itemById: Map<string, Item>): (a: Card, b: Card) => number {
  return (a, b) =>
    createdMs(a) - createdMs(b) ||
    (itemById.get(a.item_id)?.position ?? 0) - (itemById.get(b.item_id)?.position ?? 0) ||
    DIRECTION_ORDER[a.direction] - DIRECTION_ORDER[b.direction] ||
    byId(a, b)
}

function isLearning(card: Card): boolean {
  return card.state === 1 || card.state === 3
}

/**
 * Đến hạn (4.4.3): đã học ít nhất 1 lần và `due` không muộn hơn cuối ngày địa phương hôm nay.
 * `due` hỏng vẫn tính là đến hạn (xếp cuối nhóm) để thẻ không biến mất lặng lẽ.
 */
function isDue(card: Card, endOfToday: number): boolean {
  if (card.state === 0) return false
  const t = dueMs(card)
  return t === Infinity || t <= endOfToday
}

/** Thẻ đang học (state 1/3) trước, rồi thẻ review (state 2); mỗi nhóm theo `due` → `id`. */
function sortDue(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const la = isLearning(a) ? 0 : 1
    const lb = isLearning(b) ? 0 : 1
    return la !== lb ? la - lb : byDue(a, b)
  })
}

/** Hạn mức thẻ mới/ngày: số hữu hạn thì cắt phần thập phân và kẹp 5–30, còn lại 15. */
export function newCardsPerDay(settings: Settings): number {
  const x = settings.new_cards_per_day
  return Number.isFinite(x)
    ? Math.min(NEW_PER_DAY_MAX, Math.max(NEW_PER_DAY_MIN, Math.trunc(x)))
    : NEW_PER_DAY_DEFAULT
}

/**
 * (T20) Lọc theo ngôn ngữ (4.4 bước 1b). Cả ba tuỳ chọn đều tuỳ chọn — thiếu thì hành vi như trước T20.
 * - `language`: chỉ giữ thẻ có `langOf(item) === language`.
 * - `langOf`: ngôn ngữ của item (thường là `itemLanguageResolver(lessons)`); thiếu → mọi item coi là 'en'.
 * - `speakable`: thiết bị có giọng ngôn ngữ L không; thiếu → dùng `ttsSupported` cho mọi ngôn ngữ.
 */
export interface LanguageFilterOptions {
  language?: Language
  langOf?: (item: Item) => Language
  speakable?: (lang: Language) => boolean
}

export interface QueueOptions extends LanguageFilterOptions {
  lessonId?: string
  ttsSupported: boolean
}

const EN_ONLY = (): Language => 'en'

/** Bước 1 + 1b: bỏ suspended, thẻ mồ côi, listen không đọc được, thẻ khác ngôn ngữ lọc. */
function usableCards(
  cards: Card[],
  itemById: Map<string, Item>,
  options: LanguageFilterOptions & { ttsSupported: boolean },
): Card[] {
  const { language, ttsSupported, speakable } = options
  const langOf = options.langOf ?? EN_ONLY
  return cards.filter((c) => {
    if (c.suspended) return false
    const item = itemById.get(c.item_id)
    if (!item) return false
    const needLang = language !== undefined || (speakable !== undefined && c.direction === 'listen')
    const lang = needLang ? langOf(item) : 'en'
    if (language !== undefined && lang !== language) return false
    if (c.direction === 'listen') return speakable ? speakable(lang) : ttsSupported
    return true
  })
}

/** Hàng đợi phiên ôn theo SPEC 4.4. */
export function buildQueue(cards: Card[], items: Item[], settings: Settings, now: Date, options: QueueOptions): Card[] {
  const { lessonId } = options
  const itemById = new Map(items.map((it) => [it.id, it]))
  const newOrder = byNewOrder(itemById)
  const today = localDay(now)
  const endOfToday = endOfLocalDay(today).getTime()

  // Bước 1 + 1b (T20: lọc ngôn ngữ, giọng theo ngôn ngữ).
  let pool = usableCards(cards, itemById, options)

  // Bước 2: chế độ "Ôn buổi này" — gồm cả thẻ chưa đến hạn, không giới hạn thẻ mới.
  if (lessonId !== undefined) {
    pool = pool.filter((c) => itemById.get(c.item_id)?.lesson_id === lessonId)
    const due = sortDue(pool.filter((c) => isDue(c, endOfToday)))
    const fresh = pool.filter((c) => c.state === 0).sort(newOrder)
    const rest = pool.filter((c) => c.state !== 0 && !isDue(c, endOfToday)).sort(byDue)
    return [...due, ...fresh, ...rest]
  }

  // Bước 3.
  const due = sortDue(pool.filter((c) => isDue(c, endOfToday)))

  // Bước 4: hạn mức thẻ mới tính trên mọi thẻ (kể cả đã lọc) có lần ôn đầu trong ngày địa phương hôm nay.
  const introducedToday = cards.filter((c) => {
    if (c.first_reviewed_at == null) return false
    const d = new Date(c.first_reviewed_at)
    return !Number.isNaN(d.getTime()) && localDay(d) === today
  }).length
  const newLeft = Math.max(0, newCardsPerDay(settings) - introducedToday)
  const fresh = pool
    .filter((c) => c.state === 0)
    .sort(newOrder)
    .slice(0, newLeft)

  // Bước 5.
  return [...due, ...fresh]
}

/**
 * Số thẻ `listen` lẽ ra có trong hàng đợi (đến hạn hoặc trong hạn mức thẻ mới) nếu có giọng đọc,
 * trừ đi số thẻ listen thực có; dùng cho dòng "· {k} thẻ nghe tạm ẩn" (6.3). Gộp cả hai lý do ẩn:
 * không có Web Speech, hoặc (T20) thiếu giọng của ngôn ngữ đó.
 * `options` thiếu → `ttsSupported: false` (caller cũ chỉ gọi khi trình duyệt không có TTS) = hành vi trước T20.
 */
export function hiddenListenCount(
  cards: Card[],
  items: Item[],
  settings: Settings,
  now: Date,
  options: Partial<QueueOptions> = {},
): number {
  const listen = (q: Card[]) => q.filter((c) => c.direction === 'listen').length
  const base = { ...options, ttsSupported: options.ttsSupported ?? false }
  const possible = listen(buildQueue(cards, items, settings, now, { ...base, ttsSupported: true, speakable: () => true }))
  const actual = listen(buildQueue(cards, items, settings, now, base))
  return Math.max(0, possible - actual)
}

/** Ước lượng phút cho n thẻ (20 giây/thẻ, làm tròn lên). */
export function estimateMinutes(n: number): number {
  if (n <= 0) return 0
  return Math.ceil((n * SECONDS_PER_CARD) / 60)
}

/**
 * Đẩy thẻ về cuối hàng đợi trong phiên (4.4.6) khi hạn kế tiếp trong vòng 15 phút.
 * `timesShownIncludingCurrent` đếm cả lần vừa chấm; tối đa 3 lần hiện mỗi phiên.
 */
export function shouldRequeue(nextCard: Card, now: Date, timesShownIncludingCurrent: number): boolean {
  return (
    dueMs(nextCard) - now.getTime() <= REQUEUE_WINDOW_MS &&
    timesShownIncludingCurrent < MAX_TIMES_SHOWN
  )
}

/** Các chiều vi_en/listen chưa có thẻ cho item (4.3). */
export function missingSiblingDirections(item_id: string, cards: Card[]): Direction[] {
  const existing = new Set(cards.filter((c) => c.item_id === item_id).map((c) => c.direction))
  return SIBLING_DIRECTIONS.filter((d) => !existing.has(d))
}

/**
 * Chốt danh sách thẻ anh em sẽ mở khoá sau khi đã tạo bản ghi (bước bất đồng bộ):
 * chỉ giữ thẻ đúng `itemId`, chiều vẫn còn thiếu trong `current` (snapshot mới nhất,
 * phòng khi nơi khác đã mở khoá trong lúc chờ) và mỗi chiều tối đa một thẻ.
 */
export function planUnlock(itemId: string, created: Card[], current: Card[]): Card[] {
  const missing = new Set(missingSiblingDirections(itemId, current))
  const taken = new Set<Direction>()
  return created.filter((c) => {
    if (c.item_id !== itemId || !missing.has(c.direction) || taken.has(c.direction)) return false
    taken.add(c.direction)
    return true
  })
}

export interface HardCard {
  card: Card
  item: Item
  label: string
  tone: 'red' | 'mute'
}

function difficultyOf(card: Card): number {
  const d = card.fsrs.difficulty
  return typeof d === 'number' && Number.isFinite(d) ? d : 0
}

function hardLabel(card: Card): Pick<HardCard, 'label' | 'tone'> {
  if (card.lapses > 0) return { label: `quên ${card.lapses} lần`, tone: 'red' }
  if (difficultyOf(card) >= 7) return { label: 'khó', tone: 'mute' }
  return { label: 'đang học', tone: 'mute' }
}

function byHardness(a: Card, b: Card): number {
  return b.lapses - a.lapses || difficultyOf(b) - difficultyOf(a) || byId(a, b)
}

/** Giữ thẻ đầu tiên của mỗi item (danh sách đã sắp). */
function firstPerItem(cards: Card[], skip: Set<string> = new Set()): Card[] {
  const seen = new Set(skip)
  return cards.filter((c) => {
    if (seen.has(c.item_id)) return false
    seen.add(c.item_id)
    return true
  })
}

/**
 * Thẻ khó nhất (4.6), mỗi item tối đa 1 dòng. Trả `[]` khi chưa có thẻ nào đã học (UI ẩn khối, 6.3);
 * có ≥1 thẻ đã học nhưng chưa đủ n thì bù thẻ New nhãn "mới".
 */
export function hardestCards(
  cards: Card[],
  items: Item[],
  n = 3,
  options: LanguageFilterOptions & { ttsSupported: boolean } = { ttsSupported: true },
): HardCard[] {
  const itemById = new Map(items.map((it) => [it.id, it]))
  // (T20) Lọc ngôn ngữ/giọng như 4.4 bước 1b, trước khi xếp hạng.
  const usable = usableCards(cards, itemById, options)

  const studied = firstPerItem(usable.filter((c) => c.state !== 0).sort(byHardness))
    .slice(0, n)
    .map((card) => ({ card, item: itemById.get(card.item_id) as Item, ...hardLabel(card) }))

  if (studied.length === 0 || studied.length >= n) return studied

  const taken = new Set(studied.map((h) => h.card.item_id))
  const fresh = firstPerItem(
    usable.filter((c) => c.state === 0).sort(byNewOrder(itemById)),
    taken,
  )
    .slice(0, n - studied.length)
    .map((card) => ({
      card,
      item: itemById.get(card.item_id) as Item,
      label: 'mới',
      tone: 'mute' as const,
    }))

  return [...studied, ...fresh]
}
