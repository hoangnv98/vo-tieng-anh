import { describe, expect, it } from 'vitest'
import { fillPattern, findPattern, findSituation } from '../data/patterns'
import type { Item, Kind, Language, Lesson } from '../domain/types'
import {
  defaultSituationFor,
  lessonSentences,
  lessonSourceLabel,
  MAX_SENTENCES,
  resolveSource,
  situationSentences,
  sourceSentences,
} from './shadowingSource'

const T = '2026-11-09T00:00:00.000Z'

function lesson(id: string, number: number, date: string, language: Language = 'en'): Lesson {
  return { id, user_id: 'u', number, date, topic: '', notes: '', questions: '', mistakes: '', language, created_at: T, updated_at: T }
}

function item(id: string, lessonId: string | null, kind: Kind, position: number, extra: Partial<Item> = {}): Item {
  return {
    id,
    user_id: 'u',
    lesson_id: lessonId,
    kind,
    en: `en ${id}`,
    vi: `vi ${id}`,
    ipa: '',
    note: '',
    pattern_id: null,
    position,
    created_at: T,
    updated_at: T,
    ...extra,
  }
}

const lessons = [lesson('L1', 1, '2026-11-01'), lesson('L3', 3, '2026-11-08'), lesson('L2', 2, '2026-11-05')]
const items = [
  item('w1', 'L3', 'word', 0),
  item('p1', 'L3', 'phrase', 1),
  item('t1', 'L3', 'pattern', 2),
  item('p2', 'L1', 'phrase', 0),
  item('pi', null, 'pattern', 0, { pattern_id: 'ordering-03' }),
]

describe('lessonSentences', () => {
  it('phrase/pattern trước, word sau, giữ position', () => {
    expect(lessonSentences(items, 'L3').map((s) => s.key)).toEqual(['p1', 't1', 'w1'])
  })
  it('bỏ câu rỗng, tối đa 50', () => {
    const many = Array.from({ length: 60 }, (_, k) => item(`x${k}`, 'L9', 'phrase', k))
    many.push(item('blank', 'L9', 'phrase', 0, { en: '  ' }))
    const out = lessonSentences(many, 'L9')
    expect(out).toHaveLength(MAX_SENTENCES)
    expect(out[0].key).toBe('x0')
    expect(out.some((s) => s.key === 'blank')).toBe(false)
  })
  it('lessonId null → rỗng', () => {
    expect(lessonSentences(items, null)).toEqual([])
  })
})

describe('situationSentences', () => {
  it('dùng fillPattern(p, 0) và IPA của mẫu', () => {
    const out = situationSentences('ordering')
    const p = findPattern('ordering-03')!
    const s = out.find((x) => x.key === 'ordering-03')!
    expect(s.en).toBe(fillPattern(p, 0).en)
    expect(s.vi).toBe(fillPattern(p, 0).vi)
    expect(s.ipa).toBe(p.ipa)
    expect(s.en).not.toContain('{')
    expect(out).toHaveLength(findSituation('ordering')!.patterns.length)
  })
  it('tình huống lạ → greetings', () => {
    expect(situationSentences('nope')[0].key).toBe('greetings-01')
  })
})

describe('resolveSource', () => {
  it('?pattern chọn sẵn đúng câu trong tình huống của nó', () => {
    const src = resolveSource(lessons, items, { pattern: 'ordering-03' })
    expect(src.kind).toBe('patterns')
    expect(src.situationId).toBe('ordering')
    expect(sourceSentences(src, items)[src.index].key).toBe('ordering-03')
    // Vẫn nhớ buổi gần nhất để đổi nguồn.
    expect(src.lessonId).toBe('L3')
  })
  it('?lesson chọn đúng buổi', () => {
    const src = resolveSource(lessons, items, { lesson: 'L1' })
    expect(src).toMatchObject({ kind: 'lesson', lessonId: 'L1', index: 0 })
  })
  it('?item chọn buổi của item và đúng câu', () => {
    const src = resolveSource(lessons, items, { item: 'w1' })
    expect(src.kind).toBe('lesson')
    expect(src.lessonId).toBe('L3')
    expect(sourceSentences(src, items)[src.index].key).toBe('w1')
  })
  it('?item không thuộc buổi nhưng có pattern_id → mẫu câu', () => {
    const src = resolveSource(lessons, items, { item: 'pi' })
    expect(src).toMatchObject({ kind: 'patterns', situationId: 'ordering' })
    expect(sourceSentences(src, items)[src.index].key).toBe('ordering-03')
  })
  it('mặc định: buổi gần nhất (date desc)', () => {
    expect(resolveSource(lessons, items, {})).toMatchObject({ kind: 'lesson', lessonId: 'L3', index: 0 })
  })
  it('tham số không hợp lệ → mặc định', () => {
    expect(resolveSource(lessons, items, { pattern: 'x-99', lesson: 'nope', item: 'nope' })).toMatchObject({
      kind: 'lesson',
      lessonId: 'L3',
    })
  })
  it('không có buổi nào → Mẫu câu greetings', () => {
    expect(resolveSource([], [], {})).toEqual({ kind: 'patterns', lessonId: null, situationId: 'greetings', index: 0 })
  })
})

