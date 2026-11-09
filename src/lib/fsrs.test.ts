import { describe, expect, it } from 'vitest'
import type { Card, Grade } from '../domain/types'
import { formatRelative } from './dates'
import {
  createCardRecord,
  deserializeCard,
  formatInterval,
  gradeCard,
  newCardState,
  previewIntervals,
  serializeCard,
  shouldUnlockSiblings,
} from './fsrs'

const NOW = new Date('2026-11-09T03:00:00.000Z') // 10:00 giờ VN
const MIN = 60_000
const HOUR = 60 * MIN

function dueMs(card: Card): number {
  return new Date(card.due).getTime()
}

async function freshCard(now = NOW): Promise<Card> {
  return createCardRecord({ id: 'card-1', user_id: 'local', item_id: 'item-1', direction: 'en_vi', now })
}

describe('createCardRecord', () => {
  it('tạo thẻ New với due = now', async () => {
    const card = await freshCard()
    expect(card.state).toBe(0)
    expect(card.reps).toBe(0)
    expect(card.lapses).toBe(0)
    expect(card.due).toBe(NOW.toISOString())
    expect(card.first_reviewed_at).toBeNull()
    expect(card.suspended).toBe(false)
    expect(card.fsrs.cardId).toBe('card-1')
  })
})

describe('gradeCard', () => {
  it('thẻ mới chấm Good: due > now, reps 1, state khác New, first_reviewed_at = now', async () => {
    const card = await freshCard()
    const { card: next, log } = await gradeCard(card, 3, NOW)
    expect(new Date(next.due).getTime()).toBeGreaterThan(NOW.getTime())
    expect(next.reps).toBe(1)
    expect(next.state).not.toBe(0)
    expect(next.first_reviewed_at).toBe(NOW.toISOString())
    expect(next.updated_at).toBe(NOW.toISOString())
    expect(deserializeCard(next.fsrs).dueAt.toISOString()).toBe(next.due)
    expect(log.card_id).toBe('card-1')
    expect(log.user_id).toBe('local')
    expect(log.rating).toBe(3)
    expect(log.reviewed_at).toBe(NOW.toISOString())
    expect(log.duration_ms).toBe(0)
    expect(log.id).toBeTruthy()
    expect(log.revlog).toBeTypeOf('object')
  })

  it('thẻ mới chấm Again: lapses không tăng, state Learning', async () => {
    const card = await freshCard()
    const { card: next } = await gradeCard(card, 1, NOW)
    expect(next.lapses).toBe(0)
    expect(next.state).toBe(1)
  })

  it('thẻ mới chấm Good: Learning, due = now + 10 phút', async () => {
    const { card: next } = await gradeCard(await freshCard(), 3, NOW)
    expect(next.state).toBe(1)
    expect(Math.abs(dueMs(next) - (NOW.getTime() + 10 * MIN))).toBeLessThanOrEqual(1000)
  })

  it('thẻ mới chấm Hard: Learning, due trong 5–6 phút', async () => {
    const { card: next } = await gradeCard(await freshCard(), 2, NOW)
    expect(next.state).toBe(1)
    const delta = dueMs(next) - NOW.getTime()
    expect(delta).toBeGreaterThanOrEqual(5 * MIN)
    expect(delta).toBeLessThanOrEqual(6 * MIN)
  })

  it('thẻ mới chấm Again: Learning, due = now + 1 phút', async () => {
    const { card: next } = await gradeCard(await freshCard(), 1, NOW)
    expect(next.state).toBe(1)
    expect(Math.abs(dueMs(next) - (NOW.getTime() + MIN))).toBeLessThanOrEqual(1000)
  })

  it('không ném lỗi khi now sớm hơn lastReviewAt (đồng hồ lệch)', async () => {
    const reviewed = (await gradeCard(await freshCard(), 3, NOW)).card
    const earlier = new Date(NOW.getTime() - HOUR)
    const { card: next, log } = await gradeCard(reviewed, 3, earlier)
    expect(Number.isNaN(dueMs(next))).toBe(false)
    expect(dueMs(next)).toBeGreaterThan(NOW.getTime())
    expect(next.reps).toBe(2)
    expect(next.updated_at).toBe(earlier.toISOString())
    expect(log.reviewed_at).toBe(earlier.toISOString())
    expect(next.first_reviewed_at).toBe(NOW.toISOString())
  })

  it('giữ first_reviewed_at nếu đã có', async () => {
    const card = await freshCard()
    const first = (await gradeCard(card, 3, NOW)).card
    const later = new Date(NOW.getTime() + 5 * 86_400_000)
    const second = (await gradeCard(first, 3, later)).card
    expect(second.first_reviewed_at).toBe(NOW.toISOString())
    expect(second.reps).toBe(2)
  })
})

