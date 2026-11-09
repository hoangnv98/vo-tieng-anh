// (T20c) Nhóm tình huống mẫu câu theo ngôn ngữ cho /patterns và select "Tình huống" của Shadowing.
import { situationsOf, type Situation } from '../data/patterns'
import { LANGUAGES, type Language, type StudyLanguageFilter } from '../domain/types'

export interface SituationGroup {
  language: Language
  situations: Situation[]
}

/**
 * Một ngôn ngữ → đúng một nhóm (không heading); Tất cả → mỗi ngôn ngữ có tình huống một nhóm, theo thứ tự `LANGUAGES`,
 * trong nhóm giữ thứ tự seed.
 */
export function situationGroups(filter: StudyLanguageFilter, source: readonly Situation[] = situationsOf('all')): SituationGroup[] {
  const langs = filter === 'all' ? LANGUAGES : [filter]
  return langs
    .map((language) => ({ language, situations: source.filter((s) => s.language === language) }))
    .filter((g) => g.situations.length > 0)
}

/** Tên tình huống bằng ngôn ngữ đích (zh/ja/ko), hoặc tên tiếng Anh. */
export function situationTargetName(s: Pick<Situation, 'nameTarget' | 'nameEn'>): string {
  return s.nameTarget ?? s.nameEn
}

/**
 * Nhóm cho select "Tình huống" của Shadowing: như `situationGroups(filter)`, nhưng luôn chứa tình huống đang chọn
 * (nguồn mở bằng `?pattern=` bỏ qua bộ lọc) — thêm vào nhóm ngôn ngữ của nó, giữ thứ tự `LANGUAGES`.
 */
export function selectSituationGroups(
  filter: StudyLanguageFilter,
  currentId: string,
  source: readonly Situation[] = situationsOf('all'),
): SituationGroup[] {
  const groups = situationGroups(filter, source)
  if (groups.some((g) => g.situations.some((s) => s.id === currentId))) return groups
  const current = source.find((s) => s.id === currentId)
  if (!current) return groups
  const shown = new Set(groups.flatMap((g) => g.situations.map((s) => s.id)))
  shown.add(current.id)
  return situationGroups(
    'all',
    source.filter((s) => shown.has(s.id)),
  )
}
