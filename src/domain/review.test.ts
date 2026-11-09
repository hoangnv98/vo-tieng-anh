import { describe, expect, it } from 'vitest'
import {
  buildQueue,
  estimateMinutes,
  hardestCards,
  hiddenListenCount,
  newCardsPerDay,
  missingSiblingDirections,
  planUnlock,
  shouldRequeue,
  shouldUnlockSiblings,
} from './review'
import type { Card, Item, Settings } from './types'

const NOW = new Date('2026-11-09T03:00:00.000Z') // 10:00 giờ VN, Thứ Hai 9/11
const MIN = 60_000

function item(id: string, over: Partial<Item> = {}): Item {
  return {
    id,
    user_id: 'u',
    lesson_id: 'L1',
    kind: 'word',
    en: `en ${id}`,
    vi: `vi ${id}`,
    ipa: '',
    note: '',
    pattern_id: null,
    position: 0,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...over,
  }
}

function card(id: string, over: Partial<Card> & { difficulty?: number; stability?: number } = {}): Card {
  const { difficulty = 5, stability = 1, ...rest } = over
  const base: Card = {
    id,
    user_id: 'u',
    item_id: 'i1',
    direction: 'en_vi',
    due: NOW.toISOString(),
    state: 0,
    reps: 0,
    lapses: 0,
    first_reviewed_at: null,
    suspended: false,
    fsrs: {},
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...rest,
  }
  base.fsrs = { difficulty, stability, dueAt: base.due, lastReviewAt: null, ...rest.fsrs }
  return base
}

function settings(new_cards_per_day: number = 15): Settings {
  return {
    user_id: 'u',
    display_name: '',
    daily_goal_min: 15,
    new_cards_per_day,
    voice_name: null,
    auto_speak: false,
  }
}

const ids = (cs: { id: string }[]) => cs.map((c) => c.id)
const items = [item('i1'), item('i2', { lesson_id: 'L2' }), item('i3', { lesson_id: null })]
const opts = { ttsSupported: true }