describe('serializeCard / deserializeCard', () => {
  it('giữ dueAt là Date và bằng giá trị gốc', async () => {
    const original = await newCardState('card-x', NOW)
    const raw = serializeCard(original)
    expect(typeof raw.dueAt).toBe('string')
    const back = deserializeCard(raw)
    expect(back.dueAt).toBeInstanceOf(Date)
    expect(back.dueAt.getTime()).toBe(original.dueAt.getTime())
    expect(back.lastReviewAt).toBeNull()
    expect(back.cardId).toBe('card-x')
  })

  it('chuyển lastReviewAt về Date khi có', async () => {
    const graded = (await gradeCard(await freshCard(), 3, NOW)).card
    const back = deserializeCard(graded.fsrs)
    expect(back.lastReviewAt).toBeInstanceOf(Date)
    expect(back.lastReviewAt?.getTime()).toBe(NOW.getTime())
  })

  it('ném lỗi rõ ràng khi thiếu dueAt', () => {
    expect(() => deserializeCard({ state: 0 })).toThrow(/dueAt/)
  })
})

describe('previewIntervals', () => {
  it('trả đủ 4 mức, chuỗi khác rỗng, Easy ≥ Good về thời gian', async () => {
    const card = await freshCard()
    const preview = await previewIntervals(card, NOW)
    expect(Object.keys(preview).sort()).toEqual(['1', '2', '3', '4'])
    expect(preview[1]).toBe('<10 phút')
    for (const g of [1, 2, 3, 4] as const satisfies readonly Grade[]) {
      expect(preview[g].length).toBeGreaterThan(0)
      const graded = (await gradeCard(card, g, NOW)).card
      expect(preview[g]).toBe(formatRelative(dueMs(graded) - NOW.getTime()))
    }

    const good = (await gradeCard(card, 3, NOW)).card
    const easy = (await gradeCard(card, 4, NOW)).card
    expect(dueMs(easy)).toBeGreaterThanOrEqual(dueMs(good))
  })

  it('không ném lỗi khi now sớm hơn lastReviewAt', async () => {
    const reviewed = (await gradeCard(await freshCard(), 3, NOW)).card
    const preview = await previewIntervals(reviewed, new Date(NOW.getTime() - HOUR))
    expect(Object.keys(preview).sort()).toEqual(['1', '2', '3', '4'])
    for (const g of [1, 2, 3, 4] as const) expect(preview[g].length).toBeGreaterThan(0)
  })
})

describe('shouldUnlockSiblings', () => {
  const yesterday = new Date(NOW.getTime() - 86_400_000)

  it('false khi lastReviewAt null', async () => {
    expect(shouldUnlockSiblings(await freshCard(), 3, NOW)).toBe(false)
  })

  it('false khi lần ôn trước cùng ngày địa phương', async () => {
    const earlier = new Date(NOW.getTime() - 60 * 60_000)
    const prev = (await gradeCard(await freshCard(earlier), 3, earlier)).card
    expect(shouldUnlockSiblings(prev, 3, NOW)).toBe(false)
  })

  it('true khi ôn ngày trước và chấm Good', async () => {
    const prev = (await gradeCard(await freshCard(yesterday), 3, yesterday)).card
    expect(shouldUnlockSiblings(prev, 3, NOW)).toBe(true)
  })

  it('false khi ôn ngày trước nhưng chấm Again', async () => {
    const prev = (await gradeCard(await freshCard(yesterday), 3, yesterday)).card
    expect(shouldUnlockSiblings(prev, 1, NOW)).toBe(false)
  })

  it('false với thẻ không phải en_vi', async () => {
    const prev = (await gradeCard(await freshCard(yesterday), 3, yesterday)).card
    expect(shouldUnlockSiblings({ ...prev, direction: 'vi_en' }, 3, NOW)).toBe(false)
  })
})

describe('formatInterval', () => {
  it('trả chuỗi theo formatRelative', () => {
    expect(formatInterval(60_000)).toBe('<10 phút')
    expect(formatInterval(5 * 3_600_000)).toBe('5 giờ')
    expect(formatInterval(3 * 86_400_000)).toBe('3 ngày')
  })
})
