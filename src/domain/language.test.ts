import { describe, expect, it } from 'vitest'
import {
  LANGUAGE_LABELS,
  STUDY_LANGUAGE_LABELS,
  asLanguage,
  asStudyLanguage,
  defaultLessonLanguage,
  directionLabel,
  isLanguage,
  isStudyLanguage,
  itemLanguageResolver,
  missingVoiceText,
  languageOfPattern,
  languagesInUse,
  latestLessonOf,
  lessonLanguage,
  matchesFilter,
} from './language'
import { DIRECTION_LABELS, DIRECTIONS, type Language, type Lesson } from './types'

const T = '2026-11-09T00:00:00.000Z'

function lesson(id: string, number: number, date: string, language?: Language): Lesson {
  const l = { id, user_id: 'u', number, date, topic: 't', notes: '', questions: '', mistakes: '', created_at: T, updated_at: T }
  // language thiếu = dữ liệu trước T20
  return (language === undefined ? l : { ...l, language }) as Lesson
}

describe('asLanguage / asStudyLanguage', () => {
  it('chuẩn hoá ngôn ngữ, mặc định en', () => {
    expect(asLanguage('zh')).toBe('zh')
    expect(asLanguage(undefined)).toBe('en')
    expect(asLanguage(null)).toBe('en')
    expect(asLanguage('fr')).toBe('en')
    expect(asLanguage('fr', 'ja')).toBe('ja')
    expect(isLanguage('ko')).toBe(true)
    expect(isLanguage('vi')).toBe(false)
    expect(isLanguage('all')).toBe(false)
  })

  it('bộ lọc không hợp lệ → all', () => {
    expect(asStudyLanguage('x')).toBe('all')
    expect(asStudyLanguage(undefined)).toBe('all')
    expect(asStudyLanguage('ja')).toBe('ja')
    expect(asStudyLanguage('all')).toBe('all')
    expect(isStudyLanguage('all')).toBe(true)
    expect(isStudyLanguage('fr')).toBe(false)
  })

  it('nhãn', () => {
    expect(LANGUAGE_LABELS.zh).toBe('Tiếng Trung')
    expect(STUDY_LANGUAGE_LABELS.all).toBe('Tất cả')
    expect(STUDY_LANGUAGE_LABELS.ko).toBe('Tiếng Hàn')
  })

  it('lessonLanguage: buổi thiếu trường hoặc không có buổi → en', () => {
    expect(lessonLanguage(undefined)).toBe('en')
    expect(lessonLanguage(lesson('a', 1, '2026-11-01'))).toBe('en')
    expect(lessonLanguage(lesson('a', 1, '2026-11-01', 'ja'))).toBe('ja')
  })
})

describe('directionLabel', () => {
  it('theo ngôn ngữ', () => {
    expect(directionLabel('en_vi', 'ko')).toBe('Hàn → Việt')
    expect(directionLabel('vi_en', 'zh')).toBe('Việt → Trung')
    expect(directionLabel('listen', 'ja')).toBe('Nghe → gõ')
  })

  it('en trùng DIRECTION_LABELS cũ', () => {
    for (const d of DIRECTIONS) expect(directionLabel(d, 'en')).toBe(DIRECTION_LABELS[d])
  })
})