describe('buildQueue', () => {
  it('loại suspended và thẻ có item không tồn tại', () => {
    const cards = [
      card('a', { state: 2, due: '2026-11-08T00:00:00.000Z' }),
      card('b', { state: 2, due: '2026-11-08T00:00:00.000Z', suspended: true }),
      card('c', { state: 2, due: '2026-11-08T00:00:00.000Z', item_id: 'ghost' }),
    ]
    expect(ids(buildQueue(cards, items, settings(), NOW, opts))).toEqual(['a'])
  })

  it('loại thẻ listen khi !ttsSupported, giữ khi hỗ trợ', () => {
    const cards = [
      card('a', { state: 2, due: '2026-11-08T00:00:00.000Z', direction: 'listen' }),
      card('b', { state: 2, due: '2026-11-08T00:00:00.000Z', direction: 'vi_en' }),
    ]
    expect(ids(buildQueue(cards, items, settings(), NOW, { ttsSupported: false }))).toEqual(['b'])
    expect(ids(buildQueue(cards, items, settings(), NOW, { ttsSupported: true }))).toEqual(['a', 'b'])
  })

  it('đến hạn tới cuối ngày địa phương; thẻ đang học (1/3) trước thẻ review, mỗi nhóm theo due', () => {
    const cards = [
      card('r-late', { state: 2, due: '2026-11-09T16:00:00.000Z' }), // 23:00 VN hôm nay
      card('r-early', { state: 2, due: '2026-11-01T00:00:00.000Z' }),
      card('l-relearn', { state: 3, due: '2026-11-09T05:00:00.000Z' }),
      card('l-learn', { state: 1, due: '2026-11-09T02:00:00.000Z' }),
      card('tomorrow', { state: 2, due: '2026-11-09T17:00:00.000Z' }), // 00:00 VN ngày mai
    ]
    expect(ids(buildQueue(cards, items, settings(), NOW, opts))).toEqual([
      'l-learn',
      'l-relearn',
      'r-early',
      'r-late',
    ])
  })

  it('thẻ mới theo created_at, xếp sau thẻ đến hạn', () => {
    const cards = [
      card('n2', { created_at: '2026-11-03T00:00:00.000Z' }),
      card('n1', { created_at: '2026-11-02T00:00:00.000Z' }),
      card('due', { state: 2, due: '2026-11-08T00:00:00.000Z' }),
    ]
    expect(ids(buildQueue(cards, items, settings(), NOW, opts))).toEqual(['due', 'n1', 'n2'])
  })

  it('giới hạn 15 thẻ mới mỗi ngày', () => {
    const cards = Array.from({ length: 20 }, (_, i) =>
      card(`n${String(i).padStart(2, '0')}`, {
        created_at: new Date(Date.parse('2026-11-01T00:00:00.000Z') + i * MIN).toISOString(),
      }),
    )
    const q = buildQueue(cards, items, settings(15), NOW, opts)
    expect(q).toHaveLength(15)
    expect(q[0].id).toBe('n00')
    expect(q[14].id).toBe('n14')
  })

  it('hạn mức trừ thẻ có first_reviewed_at trong ngày địa phương hôm nay (16:59Z tính, 17:00Z không)', () => {
    const fresh = Array.from({ length: 10 }, (_, i) =>
      card(`n${i}`, {
        created_at: new Date(Date.parse('2026-11-01T00:00:00.000Z') + i * MIN).toISOString(),
      }),
    )
    const reviewedLater = { state: 2 as const, due: '2026-11-20T00:00:00.000Z' }
    const introduced = [
      // 23:59 VN hôm nay → tính
      card('t1', { ...reviewedLater, first_reviewed_at: '2026-11-09T16:59:00.000Z' }),
      // 00:00 VN 9/11 (= 17:00Z 8/11) → tính
      card('t2', { ...reviewedLater, first_reviewed_at: '2026-11-08T17:00:00.000Z' }),
      // 00:00 VN ngày mai → không tính
      card('x1', { ...reviewedLater, first_reviewed_at: '2026-11-09T17:00:00.000Z' }),
      // 23:59 VN hôm qua → không tính
      card('x2', { ...reviewedLater, first_reviewed_at: '2026-11-08T16:59:00.000Z' }),
    ]
    const q = buildQueue([...fresh, ...introduced], items, settings(5), NOW, opts)
    expect(ids(q)).toEqual(['n0', 'n1', 'n2'])
  })

  it('hạn mức không âm khi đã giới thiệu quá số thẻ mới', () => {
    const introduced = Array.from({ length: 7 }, (_, i) =>
      card(`t${i}`, {
        state: 2,
        due: '2026-11-20T00:00:00.000Z',
        first_reviewed_at: '2026-11-09T01:00:00.000Z',
      }),
    )
    const q = buildQueue([...introduced, card('n')], items, settings(5), NOW, opts)
    expect(q).toEqual([])
  })

  it('chế độ lessonId: chỉ thẻ của buổi, gồm chưa đến hạn, không giới hạn thẻ mới', () => {
    const cards = [
      card('later', { state: 2, due: '2026-12-01T00:00:00.000Z' }),
      card('n2', { created_at: '2026-11-03T00:00:00.000Z' }),
      card('due-r', { state: 2, due: '2026-11-05T00:00:00.000Z' }),
      card('n1', { created_at: '2026-11-02T00:00:00.000Z' }),
      card('soon', { state: 2, due: '2026-11-15T00:00:00.000Z' }),
      card('due-l', { state: 1, due: '2026-11-09T04:00:00.000Z' }),
      card('other', { state: 2, due: '2026-11-05T00:00:00.000Z', item_id: 'i2' }),
      card('lib', { item_id: 'i3' }),
      card('susp', { suspended: true }),
    ]
    const q = buildQueue(cards, items, settings(5), NOW, { lessonId: 'L1', ttsSupported: true })
    expect(ids(q)).toEqual(['due-l', 'due-r', 'n1', 'n2', 'soon', 'later'])

    const many = Array.from({ length: 8 }, (_, i) => card(`m${i}`))
    expect(buildQueue(many, items, settings(5), NOW, { lessonId: 'L1', ttsSupported: true })).toHaveLength(8)
  })

  it('chế độ lessonId vẫn loại listen khi !ttsSupported', () => {
    const cards = [card('a', { direction: 'listen' }), card('b')]
    expect(ids(buildQueue(cards, items, settings(), NOW, { lessonId: 'L1', ttsSupported: false }))).toEqual(['b'])
  })
})

