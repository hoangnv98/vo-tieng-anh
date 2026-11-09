import { describe, expect, it } from 'vitest'
import { addDays } from '../lib/dates'
import { buildImportOps, isEmptyPlan, planImport, validateImportFile, type ImportFile } from './importSnapshot'
import type { Card, Item, Lesson, Settings, Snapshot, StudyDay } from './types'

const TODAY = '2026-11-09'
const NOW = new Date('2026-11-09T03:00:00.000Z')
const T = '2026-11-01T03:00:00.000Z'
const FSRS = { dueAt: T, lastReviewAt: null, stability: 0, difficulty: 0, state: 0 }

function lesson(id: string, over: Partial<Lesson> = {}): Lesson {
  return { id, user_id: 'old', number: 1, date: '2026-11-01', topic: 'Chào hỏi', notes: '', questions: '', mistakes: '', created_at: T, updated_at: T, ...over }
}
function item(id: string, lessonId: string | null, over: Partial<Item> = {}): Item {
  return { id, user_id: 'old', lesson_id: lessonId, kind: 'phrase', en: 'hello', vi: 'xin chào', ipa: '', note: '', pattern_id: null, position: 0, created_at: T, updated_at: T, ...over }
}
function card(id: string, itemId: string, over: Partial<Card> = {}): Card {
  return { id, user_id: 'old', item_id: itemId, direction: 'en_vi', due: T, state: 0, reps: 0, lapses: 0, first_reviewed_at: null, suspended: false, fsrs: FSRS, created_at: T, updated_at: T, ...over }
}
function day(d: string, seconds: number, reviews = 0, shadowing = 0): StudyDay {
  return { user_id: 'old', day: d, seconds, reviews, shadowing_count: shadowing }
}
const SETTINGS: Settings = { user_id: 'me', display_name: 'An', daily_goal_min: 15, new_cards_per_day: 15, voice_name: null, auto_speak: false }

function current(over: Partial<Snapshot> = {}): Snapshot {
  return {
    lessons: [lesson('L1')],
    items: [item('I1', 'L1'), item('P1', null, { pattern_id: 'greet-1', kind: 'pattern' })],
    cards: [card('C1', 'I1'), card('CP', 'P1')],
    studyDays: [day(TODAY, 120, 3)],
    settings: SETTINGS,
    ...over,
  }
}
function fileOf(over: Partial<ImportFile> = {}): ImportFile {
  return { lessons: [], items: [], cards: [], studyDays: [], settings: null, ...over }
}
const plan = (f: ImportFile, s: Snapshot = current()) => planImport(f, s, 'me', TODAY, NOW)

describe('validateImportFile', () => {
  it('tệp xuất (Snapshot) → ok', () => {
    const r = validateImportFile(JSON.parse(JSON.stringify(current())))
    expect(r.ok).toBe(true)
  })

  it('{} / mảng / null / thiếu cards / lessons là object / settings là chuỗi → bad-shape', () => {
    const snap = JSON.parse(JSON.stringify(current())) as Record<string, unknown>
    const noCards = { ...snap }
    delete noCards.cards
    const noSettings = { ...snap }
    delete noSettings.settings
    for (const bad of [{}, [], null, 'x', noCards, noSettings, { ...snap, lessons: {} }, { ...snap, settings: 'x' }]) {
      expect(validateImportFile(bad)).toEqual({ ok: false, error: 'bad-shape' })
    }
  })

  it('settings null và khoá lạ vẫn hợp lệ', () => {
    const r = validateImportFile({ lessons: [], items: [], cards: [], studyDays: [], settings: null, extra: 1 })
    expect(r).toEqual({ ok: true, file: { lessons: [], items: [], cards: [], studyDays: [], settings: null } })
  })
})