describe('itemLanguageResolver', () => {
  const lessons = [lesson('Lzh', 1, '2026-11-01', 'zh'), lesson('Lold', 2, '2026-11-02')]

  it('item buổi → ngôn ngữ buổi; buổi cũ thiếu trường → en', () => {
    const langOf = itemLanguageResolver(lessons)
    expect(langOf({ lesson_id: 'Lzh', pattern_id: null })).toBe('zh')
    expect(langOf({ lesson_id: 'Lold', pattern_id: null })).toBe('en')
  })

  it('item thư viện → ngôn ngữ tình huống; item mồ côi → en', () => {
    const langOf = itemLanguageResolver(lessons)
    expect(langOf({ lesson_id: null, pattern_id: 'ja-restaurant-01' })).toBe('ja')
    expect(langOf({ lesson_id: null, pattern_id: 'zh-shopping-02' })).toBe('zh')
    expect(langOf({ lesson_id: null, pattern_id: 'ko-directions-05' })).toBe('ko')
    expect(langOf({ lesson_id: null, pattern_id: 'greetings-01' })).toBe('en')
    expect(langOf({ lesson_id: 'mat-roi', pattern_id: null })).toBe('en')
    expect(langOf({ lesson_id: null, pattern_id: 'khong-co' })).toBe('en')
    expect(langOf({ lesson_id: null, pattern_id: null })).toBe('en')
  })

  it('patternLanguage thay được kho mẫu câu (cho test)', () => {
    const fake = (id: string): Language | undefined => (id === 'tu-che-01' ? 'ko' : languageOfPattern(id))
    const langOf = itemLanguageResolver(lessons, fake)
    expect(langOf({ lesson_id: null, pattern_id: 'tu-che-01' })).toBe('ko')
    expect(langOf({ lesson_id: null, pattern_id: 'ja-greetings-01' })).toBe('ja')
  })

  it('kho thật: ngôn ngữ theo tình huống, không tồn tại → undefined', () => {
    expect(languageOfPattern('greetings-01')).toBe('en')
    expect(languageOfPattern('ja-restaurant-01')).toBe('ja')
    expect(languageOfPattern('zh-greetings-05')).toBe('zh')
    expect(languageOfPattern('ko-shopping-01')).toBe('ko')
    expect(languageOfPattern('khong-co-01')).toBeUndefined()
    expect(itemLanguageResolver([])({ lesson_id: null, pattern_id: 'greetings-01' })).toBe('en')
  })
})

describe('languagesInUse / latestLessonOf / defaultLessonLanguage / matchesFilter', () => {
  const lessons = [
    lesson('ko1', 1, '2026-11-01', 'ko'),
    lesson('en1', 2, '2026-11-02'),
    lesson('zh1', 3, '2026-11-03', 'zh'),
    lesson('ko2', 4, '2026-11-05', 'ko'),
  ]

  it('languagesInUse theo thứ tự LANGUAGES', () => {
    expect(languagesInUse(lessons)).toEqual(['en', 'zh', 'ko'])
    expect(languagesInUse([])).toEqual([])
  })

  it('latestLessonOf lọc sau khi sắp date desc, number desc', () => {
    expect(latestLessonOf(lessons, 'all')?.id).toBe('ko2')
    expect(latestLessonOf(lessons, 'zh')?.id).toBe('zh1')
    expect(latestLessonOf(lessons, 'en')?.id).toBe('en1')
    expect(latestLessonOf(lessons, 'ja')).toBeUndefined()
  })

  it('defaultLessonLanguage', () => {
    expect(defaultLessonLanguage(lessons, 'zh')).toBe('zh')
    expect(defaultLessonLanguage(lessons, 'ja')).toBe('ja')
    expect(defaultLessonLanguage(lessons, 'all')).toBe('ko')
    expect(defaultLessonLanguage([], 'all')).toBe('en')
  })

  it('matchesFilter', () => {
    expect(matchesFilter('zh', 'all')).toBe(true)
    expect(matchesFilter('zh', 'zh')).toBe(true)
    expect(matchesFilter('zh', 'en')).toBe(false)
  })
})

describe('missingVoiceText', () => {
  it('tên ngôn ngữ viết thường giữa câu; đuôi tuỳ chọn', () => {
    expect(missingVoiceText('zh')).toBe('Thiết bị chưa có giọng tiếng Trung. Bạn vẫn đọc được phiên âm.')
    expect(missingVoiceText('ja', 'Bạn vẫn có thể ghi âm và nghe lại.')).toBe(
      'Thiết bị chưa có giọng tiếng Nhật. Bạn vẫn có thể ghi âm và nghe lại.',
    )
  })
})
