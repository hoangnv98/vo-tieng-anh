import { fillPattern, findPattern, findSituation, firstSituationId, situationOfPattern, SITUATIONS } from '../data/patterns'
import { latestLessonOf, lessonLanguage } from '../domain/language'
import type { Item, Kind, Language, Lesson, StudyLanguageFilter } from '../domain/types'

/** Danh sách câu tối đa (6.9 quy tắc 5). */
export const MAX_SENTENCES = 50
export const DEFAULT_SITUATION = 'greetings'

export interface ShadowSentence {
  /** Khoá ổn định trong danh sách: id item hoặc id mẫu câu. */
  key: string
  en: string
  vi: string
  ipa: string
  /** (T20) Ngôn ngữ của câu: buổi → `lesson.language`; mẫu câu → ngôn ngữ tình huống. */
  language: Language
}

export type SourceKind = 'lesson' | 'patterns'

export interface ShadowSource {
  kind: SourceKind
  /** Buổi đang chọn (kind = 'lesson'); `null` khi không có buổi nào. */
  lessonId: string | null
  situationId: string
  /** Vị trí câu chọn sẵn trong danh sách của nguồn. */
  index: number
}

export interface SourceParams {
  lesson?: string | null
  item?: string | null
  pattern?: string | null
}

const KIND_ORDER: Record<Kind, number> = { phrase: 0, pattern: 0, word: 1 }

/**
 * Items của buổi: `phrase`/`pattern` trước, `word` sau; giữ thứ tự `position`; tối đa 50.
 * `language` = ngôn ngữ của buổi (mặc định 'en').
 */
export function lessonSentences(items: readonly Item[], lessonId: string | null, language: Language = 'en'): ShadowSentence[] {
  if (!lessonId) return []
  return items
    .filter((i) => i.lesson_id === lessonId && i.en.trim() !== '')
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.position - b.position)
    .slice(0, MAX_SENTENCES)
    .map((i) => ({ key: i.id, en: i.en, vi: i.vi, ipa: i.ipa, language }))
}

/** Câu của một tình huống: `fillPattern(p, 0)`, IPA của mẫu. */
export function situationSentences(situationId: string): ShadowSentence[] {
  const s = findSituation(situationId) ?? findSituation(DEFAULT_SITUATION) ?? SITUATIONS[0]
  if (!s) return []
  return s.patterns.slice(0, MAX_SENTENCES).map((p) => {
    const { en, vi } = fillPattern(p, 0)
    return { key: p.id, en, vi, ipa: p.ipa, language: s.language }
  })
}

/**
 * Tình huống mặc định của bộ lọc: 'all' → `greetings`; ngôn ngữ cụ thể → tình huống đầu tiên của ngôn ngữ đó
 * (`firstSituationId`; luôn có nhờ bộ khởi đầu zh/ja/ko).
 */
export function defaultSituationFor(filter: StudyLanguageFilter = 'all'): string {
  return filter === 'all' ? DEFAULT_SITUATION : firstSituationId(filter)
}

/** Buổi mới nhất trong ngôn ngữ lọc (mặc định 'all' = mọi buổi). */
export function latestLesson(lessons: readonly Lesson[], filter: StudyLanguageFilter = 'all'): Lesson | undefined {
  return latestLessonOf(lessons, filter)
}

function fromPattern(patternId: string, fallbackLesson: string | null, defaultSituation: string): ShadowSource | null {
  if (!findPattern(patternId)) return null
  const situationId = situationOfPattern(patternId) ?? defaultSituation
  const index = Math.max(
    0,
    situationSentences(situationId).findIndex((s) => s.key === patternId),
  )
  return { kind: 'patterns', lessonId: fallbackLesson, situationId, index }
}

/**
 * Chọn nguồn câu ban đầu (6.9 luồng):
 * `?pattern` → tình huống của mẫu, chọn sẵn mẫu; `?item` → buổi của item (hoặc mẫu của item), chọn sẵn item;
 * `?lesson` → buổi đó; mặc định buổi gần nhất; không có buổi nào → "Mẫu câu" với `greetings`.
 * (T20) `filter`: "buổi gần nhất" và tình huống mặc định lấy trong ngôn ngữ lọc; `?lesson/?item/?pattern`
 * bỏ qua bộ lọc (nguồn đã xác định).
 */
export function resolveSource(
  lessons: readonly Lesson[],
  items: readonly Item[],
  params: SourceParams,
  filter: StudyLanguageFilter = 'all',
): ShadowSource {
  const latest = latestLesson(lessons, filter)?.id ?? null
  const defaultSituation = defaultSituationFor(filter)

  if (params.pattern) {
    const src = fromPattern(params.pattern, latest, defaultSituation)
    if (src) return src
  }

  if (params.item) {
    const item = items.find((i) => i.id === params.item)
    if (item?.lesson_id && lessons.some((l) => l.id === item.lesson_id)) {
      const index = Math.max(
        0,
        lessonSentences(items, item.lesson_id).findIndex((s) => s.key === item.id),
      )
      return { kind: 'lesson', lessonId: item.lesson_id, situationId: defaultSituation, index }
    }
    if (item?.pattern_id) {
      const src = fromPattern(item.pattern_id, latest, defaultSituation)
      if (src) return src
    }
  }

  if (params.lesson && lessons.some((l) => l.id === params.lesson)) {
    return { kind: 'lesson', lessonId: params.lesson, situationId: defaultSituation, index: 0 }
  }

  if (latest) return { kind: 'lesson', lessonId: latest, situationId: defaultSituation, index: 0 }
  return { kind: 'patterns', lessonId: null, situationId: defaultSituation, index: 0 }
}

/** Câu của nguồn đang chọn; `lessons` để biết ngôn ngữ của buổi (thiếu → 'en'). */
export function sourceSentences(src: ShadowSource, items: readonly Item[], lessons: readonly Lesson[] = []): ShadowSentence[] {
  if (src.kind === 'patterns') return situationSentences(src.situationId)
  const language = lessonLanguage(lessons.find((l) => l.id === src.lessonId))
  return lessonSentences(items, src.lessonId, language)
}

/** Nhãn tab nguồn buổi: "Buổi gần nhất" nếu là buổi mới nhất (trong ngôn ngữ lọc), ngược lại "Buổi {n}". */
export function lessonSourceLabel(
  lessons: readonly Lesson[],
  lessonId: string | null,
  filter: StudyLanguageFilter = 'all',
): string {
  const lesson = lessons.find((l) => l.id === lessonId)
  if (!lesson || lesson.id === latestLesson(lessons, filter)?.id) return 'Buổi gần nhất'
  return `Buổi ${lesson.number}`
}