describe('planImport', () => {
  it('id trùng → update, id mới → add; user_id mọi bản ghi = userId truyền vào', () => {
    const p = plan(
      fileOf({
        lessons: [lesson('L1', { topic: 'Sửa' }), lesson('L2')],
        items: [item('I1', 'L1'), item('I2', 'L2')],
        cards: [card('C1', 'I1'), card('C2', 'I2')],
      }),
    )
    expect(p.counts.lessons).toEqual({ add: 1, update: 1 })
    expect(p.counts.items).toEqual({ add: 1, update: 1 })
    expect(p.counts.cards).toEqual({ add: 1, update: 1 })
    expect(p.counts.skipped).toBe(0)
    expect([...p.lessons, ...p.items, ...p.cards].every((r) => r.user_id === 'me')).toBe(true)
    expect(p.lessons[0].topic).toBe('Sửa')
  })

  it('lesson topic rỗng / number ngoài 1–999 / ngày tương lai quá 1 ngày → skipped', () => {
    const p = plan(
      fileOf({
        lessons: [
          lesson('A', { topic: '   ' }),
          lesson('B', { number: 0 }),
          lesson('C', { date: addDays(TODAY, 2) }),
          lesson('D', { date: addDays(TODAY, 1) }),
          'rác',
        ],
      }),
    )
    expect(p.lessons.map((l) => l.id)).toEqual(['D'])
    expect(p.counts.skipped).toBe(4)
  })

  it('lesson thiếu notes/questions/mistakes → "", created_at hỏng → now', () => {
    const raw: Record<string, unknown> = { ...lesson('L5'), created_at: 'hỏng' }
    delete raw.notes
    delete raw.questions
    const p = plan(fileOf({ lessons: [raw] }))
    expect(p.lessons[0]).toMatchObject({ notes: '', questions: '', created_at: NOW.toISOString() })
  })

  it('item lesson_id lạ → skipped; lesson_id trỏ tới buổi trong tệp hoặc hiện có → ok', () => {
    const p = plan(
      fileOf({
        lessons: [lesson('L2')],
        items: [item('X', 'L-lạ'), item('I2', 'L2'), item('I3', 'L1'), item('I4', null)],
      }),
    )
    expect(p.items.map((i) => i.id)).toEqual(['I2', 'I3', 'I4'])
    expect(p.skippedReasons).toEqual({ 'item-unknown-lesson': 1 })
  })

  it('item pattern_id đã có ở id khác → skipped; trùng trong tệp → giữ bản đầu; cùng id → update', () => {
    const p = plan(
      fileOf({
        items: [
          item('P2', null, { pattern_id: 'greet-1' }),
          item('P1', null, { pattern_id: 'greet-1' }),
          item('Q1', null, { pattern_id: 'greet-2' }),
          item('Q2', null, { pattern_id: 'greet-2' }),
        ],
      }),
    )
    expect(p.items.map((i) => i.id)).toEqual(['P1', 'Q1'])
    expect(p.counts.skipped).toBe(2)
    expect(p.counts.items).toEqual({ add: 1, update: 1 })
  })

  it('item kind lạ / en quá 200 ký tự / position âm → skipped; position thiếu → thứ tự trong tệp', () => {
    const noPos: Record<string, unknown> = { ...item('I7', null) }
    delete noPos.position
    const p = plan(
      fileOf({
        items: [item('A', null, { kind: 'idiom' as never }), item('B', null, { en: 'x'.repeat(201) }), item('C', null, { position: -1 }), noPos],
      }),
    )
    expect(p.items.map((i) => [i.id, i.position])).toEqual([['I7', 3]])
    expect(p.counts.skipped).toBe(3)
  })

  it('card (item_id, direction) đã có ở id khác → skipped, giữ thẻ hiện có', () => {
    const p = plan(fileOf({ cards: [card('C-khac', 'I1', { reps: 9 }), card('C-listen', 'I1', { direction: 'listen' })] }))
    expect(p.cards.map((c) => c.id)).toEqual(['C-listen'])
    expect(p.skippedReasons).toEqual({ 'card-duplicate-direction': 1 })
  })

  it('card fsrs thiếu dueAt / fsrs không phải object → skipped', () => {
    const p = plan(fileOf({ cards: [card('C8', 'I1', { direction: 'vi_en', fsrs: { stability: 1 } }), { ...card('C9', 'I1', { direction: 'listen' }), fsrs: 'x' }] }))
    expect(p.cards).toEqual([])
    expect(p.skippedReasons).toEqual({ 'card-bad-fsrs': 2 })
  })

  it('card item_id lạ / state 4 / due hỏng → skipped; suspended thiếu → false', () => {
    const noSusp: Record<string, unknown> = { ...card('C5', 'I1', { direction: 'vi_en' }) }
    delete noSusp.suspended
    const p = plan(
      fileOf({
        cards: [card('A', 'I-lạ', { direction: 'vi_en' }), card('B', 'I1', { state: 4 as never }), card('C', 'I1', { due: 'không' }), noSusp],
      }),
    )
    expect(p.cards.map((c) => [c.id, c.suspended])).toEqual([['C5', false]])
    expect(p.counts.skipped).toBe(3)
  })

  it('item không có thẻ ở đâu → itemsNeedingCard, đếm vào cards.add', () => {
    const p = plan(
      fileOf({
        items: [item('I2', null), item('I3', null), item('I1', 'L1')],
        cards: [card('C3', 'I3')],
      }),
    )
    expect(p.itemsNeedingCard).toEqual(['I2'])
    expect(p.counts.cards).toEqual({ add: 2, update: 0 })
  })

  it('study day seconds 300 khi hiện có 120 → delta 180; trường thấp hơn hiện có → 0', () => {
    const p = plan(fileOf({ studyDays: [day(TODAY, 300, 1, 2)] }))
    expect(p.studyDeltas).toEqual([{ day: TODAY, delta: { seconds: 180, reviews: 0, shadowing: 2 } }])
    expect(p.counts.studyDays).toBe(1)
  })

  it('ngày ngoài 120 ngày / tương lai / sai định dạng → skipped; ngày đầu cửa sổ vẫn nhận', () => {
    const p = plan(
      fileOf({
        studyDays: [day(addDays(TODAY, -121), 60), day(addDays(TODAY, 1), 60), day('2026-02-30', 60), day(addDays(TODAY, -120), 60)],
      }),
    )
    expect(p.studyDeltas.map((d) => d.day)).toEqual([addDays(TODAY, -120)])
    expect(p.skippedReasons).toEqual({ 'day-out-of-window': 2, 'day-invalid': 1 })
  })

  it('nhập lại cùng tệp → không study delta, update = tổng bản ghi, add = 0', () => {
    const snap = current({ studyDays: [day(TODAY, 120, 3), day('2026-11-01', 600)] })
    const file = validateImportFile(JSON.parse(JSON.stringify(snap)))
    if (!file.ok) throw new Error('bad')
    const p = plan(file.file, snap)
    expect(p.studyDeltas).toEqual([])
    expect(p.counts).toEqual({
      lessons: { add: 0, update: 1 },
      items: { add: 0, update: 2 },
      cards: { add: 0, update: 2 },
      studyDays: 0,
      skipped: 0,
    })
    expect(p.itemsNeedingCard).toEqual([])
    expect(isEmptyPlan(p)).toBe(false)
  })

  it('tệp chỉ có bản ghi hỏng → kế hoạch rỗng', () => {
    const p = plan(fileOf({ lessons: [lesson('X', { topic: '' })], studyDays: [day(TODAY, 10)] }))
    expect(isEmptyPlan(p)).toBe(true)
    expect(p.counts.skipped).toBe(1)
  })

  it('settings.daily_goal_min = 999 → giữ giá trị hiện tại, các trường khác vẫn nhập; user_id = userId', () => {
    const p = plan(
      fileOf({
        settings: { user_id: 'khac', display_name: '  Bình ', daily_goal_min: 999, new_cards_per_day: 20, voice_name: 'Samantha', auto_speak: 'có' },
      }),
    )
    expect(p.settings).toEqual({
      user_id: 'me',
      display_name: 'Bình',
      daily_goal_min: 15,
      new_cards_per_day: 20,
      voice_name: 'Samantha',
      auto_speak: false,
    })
    expect(plan(fileOf()).settings).toBeNull()
  })

  it('trùng id trong tệp → giữ bản đầu', () => {
    const p = plan(fileOf({ lessons: [lesson('L9', { topic: 'Đầu' }), lesson('L9', { topic: 'Sau' })] }))
    expect(p.lessons.map((l) => l.topic)).toEqual(['Đầu'])
    expect(p.counts.skipped).toBe(1)
  })

  it('ISO chặt: thiếu múi giờ / ngày không tồn tại → skipped; có offset → chuẩn hoá Z; created_at sai → now', () => {
    const p = plan(
      fileOf({
        cards: [
          card('A', 'I1', { direction: 'vi_en', due: '2026-11-01T03:00:00' }),
          card('B', 'I1', { direction: 'vi_en', due: '2026-02-30T03:00:00Z' }),
          card('C', 'I1', { direction: 'vi_en', first_reviewed_at: 'hôm qua' }),
          card('D', 'I1', { direction: 'vi_en', created_at: '2026-11-01 03:00', updated_at: '2026-11-01T10:00:00+07:00' }),
        ],
      }),
    )
    expect(p.cards.map((c) => c.id)).toEqual(['D'])
    expect(p.cards[0]).toMatchObject({ created_at: NOW.toISOString(), updated_at: T })
    expect(p.skippedReasons).toEqual({ 'card-invalid': 3 })
  })

  it('cận trên số nguyên: position/reps/lapses > 2^31−1, seconds > 86400, reviews/shadowing > 100000 → skipped', () => {
    const p = plan(
      fileOf({
        items: [item('A', null, { position: 2_147_483_648 }), item('B', null, { position: 2_147_483_647 })],
        cards: [card('X', 'I1', { direction: 'vi_en', reps: 2_147_483_648 }), card('Y', 'I1', { direction: 'listen', lapses: 1e12 })],
        studyDays: [day('2026-11-08', 86_401), day('2026-11-07', 10, 100_001), day('2026-11-06', 10, 0, 100_001), day('2026-11-05', 86_400)],
      }),
    )
    expect(p.items.map((i) => i.id)).toEqual(['B'])
    expect(p.cards).toEqual([])
    expect(p.studyDeltas.map((d) => d.day)).toEqual(['2026-11-05'])
    expect(p.counts.skipped).toBe(6)
  })

  it('chuỗi chứa U+0000 (text hoặc trong fsrs) → skipped', () => {
    const p = plan(
      fileOf({
        lessons: [lesson('L5', { notes: 'a\u0000b' })],
        items: [item('A', null, { en: 'hi\u0000' })],
        cards: [card('X', 'I1', { direction: 'vi_en', fsrs: { ...FSRS, cardId: 'x\u0000' } })],
      }),
    )
    expect(p.lessons.length + p.items.length + p.cards.length).toBe(0)
    expect(p.counts.skipped).toBe(3)
  })

  it('FSRS: stability/difficulty không hữu hạn hoặc state lệch → skipped; due lệch → lấy fsrs.dueAt', () => {
    const due2 = '2026-12-01T00:00:00.000Z'
    const p = plan(
      fileOf({
        cards: [
          card('A', 'I1', { direction: 'vi_en', fsrs: { ...FSRS, stability: 'x' } }),
          card('B', 'I1', { direction: 'vi_en', fsrs: { ...FSRS, state: 2 } }),
          card('C', 'I1', { direction: 'vi_en', fsrs: { ...FSRS, dueAt: due2 } }),
        ],
      }),
    )
    expect(p.cards.map((c) => [c.id, c.due])).toEqual([['C', due2]])
    expect(p.skippedReasons).toEqual({ 'card-bad-fsrs': 2 })
  })

  it('settings: mục tiêu sai bước (17) → giữ hiện tại; không trường nào hợp lệ → null', () => {
    const p = plan(fileOf({ settings: { daily_goal_min: 17, new_cards_per_day: 7 } }))
    expect(p.settings).toMatchObject({ daily_goal_min: 15, new_cards_per_day: 7 })
    expect(plan(fileOf({ settings: { daily_goal_min: 999, display_name: 5, voice_name: 3, auto_speak: 'x' } })).settings).toBeNull()
    expect(plan(fileOf({ settings: {} })).settings).toBeNull()
  })
})

