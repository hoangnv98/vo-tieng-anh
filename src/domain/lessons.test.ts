import { describe, expect, it } from 'vitest'
import {
  cardStatus,
  duplicateRows,
  isBlankItem,
  lessonCounts,
  nextLessonNumber,
  parseMarked,
  sortLessons,
  validateItem,
  validateLesson,
  type ItemInput,
  type LessonInput,
} from './lessons'
import type { Card, Item } from './types'

const TODAY = '2026-11-09'

const lessonInput = (over: Partial<LessonInput> = {}): LessonInput => ({
  number: '3',
  date: TODAY,
  topic: 'Ordering food',
  questions: '',
  mistakes: '',
  notes: '',
  ...over,
})

const itemInput = (over: Partial<ItemInput> = {}): ItemInput => ({
  kind: 'phrase',
  en: '',
  vi: '',
  ipa: '',
  note: '',
  ...over,
})

const ctx = { lessons: [{ id: 'a', number: 1 }, { id: 'b', number: 2 }], today: TODAY }

function item(id: string, lesson_id: string | null): Item {
  return {
    id, user_id: 'u', lesson_id, kind: 'phrase', en: id, vi: id, ipa: '', note: '',
    pattern_id: null, position: 0, created_at: '', updated_at: '',
  }
}

function card(over: Partial<Card>): Card {
  return {
    id: Math.random().toString(36), user_id: 'u', item_id: 'i', direction: 'en_vi',
    due: '2026-11-09T05:00:00.000Z', state: 2, reps: 1, lapses: 0, first_reviewed_at: null,
    suspended: false, fsrs: {}, created_at: '', updated_at: '', ...over,
  }
}

describe('nextLessonNumber', () => {
  it('1 khi chưa có buổi', () => expect(nextLessonNumber([])).toBe(1))
  it('max + 1, không phải length + 1', () => expect(nextLessonNumber([{ number: 2 }, { number: 7 }, { number: 3 }])).toBe(8))
})

describe('validateLesson', () => {
  it('hợp lệ → rỗng', () => expect(validateLesson(lessonInput(), ctx)).toEqual({}))

  it('số buổi ngoài 1–999 hoặc không phải số nguyên', () => {
    for (const number of ['0', '1000', '', 'abc', '2.5', '-1']) {
      expect(validateLesson(lessonInput({ number }), ctx).number).toBe('Số buổi phải từ 1 đến 999.')
    }
  })

  it('trùng số buổi, trừ chính nó', () => {
    expect(validateLesson(lessonInput({ number: '2' }), ctx).number).toBe('Đã có buổi số 2.')
    expect(validateLesson(lessonInput({ number: '2' }), { ...ctx, selfId: 'b' }).number).toBeUndefined()
  })

  it('ngày: rỗng, sai, quá hôm nay + 1', () => {
    expect(validateLesson(lessonInput({ date: '' }), ctx).date).toBe('Chọn ngày học.')
    expect(validateLesson(lessonInput({ date: '2026-02-30' }), ctx).date).toBe('Ngày không hợp lệ.')
    expect(validateLesson(lessonInput({ date: '2026-11-11' }), ctx).date).toBe('Ngày không hợp lệ.')
    expect(validateLesson(lessonInput({ date: '2026-11-10' }), ctx).date).toBeUndefined()
  })

  it('chủ đề bắt buộc, tối đa 80 sau trim', () => {
    expect(validateLesson(lessonInput({ topic: '   ' }), ctx).topic).toBe('Nhập chủ đề buổi học.')
    expect(validateLesson(lessonInput({ topic: 'x'.repeat(81) }), ctx).topic).toBe('Chủ đề tối đa 80 ký tự.')
    expect(validateLesson(lessonInput({ topic: ` ${'x'.repeat(80)} ` }), ctx).topic).toBeUndefined()
  })

  it('đúng biên: topic 80, questions 1000, mistakes 500, notes 2000 hợp lệ', () => {
    const e = validateLesson(
      lessonInput({ topic: 't'.repeat(80), questions: 'q'.repeat(1000), mistakes: 'm'.repeat(500), notes: 'n'.repeat(2000) }),
      ctx,
    )
    expect(e).toEqual({})
  })

  it('giới hạn questions/mistakes/notes', () => {
    const e = validateLesson(
      lessonInput({ questions: 'q'.repeat(1001), mistakes: 'm'.repeat(501), notes: 'n'.repeat(2001) }),
      ctx,
    )
    expect(e).toEqual({ questions: 'Tối đa 1000 ký tự.', mistakes: 'Tối đa 500 ký tự.', notes: 'Tối đa 2000 ký tự.' })
  })
})

