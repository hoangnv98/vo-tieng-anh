// (T20) Ngôn ngữ học: nhãn, thẻ BCP-47, chuẩn hoá dữ liệu và suy ngôn ngữ của item. Thuần, không React.
// Được phép import data/patterns để suy ngôn ngữ của item thư viện (SPEC 6.14 (3)-A).
// Phần không cần kho mẫu câu nằm ở ./languageCore (re-export dưới đây) để repository không kéo data/patterns.
import { languageOfPattern } from '../data/patterns'
import { lessonLanguage } from './languageCore'
import { LANGUAGES } from './types'
import type { Item, Language, Lesson } from './types'

export * from './languageCore'

/** Ngôn ngữ của một mẫu câu trong kho (= `Situation.language`); `undefined` nếu id không tồn tại. */
export { languageOfPattern }

type ItemRef = Pick<Item, 'lesson_id' | 'pattern_id'>

/**
 * Hàm suy ngôn ngữ của item (= ngôn ngữ của mọi thẻ của item, 6.14 (5).3):
 * có `lesson_id` và tìm thấy buổi → `lesson.language`; không có `lesson_id` mà có `pattern_id` → ngôn ngữ tình huống;
 * còn lại (item mồ côi, mẫu câu không còn trong kho) → 'en'.
 * `patternLanguage` chỉ để test thay kho mẫu câu; mặc định `languageOfPattern`.
 */
export function itemLanguageResolver(
  lessons: readonly Lesson[],
  patternLanguage: (patternId: string) => Language | undefined = languageOfPattern,
): (item: ItemRef) => Language {
  const byId = new Map(lessons.map((l) => [l.id, lessonLanguage(l)]))
  return (item) => {
    if (item.lesson_id != null) {
      const lang = byId.get(item.lesson_id)
      if (lang !== undefined) return lang
      return 'en'
    }
    if (item.pattern_id != null) return patternLanguage(item.pattern_id) ?? 'en'
    return 'en'
  }
}

/** Ngôn ngữ có ít nhất một buổi, theo thứ tự `LANGUAGES`. */
export function languagesInUse(lessons: readonly Lesson[]): Language[] {
  const used = new Set(lessons.map((l) => lessonLanguage(l)))
  return LANGUAGES.filter((l) => used.has(l))
}

// `latestLessonOf`/`defaultLessonLanguage` nằm ở lessons.ts (không cần kho mẫu câu); re-export để API không đổi.
export { defaultLessonLanguage, latestLessonOf } from './lessons'
