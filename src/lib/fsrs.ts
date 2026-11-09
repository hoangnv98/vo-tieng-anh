import { DefaultScheduler } from 'ts-fsrs'
import type { Card, Direction, Grade, ReviewLogEntry } from '../domain/types'
import { formatRelative, localDay } from './dates'
import { newId } from './ids'

/**
 * Ghim generic 'FSRS-7' (mặc định của DefaultScheduler): `ReturnType<typeof DefaultScheduler>`
 * không ghim sẽ suy ra union mọi phiên bản model và card FSRS-6/7 không gán được cho nhau.
 */
export type Scheduler = Awaited<ReturnType<typeof DefaultScheduler<'FSRS-7'>>>
/** Card object của ts-fsrs (FSRS-7) với `dueAt`/`lastReviewAt` là Date. */
export type FsrsCard = ReturnType<Scheduler['newCard']>
type FsrsCardInput = Parameters<Scheduler['review']>[0]['card']

let schedulerPromise: Promise<Scheduler> | null = null

/** Scheduler dùng chung (module singleton, cache promise). */
export function getScheduler(): Promise<Scheduler> {
  if (!schedulerPromise) {
    schedulerPromise = DefaultScheduler({
      desiredRetention: 0.9,
      enableShortTerm: true,
      learningSteps: ['1m', '10m'],
      relearningSteps: ['10m'],
      enableFuzz: false,
      maximumInterval: 365,
      // FSRS-7 mặc định cho model ghi đè bước học (Nhớ → ~4,8 ngày); tắt để thẻ mới đi qua 1m/10m.
      allowModelOverride: false,
    }).catch((err: unknown) => {
      schedulerPromise = null
      throw err
    })
  }
  return schedulerPromise
}

/** Card FSRS mới (state New, dueAt = now). */
export async function newCardState(cardId: string, now: Date): Promise<FsrsCard> {
  const scheduler = await getScheduler()
  return scheduler.newCard({ now, cardId })
}

/** JSON hoá card/revlog FSRS (Date → chuỗi ISO) để lưu jsonb. */
export function serializeCard(fsrsCard: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(fsrsCard)) as Record<string, unknown>
}

function toDate(value: unknown, field: string): Date {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value as string | number)
  if (
    (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) ||
    Number.isNaN(d.getTime())
  ) {
    throw new Error(`deserializeCard: trường "${field}" không phải ngày hợp lệ`)
  }
  return d
}

/** Khôi phục card FSRS từ jsonb: `dueAt`, `lastReviewAt` về Date, giữ nguyên các trường khác. */
export function deserializeCard(raw: Record<string, unknown>): FsrsCard {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('deserializeCard: dữ liệu FSRS không phải object')
  }
  if (raw.dueAt == null) {
    throw new Error('deserializeCard: thiếu trường "dueAt"')
  }
  const lastReviewAt = raw.lastReviewAt == null ? null : toDate(raw.lastReviewAt, 'lastReviewAt')
  return {
    ...raw,
    dueAt: toDate(raw.dueAt, 'dueAt'),
    lastReviewAt,
  } as unknown as FsrsCard
}

/** Tạo bản ghi `Card` mới (state New, due = now). */
export async function createCardRecord(args: {
  id: string
  user_id: string
  item_id: string
  direction: Direction
  now: Date
}): Promise<Card> {
  const { id, user_id, item_id, direction, now } = args
  const fsrsCard = await newCardState(id, now)
  const iso = now.toISOString()
  return {
    id,
    user_id,
    item_id,
    direction,
    due: iso,
    state: 0,
    reps: 0,
    lapses: 0,
    first_reviewed_at: null,
    suspended: false,
    fsrs: serializeCard(fsrsCard),
    created_at: iso,
    updated_at: iso,
  }
}

/**
 * Thời điểm đưa vào scheduler: không sớm hơn `lastReviewAt` (đồng hồ lệch giữa thiết bị/đồng bộ),
 * vì thư viện ném lỗi khi elapsedDays âm.
 */
function schedulingTime(prev: FsrsCardInput, now: Date): Date {
  return prev.lastReviewAt != null && now.getTime() < prev.lastReviewAt.getTime()
    ? prev.lastReviewAt
    : now
}

/** Chấm một thẻ. Hàm thuần: không gọi repository; `duration_ms` để 0 cho caller ghi đè. */
export async function gradeCard(
  card: Card,
  grade: Grade,
  now: Date,
): Promise<{ card: Card; log: ReviewLogEntry }> {
  const scheduler = await getScheduler()
  const prev = deserializeCard(card.fsrs) as FsrsCardInput
  const { card: next, revlog } = scheduler.review({
    card: prev,
    now: schedulingTime(prev, now),
    grade,
  })
  const iso = now.toISOString()
  return {
    card: {
      ...card,
      due: next.dueAt.toISOString(),
      state: next.state,
      reps: next.reps,
      lapses: next.lapses,
      first_reviewed_at: card.first_reviewed_at ?? iso,
      fsrs: serializeCard(next),
      updated_at: iso,
    },
    log: {
      id: newId(),
      user_id: card.user_id,
      card_id: card.id,
      rating: grade,
      reviewed_at: iso,
      duration_ms: 0,
      revlog: serializeCard(revlog),
    },
  }
}

/** Dự báo khoảng cách cho 4 mức chấm, chuỗi hiển thị theo `formatRelative`. */
export async function previewIntervals(card: Card, now: Date): Promise<Record<Grade, string>> {
  const scheduler = await getScheduler()
  const prev = deserializeCard(card.fsrs) as FsrsCardInput
  const at = schedulingTime(prev, now)
  const out: Partial<Record<Grade, string>> = {}
  for (const { grade, card: next } of scheduler.preview({ card: prev, now: at })) {
    // Hiển thị khoảng cách theo giờ thật của thiết bị (khớp shouldRequeue 4.4.6); dueAt ≥ at ≥ now nên luôn dương.
    out[grade as Grade] = formatInterval(next.dueAt.getTime() - now.getTime())
  }
  return out as Record<Grade, string>
}

/** Ủy quyền cho `formatRelative` (lib/dates.ts). */
export function formatInterval(ms: number): string {
  return formatRelative(ms)
}

/**
 * Mở khoá vi_en/listen (SPEC 4.3): thẻ en_vi đã được ôn ở một ngày địa phương trước đó
 * và lần chấm hiện tại không phải "Quên".
 */
export function shouldUnlockSiblings(prevCard: Card, grade: Grade, now: Date): boolean {
  if (prevCard.direction !== 'en_vi') return false
  const { lastReviewAt } = deserializeCard(prevCard.fsrs)
  if (lastReviewAt == null) return false
  return localDay(lastReviewAt) < localDay(now) && grade !== 1
}