describe('buildQueue — tie-break, dữ liệu hỏng, hạn mức', () => {
  it('thẻ New trùng created_at: position → chiều → id, không phụ thuộc thứ tự đầu vào', () => {
    const its = [item('p0', { position: 0 }), item('p1', { position: 1 })]
    const t = '2026-11-02T00:00:00.000Z'
    const cards = [
      card('z', { item_id: 'p1', created_at: t }),
      card('y', { item_id: 'p0', created_at: t, direction: 'listen' }),
      card('x', { item_id: 'p0', created_at: t, direction: 'vi_en' }),
      card('b', { item_id: 'p0', created_at: t }),
      card('a', { item_id: 'p0', created_at: t }),
    ]
    const expected = ['a', 'b', 'x', 'y', 'z']
    expect(ids(buildQueue(cards, its, settings(), NOW, opts))).toEqual(expected)
    expect(ids(buildQueue([...cards].reverse(), its, settings(), NOW, opts))).toEqual(expected)
  })

  it('nhóm đến hạn trùng due: theo id, không phụ thuộc thứ tự đầu vào', () => {
    const due = '2026-11-08T00:00:00.000Z'
    const cards = [card('b', { state: 2, due }), card('a', { state: 2, due }), card('c', { state: 1, due })]
    expect(ids(buildQueue(cards, items, settings(), NOW, opts))).toEqual(['c', 'a', 'b'])
    expect(ids(buildQueue([...cards].reverse(), items, settings(), NOW, opts))).toEqual(['c', 'a', 'b'])
  })

  it('due hỏng → vẫn vào nhóm đến hạn, xếp cuối; created_at hỏng → coi như 0', () => {
    const cards = [
      card('bad', { state: 2, due: 'không-phải-ngày' }),
      card('ok', { state: 2, due: '2026-11-08T00:00:00.000Z' }),
      card('n-ok', { created_at: '2026-11-02T00:00:00.000Z' }),
      card('n-bad', { created_at: 'hỏng' }),
    ]
    expect(ids(buildQueue(cards, items, settings(), NOW, opts))).toEqual(['ok', 'bad', 'n-bad', 'n-ok'])
  })

  it('new_cards_per_day: kẹp 5–30, cắt thập phân, undefined/NaN → 15', () => {
    const s = (x: unknown) => ({ ...settings(), new_cards_per_day: x as number })
    expect(newCardsPerDay(s(undefined))).toBe(15)
    expect(newCardsPerDay(s(Number.NaN))).toBe(15)
    expect(newCardsPerDay(s(Infinity))).toBe(15)
    expect(newCardsPerDay(s(2))).toBe(5)
    expect(newCardsPerDay(s(99))).toBe(30)
    expect(newCardsPerDay(s(7.9))).toBe(7)
    const many = Array.from({ length: 20 }, (_, i) => card(`n${String(i).padStart(2, '0')}`))
    expect(buildQueue(many, items, s(undefined), NOW, opts)).toHaveLength(15)
    expect(buildQueue(many, items, s(Number.NaN), NOW, opts)).toHaveLength(15)
  })
})

describe('hiddenListenCount', () => {
  it('đếm thẻ listen lẽ ra vào hàng đợi (đến hạn + trong hạn mức thẻ mới)', () => {
    const cards = [
      card('l-due', { state: 2, due: '2026-11-08T00:00:00.000Z', direction: 'listen' }),
      card('l-later', { state: 2, due: '2026-12-01T00:00:00.000Z', direction: 'listen' }),
      card('l-susp', { state: 2, due: '2026-11-08T00:00:00.000Z', direction: 'listen', suspended: true }),
      card('l-ghost', { state: 2, due: '2026-11-08T00:00:00.000Z', direction: 'listen', item_id: 'ghost' }),
      ...Array.from({ length: 5 }, (_, i) =>
        card(`n${i}`, { created_at: `2026-11-0${i + 1}T00:00:00.000Z` }),
      ),
      card('l-new-in', { direction: 'listen', created_at: '2026-10-01T00:00:00.000Z' }), // trong hạn mức
      card('l-new-out', { direction: 'listen', created_at: '2026-11-08T00:00:00.000Z' }), // ngoài hạn mức 5
    ]
    expect(hiddenListenCount(cards, items, settings(5), NOW)).toBe(2)
  })
})

