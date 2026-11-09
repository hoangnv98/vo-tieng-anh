import { MAX_DURATION_MS } from '../domain/review'
import type { Grade } from '../domain/types'

/**
 * Trạng thái phiên ôn (6.7 mục 3), thuần và bất biến.
 * `queue` chứa id thẻ theo thứ tự hiện, kể cả các lần requeue nối vào cuối; `index` trỏ thẻ đang hiện.
 * Vì vậy `index` = số lần đã chấm (hoặc bỏ qua) và `queue.length` = N "Thẻ {i}/{N}".
 */
export interface ReviewSession {
  queue: string[]
  index: number
  /** Số lần mỗi thẻ đã được chấm trong phiên. */
  seen: Record<string, number>
  /** Id các thẻ đã chấm ít nhất 1 lần (cho "{n} thẻ đã ôn"). */
  reviewed: string[]
  /** Số lần chọn "Quên". */
  againCount: number
  /** Tổng thời gian trả lời đã tính (ms, mỗi lần đã cap 60s). */
  durationMs: number
}

export { MAX_DURATION_MS }

export function startSession(cardIds: readonly string[]): ReviewSession {
  return { queue: [...cardIds], index: 0, seen: {}, reviewed: [], againCount: 0, durationMs: 0 }
}

/** Id thẻ đang hiện; `null` khi đã hết hàng đợi. */
export function currentCardId(s: ReviewSession): string | null {
  return s.index < s.queue.length ? s.queue[s.index] : null
}

/** Số lần thẻ hiện tại đã hiện trong phiên, kể cả lần này (đối số `timesShown` của `gradeCard`). */
export function timesShown(s: ReviewSession): number {
  const id = currentCardId(s)
  return id === null ? 0 : (s.seen[id] ?? 0) + 1
}

/** Phiên kết thúc khi hàng đợi (không rỗng ban đầu) đã đi hết. */
export function isFinished(s: ReviewSession): boolean {
  return s.queue.length > 0 && s.index >= s.queue.length
}

/** "Thẻ {i}/{N}": i = số đã chấm + 1 (không vượt N), N = độ dài hàng đợi kể cả requeue. */
export function progress(s: ReviewSession): { i: number; n: number } {
  return { i: Math.min(s.index + 1, s.queue.length), n: s.queue.length }
}

export function clampDuration(ms: number): number {
  return Number.isFinite(ms) ? Math.min(Math.max(0, Math.round(ms)), MAX_DURATION_MS) : 0
}

/** Ghi nhận một lần chấm thẻ hiện tại; `requeue` → nối thẻ vào cuối hàng đợi. */
export function applyGrade(
  s: ReviewSession,
  r: { grade: Grade; requeue: boolean; durationMs: number },
): ReviewSession {
  const id = currentCardId(s)
  if (id === null) return s
  return {
    queue: r.requeue ? [...s.queue, id] : s.queue,
    index: s.index + 1,
    seen: { ...s.seen, [id]: (s.seen[id] ?? 0) + 1 },
    reviewed: s.reviewed.includes(id) ? s.reviewed : [...s.reviewed, id],
    againCount: s.againCount + (r.grade === 1 ? 1 : 0),
    durationMs: s.durationMs + clampDuration(r.durationMs),
  }
}

/** Bỏ qua thẻ hiện tại (thẻ đã bị xoá ở nơi khác hoặc ghi lỗi) mà không tính là đã ôn. */
export function skipCurrent(s: ReviewSession): ReviewSession {
  return currentCardId(s) === null ? s : { ...s, index: s.index + 1 }
}

/**
 * Bỏ qua các thẻ không còn tồn tại (bị xoá ở thiết bị/tab khác giữa phiên), không tính là đã ôn.
 * Trả nguyên `s` nếu thẻ hiện tại vẫn còn.
 */
export function skipMissing(s: ReviewSession, exists: (cardId: string) => boolean): ReviewSession {
  let index = s.index
  while (index < s.queue.length && !exists(s.queue[index])) index += 1
  return index === s.index ? s : { ...s, index }
}

/** Chuỗi thời lượng ở màn tổng kết: < 60 giây → "<1 phút", còn lại làm tròn phút. */
export function sessionDurationLabel(s: ReviewSession): string {
  if (s.durationMs < 60_000) return '<1 phút'
  return `${Math.round(s.durationMs / 60_000)} phút`
}
