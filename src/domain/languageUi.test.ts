import { describe, expect, it } from 'vitest'
import { directionLabel } from './language'
import {
  filterSuffix,
  hiddenListenText,
  initialLessonLanguage,
  isLessonLanguageLocked,
  lessonItemsDescription,
  noCardsInLanguageText,
  noDueInLanguageText,
  PASTE_DESCRIPTION,
  PASTE_PLACEHOLDER,
  sayAloudText,
  voiceStatusLine,
} from './languageUi'
import type { Language, Lesson } from './types'

const T = '2026-11-09T00:00:00.000Z'

function lesson(id: string, number: number, date: string, language: Language = 'en'): Lesson {
  return { id, user_id: 'u', number, date, topic: 't', notes: '', questions: '', mistakes: '', language, created_at: T, updated_at: T }
}

describe('initialLessonLanguage (6.6 (9))', () => {
  const lessons = [lesson('a', 1, '2026-11-01', 'en'), lesson('b', 2, '2026-11-08', 'ja')]
  it('tạo buổi: bộ lọc zh → zh', () => {
    expect(initialLessonLanguage(undefined, lessons, 'zh')).toBe('zh')
  })
  it('tạo buổi: Tất cả + buổi gần nhất ja → ja', () => {
    expect(initialLessonLanguage(undefined, lessons, 'all')).toBe('ja')
  })
  it('tạo buổi: Tất cả + vở trống → en', () => {
    expect(initialLessonLanguage(undefined, [], 'all')).toBe('en')
  })
  it('sửa buổi: luôn là ngôn ngữ của buổi, bỏ qua bộ lọc', () => {
    expect(initialLessonLanguage(lesson('c', 3, '2026-11-02', 'ko'), lessons, 'zh')).toBe('ko')
    // dữ liệu trước T20 thiếu trường → en
    expect(initialLessonLanguage({} as Lesson, lessons, 'zh')).toBe('en')
  })
})

describe('isLessonLanguageLocked (12.2 Q16)', () => {
  const items = [
    { id: 'i1', lesson_id: 'L1' },
    { id: 'i2', lesson_id: 'L1' },
    { id: 'i3', lesson_id: 'L2' },
  ]
  it('buổi mới → không khoá', () => {
    expect(isLessonLanguageLocked(undefined, items, [{ item_id: 'i1', reps: 3 }])).toBe(false)
  })
  it('có thẻ nhưng chưa ôn (reps 0) → đổi được', () => {
    expect(isLessonLanguageLocked('L1', items, [{ item_id: 'i1', reps: 0 }, { item_id: 'i2', reps: 0 }])).toBe(false)
  })
  it('có ≥ 1 thẻ reps > 0 của buổi → khoá', () => {
    expect(isLessonLanguageLocked('L1', items, [{ item_id: 'i1', reps: 0 }, { item_id: 'i2', reps: 1 }])).toBe(true)
  })
  it('thẻ đã ôn của buổi khác không khoá buổi này', () => {
    expect(isLessonLanguageLocked('L1', items, [{ item_id: 'i3', reps: 5 }])).toBe(false)
  })
})

describe('câu chữ theo ngôn ngữ', () => {
  it('mô tả mục trong buổi', () => {
    expect(lessonItemsDescription('en')).toBe(
      'Mỗi mục sẽ thành một thẻ ôn Anh → Việt. Hai chiều còn lại mở sau khi bạn ôn thẻ đó ở hai ngày khác nhau.',
    )
    expect(lessonItemsDescription('zh')).toContain('thẻ ôn Trung → Việt.')
  })
  it('nhãn chiều thẻ theo ngôn ngữ (Ôn thẻ)', () => {
    expect(directionLabel('en_vi', 'zh')).toBe('Trung → Việt')
    expect(directionLabel('vi_en', 'ja')).toBe('Việt → Nhật')
    expect(directionLabel('en_vi', 'en')).toBe('Anh → Việt')
    expect(directionLabel('listen', 'ko')).toBe('Nghe → gõ')
  })
  it('dán danh sách: en giữ câu T18a, CJK câu mới + placeholder 1 dòng', () => {
    expect(PASTE_DESCRIPTION.en).toContain('Phần thứ ba, nếu có, là phiên âm /…/ hoặc ghi chú.')
    expect(PASTE_DESCRIPTION.ko).toBe(
      'Câu, nghĩa tiếng Việt và phiên âm cách nhau bằng dấu gạch ngang, dấu | hoặc tab. Phần thứ tư, nếu có, là ghi chú.',
    )
    expect(PASTE_PLACEHOLDER.ja).toBe('こんにちは - Xin chào - konnichiwa')
    expect(PASTE_PLACEHOLDER.zh.includes('\n')).toBe(false)
  })
  it('dòng tình trạng giọng', () => {
    expect(voiceStatusLine({ en: true, zh: true, ja: false, ko: true }, true)).toBe(
      'Giọng đọc trên thiết bị này: Anh — có · Trung — có · Nhật — chưa có · Hàn — có',
    )
    expect(voiceStatusLine({ en: true, zh: true, ja: true, ko: true }, false)).toBe('Trình duyệt này không có giọng đọc.')
  })
  it('Hôm nay / Ôn thẻ', () => {
    expect(filterSuffix('all')).toBe('')
    expect(filterSuffix('zh')).toBe(' · Tiếng Trung')
    expect(noCardsInLanguageText('zh')).toBe('Chưa có thẻ tiếng Trung nào. Ghi buổi học hoặc thêm mẫu câu tiếng Trung.')
    expect(noDueInLanguageText('ja')).toBe('Không có thẻ tiếng Nhật nào đến hạn.')
    expect(hiddenListenText(2, true)).toBe('Đã tạm ẩn 2 thẻ nghe vì thiết bị chưa có giọng đọc phù hợp.')
    expect(hiddenListenText(2, false)).toBe('Đã tạm ẩn 2 thẻ nghe vì trình duyệt không hỗ trợ đọc. Thử Chrome hoặc Edge.')
    expect(sayAloudText('en')).toBe('Nói to câu tiếng Anh rồi lật thẻ')
    expect(sayAloudText('ko')).toBe('Nói to câu tiếng Hàn rồi lật thẻ')
  })
})