describe('validateItem', () => {
  it('hàng trống hoàn toàn → không lỗi', () => {
    expect(isBlankItem(itemInput({ en: '  ' }))).toBe(true)
    expect(validateItem(itemInput())).toEqual({})
  })

  it('hàng trống nhưng bắt buộc (item đã lưu) → lỗi', () => {
    expect(validateItem(itemInput(), { required: true })).toEqual({ en: 'Nhập tiếng Anh.', vi: 'Nhập nghĩa tiếng Việt.' })
  })

  it('chỉ có EN → lỗi ở VI; chỉ có ghi chú → lỗi cả hai', () => {
    expect(validateItem(itemInput({ en: 'Hello' }))).toEqual({ vi: 'Nhập nghĩa tiếng Việt.' })
    expect(validateItem(itemInput({ vi: 'Xin chào' }))).toEqual({ en: 'Nhập tiếng Anh.' })
    expect(validateItem(itemInput({ note: 'x' }))).toEqual({ en: 'Nhập tiếng Anh.', vi: 'Nhập nghĩa tiếng Việt.' })
  })

  it('đúng biên: en/vi 200, ipa 120, note 200 hợp lệ', () => {
    expect(validateItem(itemInput({ en: 'a'.repeat(200), vi: 'b'.repeat(200), ipa: 'c'.repeat(120), note: 'd'.repeat(200) }))).toEqual({})
  })

  it('giới hạn độ dài', () => {
    const e = validateItem(itemInput({ en: 'a'.repeat(201), vi: 'b'.repeat(201), ipa: 'c'.repeat(121), note: 'd'.repeat(201) }))
    expect(e).toEqual({
      en: 'Tối đa 200 ký tự.',
      vi: 'Tối đa 200 ký tự.',
      ipa: 'Tối đa 120 ký tự.',
      note: 'Tối đa 200 ký tự.',
    })
  })
})

describe('duplicateRows', () => {
  it('so bằng normalizeAnswer, bỏ hàng rỗng', () => {
    const d = duplicateRows([{ en: 'Can I have the bill?' }, { en: '' }, { en: 'can i have the bill' }, { en: '' }, { en: 'Hi' }])
    expect([...d]).toEqual([[2, 0]])
  })
})

describe('parseMarked', () => {
  it('tách *từ*', () => {
    expect(parseMarked('quên âm cuối /t/ trong *get*, *it*')).toEqual([
      { text: 'quên âm cuối /t/ trong ', mark: false },
      { text: 'get', mark: true },
      { text: ', ', mark: false },
      { text: 'it', mark: true },
    ])
  })
  it('`**` rỗng không đánh dấu', () => {
    expect(parseMarked('a ** b')).toEqual([{ text: 'a ** b', mark: false }])
  })
  it('`*` không ghép qua xuống dòng', () => {
    expect(parseMarked('*get\nit*')).toEqual([{ text: '*get\nit*', mark: false }])
    expect(parseMarked('*a*\n*b*')).toEqual([
      { text: 'a', mark: true },
      { text: '\n', mark: false },
      { text: 'b', mark: true },
    ])
  })
  it('dấu * lẻ giữ nguyên', () => {
    expect(parseMarked('a * b')).toEqual([{ text: 'a * b', mark: false }])
  })
})

describe('sortLessons', () => {
  it('date desc, number desc', () => {
    const s = sortLessons([
      { date: '2026-11-01', number: 1 },
      { date: '2026-11-08', number: 3 },
      { date: '2026-11-08', number: 4 },
      { date: '2026-11-05', number: 9 },
    ])
    expect(s.map((l) => l.number)).toEqual([4, 3, 9, 1])
  })
})

describe('lessonCounts', () => {
  it('đếm mục và thẻ đến hạn theo buổi', () => {
    const items = [item('i1', 'L1'), item('i2', 'L1'), item('i3', 'L2'), item('p', null)]
    const cards = [
      card({ item_id: 'i1' }), // đến hạn
      card({ item_id: 'i1', direction: 'vi_en', state: 0 }), // mới: không tính
      card({ item_id: 'i2', due: '2026-11-09T16:59:59.999Z' }), // 23:59:59 VN → tính
      card({ item_id: 'i2', direction: 'listen', due: '2026-11-09T17:00:00.000Z' }), // ngày mai
      card({ item_id: 'i3', suspended: true }),
      card({ item_id: 'p' }),
    ]
    const c = lessonCounts(items, cards, TODAY)
    expect(c.get('L1')).toEqual({ items: 2, due: 2 })
    expect(c.get('L2')).toEqual({ items: 1, due: 0 })
    expect(c.size).toBe(2)
  })

  it('ttsSupported: false → bỏ thẻ listen đến hạn', () => {
    const items = [item('i1', 'L1')]
    const cards = [card({ item_id: 'i1' }), card({ item_id: 'i1', direction: 'listen' })]
    expect(lessonCounts(items, cards, TODAY).get('L1')?.due).toBe(2)
    expect(lessonCounts(items, cards, TODAY, { ttsSupported: false }).get('L1')?.due).toBe(1)
  })
})

describe('cardStatus', () => {
  it('mới / đang học / quên / đã thuộc', () => {
    expect(cardStatus(card({ state: 0 })).variant).toBe('new')
    expect(cardStatus(card({ state: 1, fsrs: { stability: 2 } })).variant).toBe('learning')
    expect(cardStatus(card({ state: 2, lapses: 2, fsrs: { stability: 5 } }))).toEqual({ variant: 'forgot', lapses: 2 })
    expect(cardStatus(card({ state: 2, fsrs: { stability: 21 } })).variant).toBe('mastered')
    expect(cardStatus(card({ state: 3, lapses: 1, fsrs: { stability: 30 } })).variant).toBe('forgot')
  })
})