describe('buildImportOps', () => {
  it('thứ tự lessons → items → cards → settings → study days; item mẫu câu mỗi op riêng; thẻ theo chunk item (≤100)', () => {
    const plain = Array.from({ length: 250 }, (_, i) => item(`N${i}`, null))
    const pats = [item('P8', null, { pattern_id: 'p-8' }), item('P9', null, { pattern_id: 'p-9' })]
    const p = plan(fileOf({ items: [...plain, ...pats], studyDays: [day('2026-11-08', 60)], settings: { daily_goal_min: 30 } }))
    expect(p.itemsNeedingCard).toHaveLength(252)
    const gen = p.itemsNeedingCard.map((id) => card(`c-${id}`, id))
    const cards = [...gen, card('c-old', 'I1', { direction: 'listen' })]
    const ops = buildImportOps(p, cards, true)
    const shape = ops.map((o) =>
      o.type === 'upsertItems' ? `items:${o.items.length}` : o.type === 'upsertCards' ? `cards:${o.cards.length}:${o.cards[0].item_id}` : o.type,
    )
    expect(shape).toEqual([
      'items:200',
      'items:50',
      'items:1',
      'items:1',
      'cards:100:N0',
      'cards:100:N100',
      'cards:50:N200',
      'cards:1:P8',
      'cards:1:P9',
      'cards:1:I1',
      'saveSettings',
      'addStudyTime',
    ])
    // mỗi op thẻ chỉ chứa thẻ của đúng một op item
    const items0 = new Set((ops[0] as { items: Item[] }).items.map((i) => i.id))
    for (const o of ops.slice(4, 6)) expect((o as { cards: Card[] }).cards.every((c) => items0.has(c.item_id))).toBe(true)
  })

  it('có lessons → upsertLessons đứng đầu; không tick cài đặt → không saveSettings', () => {
    const p = plan(fileOf({ lessons: [lesson('L5')], settings: { daily_goal_min: 30 } }))
    expect(buildImportOps(p, [], false).map((o) => o.type)).toEqual(['upsertLessons'])
  })
})

