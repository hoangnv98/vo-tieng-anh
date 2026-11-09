import { fillPattern, findPattern, findSituation, situationOfPattern, SITUATIONS } from '../data/patterns'
import { sortLessons } from '../domain/lessons'
import type { Item, Kind, Lesson } from '../domain/types'

/** Danh sách câu tối đa (6.9 quy tắc 5). */
export const MAX_SENTENCES = 50
export const DEFAULT_SITUATION = 'greetings'

export interface ShadowSentence {
  /** Khoá ổn định trong danh sách: id item hoặc id mẫu câu. */
  key: string
  en: string
  vi: string
  ipa: string
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

/** Items của buổi: `phrase`/`pattern` trước, `word` sau; giữ thứ tự `position`; tối đa 50. */
export function lessonSentences(items: readonly Item[], lessonId: string | null): ShadowSentence[] {
  if (!lessonId) return []
  return items
    .filter((i) => i.lesson_id === lessonId && i.en.trim() !== '')
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.position - b.position)
    .slice(0, MAX_SENTENCES)
    .map((i) => ({ key: i.id, en: i.en, vi: i.vi, ipa: i.ipa }))
}

/** Câu của một tình huống: `fillPattern(p, 0)`, IPA của mẫu. */
export function situationSentences(situationId: string): ShadowSentence[] {
  const s = findSituation(situationId) ?? findSituation(DEFAULT_SITUATION) ?? SITUATIONS[0]
  if (!s) return []
  return s.patterns.slice(0, MAX_SENTENCES).map((p) => {
    const { en, vi } = fillPattern(p, 0)
    return { key: p.id, en, vi, ipa: p.ipa }
  })
}

export function latestLesson(lessons: readonly Lesson[]): Lesson | undefined {
  return sortLessons(lessons)[0]
}

function fromPattern(patternId: string, fallbackLesson: string | null): ShadowSource | null {
  if (!findPattern(patternId)) return null
  const situationId = situationOfPattern(patternId) ?? DEFAULT_SITUATION
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
 */
export function resolveSource(lessons: readonly Lesson[], items: readonly Item[], params: SourceParams): ShadowSource {
  const latest = latestLesson(lessons)?.id ?? null

  if (params.pattern) {
    const src = fromPattern(params.pattern, latest)
    if (src) return src
  }

  if (params.item) {
    const item = items.find((i) => i.id === params.item)
    if (item?.lesson_id && lessons.some((l) => l.id === item.lesson_id)) {
      const index = Math.max(
        0,
        lessonSentences(items, item.lesson_id).findIndex((s) => s.key === item.id),
      )
      return { kind: 'lesson', lessonId: item.lesson_id, situationId: DEFAULT_SITUATION, index }
    }
    if (item?.pattern_id) {
      const src = fromPattern(item.pattern_id, latest)
      if (src) return src
    }
  }

  if (params.lesson && lessons.some((l) => l.id === params.lesson)) {
    return { kind: 'lesson', lessonId: params.lesson, situationId: DEFAULT_SITUATION, index: 0 }
  }

  if (latest) return { kind: 'lesson', lessonId: latest, situationId: DEFAULT_SITUATION, index: 0 }
  return { kind: 'patterns', lessonId: null, situationId: DEFAULT_SITUATION, index: 0 }
}

/** Câu của nguồn đang chọn. */
export function sourceSentences(src: ShadowSource, items: readonly Item[]): ShadowSentence[] {
  return src.kind === 'lesson' ? lessonSentences(items, src.lessonId) : situationSentences(src.situationId)
}

/** Nhãn tab nguồn buổi: "Buổi gần nhất" nếu là buổi mới nhất, ngược lại "Buổi {n}". */
export function lessonSourceLabel(lessons: readonly Lesson[], lessonId: string | null): string {
  const lesson = lessons.find((l) => l.id === lessonId)
  if (!lesson || lesson.id === latestLesson(lessons)?.id) return 'Buổi gần nhất'
  return `Buổi ${lesson.number}`
}