describe('lessonSourceLabel', () => {
  it('buổi mới nhất → "Buổi gần nhất", buổi khác → "Buổi {n}"', () => {
    expect(lessonSourceLabel(lessons, 'L3')).toBe('Buổi gần nhất')
    expect(lessonSourceLabel(lessons, 'L1')).toBe('Buổi 1')
  })
})

describe('(T20) ngôn ngữ', () => {
  // Buổi zh mới hơn mọi buổi en; buổi ja cũ nhất.
  const multi = [...lessons, lesson('Z1', 4, '2026-11-09', 'zh'), lesson('J1', 5, '2026-10-01', 'ja')]
  const multiItems = [...items, item('z1', 'Z1', 'phrase', 0, { en: '你好' }), item('j1', 'J1', 'phrase', 0, { en: 'こんにちは' })]

  it('lessonSentences gán language (mặc định en)', () => {
    expect(lessonSentences(items, 'L3').every((s) => s.language === 'en')).toBe(true)
    expect(lessonSentences(multiItems, 'Z1', 'zh')[0]).toMatchObject({ key: 'z1', language: 'zh' })
  })
  it('sourceSentences lấy ngôn ngữ của buổi; không truyền lessons → en', () => {
    const src = { kind: 'lesson' as const, lessonId: 'Z1', situationId: 'greetings', index: 0 }
    expect(sourceSentences(src, multiItems, multi)[0].language).toBe('zh')
    expect(sourceSentences(src, multiItems)[0].language).toBe('en')
  })
  it('situationSentences: tình huống en → language en', () => {
    expect(situationSentences('ordering').every((s) => s.language === 'en')).toBe(true)
  })
  it('filter all → buổi mới nhất mọi ngôn ngữ (như cũ)', () => {
    expect(resolveSource(multi, multiItems, {})).toMatchObject({ kind: 'lesson', lessonId: 'Z1' })
    expect(resolveSource(multi, multiItems, {}, 'all')).toMatchObject({ kind: 'lesson', lessonId: 'Z1' })
  })
  it('filter en/ja → buổi mới nhất trong ngôn ngữ đó', () => {
    expect(resolveSource(multi, multiItems, {}, 'en')).toMatchObject({ kind: 'lesson', lessonId: 'L3' })
    expect(resolveSource(multi, multiItems, {}, 'ja')).toMatchObject({ kind: 'lesson', lessonId: 'J1' })
  })
  it('filter ko không có buổi → Mẫu câu với tình huống ko đầu tiên (ko-greetings)', () => {
    const src = resolveSource(multi, multiItems, {}, 'ko')
    expect(src).toMatchObject({ kind: 'patterns', lessonId: null, situationId: 'ko-greetings', index: 0 })
    expect(sourceSentences(src, multiItems, multi).every((x) => x.language === 'ko')).toBe(true)
  })
  it('tình huống mặc định: all → greetings; ngôn ngữ cụ thể → tình huống đầu tiên của ngôn ngữ đó', () => {
    expect(defaultSituationFor('all')).toBe('greetings')
    expect(defaultSituationFor('en')).toBe('greetings')
    expect(defaultSituationFor('zh')).toBe('zh-greetings')
    expect(defaultSituationFor('ja')).toBe('ja-greetings')
    expect(defaultSituationFor('ko')).toBe('ko-greetings')
    expect(findSituation(defaultSituationFor('zh'))?.language).toBe('zh')
  })
  it('?pattern của bộ khởi đầu → tình huống đó, câu mang ngôn ngữ tình huống', () => {
    const src = resolveSource([], [], { pattern: 'ja-restaurant-03' })
    expect(src).toMatchObject({ kind: 'patterns', situationId: 'ja-restaurant', index: 2 })
    const sentences = situationSentences('ja-restaurant')
    expect(sentences).toHaveLength(5)
    expect(sentences.every((x) => x.language === 'ja')).toBe(true)
    expect(sentences[2].ipa).toBe(findPattern('ja-restaurant-03')?.ipa)
  })
  it('?lesson/?item/?pattern bỏ qua bộ lọc', () => {
    expect(resolveSource(multi, multiItems, { lesson: 'L1' }, 'zh')).toMatchObject({ kind: 'lesson', lessonId: 'L1' })
    expect(resolveSource(multi, multiItems, { item: 'w1' }, 'ja')).toMatchObject({ kind: 'lesson', lessonId: 'L3' })
    const p = resolveSource(multi, multiItems, { pattern: 'ordering-03' }, 'zh')
    expect(p).toMatchObject({ kind: 'patterns', situationId: 'ordering', lessonId: 'Z1' })
  })
  it('lessonSourceLabel theo bộ lọc', () => {
    expect(lessonSourceLabel(multi, 'L3')).toBe('Buổi 3')
    expect(lessonSourceLabel(multi, 'L3', 'en')).toBe('Buổi gần nhất')
  })
})