describe('estimateMinutes', () => {
  it('ceil(n*20/60), 0 → 0', () => {
    expect(estimateMinutes(0)).toBe(0)
    expect(estimateMinutes(1)).toBe(1)
    expect(estimateMinutes(3)).toBe(1)
    expect(estimateMinutes(4)).toBe(2)
    expect(estimateMinutes(15)).toBe(5)
  })
})

describe('shouldRequeue', () => {
  const at = (msFromNow: number) => card('a', { state: 1, due: new Date(NOW.getTime() + msFromNow).toISOString() })

  it('requeue khi due trong vòng 15 phút và chưa hiện đủ 3 lần', () => {
    expect(shouldRequeue(at(MIN), NOW, 1)).toBe(true)
    expect(shouldRequeue(at(15 * MIN), NOW, 2)).toBe(true)
  })

  it('không requeue khi due quá 15 phút', () => {
    expect(shouldRequeue(at(15 * MIN + 1), NOW, 1)).toBe(false)
    expect(shouldRequeue(at(3 * 86_400_000), NOW, 1)).toBe(false)
  })

  it('không requeue khi đã hiện 3 lần', () => {
    expect(shouldRequeue(at(MIN), NOW, 3)).toBe(false)
    expect(shouldRequeue(at(MIN), NOW, 4)).toBe(false)
  })
})

describe('shouldUnlockSiblings (re-export)', () => {
  const enVi = (lastReviewAt: string | null, direction: Card['direction'] = 'en_vi') =>
    card('a', { direction, state: 2, fsrs: { lastReviewAt } })

  it('mở khoá khi lần ôn trước ở ngày địa phương trước đó và grade ≠ 1', () => {
    expect(shouldUnlockSiblings(enVi('2026-11-08T16:59:00.000Z'), 3, NOW)).toBe(true)
    expect(shouldUnlockSiblings(enVi('2026-11-01T00:00:00.000Z'), 2, NOW)).toBe(true)
  })

  it('không mở khoá khi cùng ngày địa phương, grade Quên, chưa từng ôn hoặc không phải en_vi', () => {
    expect(shouldUnlockSiblings(enVi('2026-11-08T17:00:00.000Z'), 3, NOW)).toBe(false)
    expect(shouldUnlockSiblings(enVi('2026-11-01T00:00:00.000Z'), 1, NOW)).toBe(false)
    expect(shouldUnlockSiblings(enVi(null), 3, NOW)).toBe(false)
    expect(shouldUnlockSiblings(enVi('2026-11-01T00:00:00.000Z', 'vi_en'), 3, NOW)).toBe(false)
  })
})

describe('missingSiblingDirections', () => {
  it('trả các chiều vi_en/listen còn thiếu cho item', () => {
    expect(missingSiblingDirections('i1', [card('a')])).toEqual(['vi_en', 'listen'])
    expect(missingSiblingDirections('i1', [card('a'), card('b', { direction: 'listen' })])).toEqual(['vi_en'])
    expect(
      missingSiblingDirections('i1', [
        card('a'),
        card('b', { direction: 'vi_en' }),
        card('d', { item_id: 'i2', direction: 'listen' }),
      ]),
    ).toEqual(['listen'])
    expect(
      missingSiblingDirections('i1', [card('b', { direction: 'vi_en' }), card('c', { direction: 'listen' })]),
    ).toEqual([])
  })
})

describe('hardestCards', () => {
  it('sắp theo lapses giảm dần rồi difficulty giảm dần, gán nhãn', () => {
    const its = ['e', 'h', 'l1', 'l2', 'n'].map((id) => item(id))
    const cards = [
      card('easy', { item_id: 'e', state: 2, difficulty: 3 }),
      card('hard', { item_id: 'h', state: 2, difficulty: 8 }),
      card('lapse1', { item_id: 'l1', state: 3, lapses: 1, difficulty: 4 }),
      card('lapse2', { item_id: 'l2', state: 2, lapses: 2, difficulty: 2 }),
      card('new', { item_id: 'n', state: 0 }),
    ]
    const out = hardestCards(cards, its)
    expect(ids(out.map((h) => h.card))).toEqual(['lapse2', 'lapse1', 'hard'])
    expect(out.map((h) => [h.label, h.tone])).toEqual([
      ['quên 2 lần', 'red'],
      ['quên 1 lần', 'red'],
      ['khó', 'mute'],
    ])
    expect(out[0].item.id).toBe('l2')
  })

  it('nhãn "đang học" khi không quên và difficulty < 7; ngưỡng 7 là "khó"', () => {
    const out = hardestCards(
      [card('a', { state: 1, difficulty: 6.9 }), card('b', { item_id: 'i2', state: 2, difficulty: 7 })],
      items,
      2,
    )
    expect(out.map((h) => [h.card.id, h.label])).toEqual([
      ['b', 'khó'],
      ['a', 'đang học'],
    ])
  })

  it('bù thẻ New theo created_at với nhãn "mới" khi có thẻ đã học nhưng chưa đủ n', () => {
    const its = [item('i1'), item('i2'), item('i3'), item('i4')]
    const cards = [
      card('n2', { item_id: 'i3', created_at: '2026-11-03T00:00:00.000Z' }),
      card('s', { state: 2, difficulty: 5 }),
      card('n1', { item_id: 'i2', created_at: '2026-11-02T00:00:00.000Z' }),
      card('n3', { item_id: 'i4', created_at: '2026-11-04T00:00:00.000Z' }),
      card('n-same', { item_id: 'i1', created_at: '2026-10-01T00:00:00.000Z', direction: 'vi_en' }),
    ]
    const out = hardestCards(cards, its)
    expect(out.map((h) => [h.card.id, h.label, h.tone])).toEqual([
      ['s', 'đang học', 'mute'],
      ['n1', 'mới', 'mute'],
      ['n2', 'mới', 'mute'],
    ])
  })

  it('không có thẻ nào đã học → [] (không bù thẻ mới)', () => {
    expect(hardestCards([card('n1'), card('n2', { item_id: 'i2' })], items)).toEqual([])
  })

  it('dedupe theo item_id, giữ thẻ khó nhất của item', () => {
    const cards = [
      card('a-en', { state: 2, lapses: 1 }),
      card('a-vi', { state: 2, lapses: 3, direction: 'vi_en' }),
      card('b', { item_id: 'i2', state: 2, lapses: 2 }),
    ]
    const out = hardestCards(cards, items)
    expect(ids(out.map((h) => h.card))).toEqual(['a-vi', 'b'])
  })

  it('lọc thẻ listen khi !ttsSupported', () => {
    const cards = [
      card('l', { state: 2, lapses: 5, direction: 'listen' }),
      card('e', { item_id: 'i2', state: 2, lapses: 1 }),
    ]
    expect(ids(hardestCards(cards, items, 3, { ttsSupported: false }).map((h) => h.card))).toEqual(['e'])
    expect(ids(hardestCards(cards, items, 3, { ttsSupported: true }).map((h) => h.card))).toEqual(['l', 'e'])
  })

  it('bỏ qua thẻ có item không tồn tại; rỗng khi không có thẻ', () => {
    expect(hardestCards([card('g', { state: 2, lapses: 5, item_id: 'ghost' })], items)).toEqual([])
    expect(hardestCards([], items)).toEqual([])
  })
})

describe('planUnlock (gradeCard trả `unlocked`)', () => {
  /** Mô phỏng gradeCard: tính chiều thiếu trên snapshot trước, tạo thẻ, rồi chốt trên snapshot sau. */
  function unlock(before: Card[], after: Card[] = before): Card[] {
    const created = missingSiblingDirections('i1', before).map((direction) => card(`new-${direction}`, { direction }))
    return planUnlock('i1', created, after)
  }

  it('đã có 1 thẻ anh em → mở khoá 1', () => {
    const before = [card('a'), card('b', { direction: 'vi_en' })]
    const out = unlock(before)
    expect(out.map((c) => c.direction)).toEqual(['listen'])
  })

  it('thiếu cả hai → mở khoá 2', () => {
    expect(unlock([card('a')]).map((c) => c.direction)).toEqual(['vi_en', 'listen'])
  })

  it('nơi khác đã mở khoá đồng thời → 0', () => {
    const before = [card('a')]
    const after = [card('a'), card('x', { direction: 'vi_en' }), card('y', { direction: 'listen' })]
    expect(unlock(before, after)).toHaveLength(0)
  })

  it('bỏ thẻ khác item và chiều trùng', () => {
    const created = [
      card('n1', { direction: 'vi_en' }),
      card('n2', { direction: 'vi_en' }),
      card('n3', { direction: 'listen', item_id: 'i2' }),
    ]
    expect(ids(planUnlock('i1', created, [card('a')]))).toEqual(['n1'])
  })
})
