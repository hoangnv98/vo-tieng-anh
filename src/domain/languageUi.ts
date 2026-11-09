// (T20c) Câu chữ và quyết định giao diện theo ngôn ngữ học. Thuần, không React; không kéo data/patterns.
import { LANGUAGE_LABELS, LANGUAGE_SHORT, languageNameInSentence, lessonLanguage } from './languageCore'
import { defaultLessonLanguage } from './lessons'
import { LANGUAGES } from './types'
import type { Card, Item, Language, Lesson, StudyLanguageFilter } from './types'

/** Ngôn ngữ ban đầu của form buổi học: sửa → ngôn ngữ của buổi; tạo → quy tắc mặc định 6.6 (9). */
export function initialLessonLanguage(
  lesson: Pick<Lesson, 'language'> | undefined,
  lessons: readonly Lesson[],
  filter: StudyLanguageFilter,
): Language {
  return lesson ? lessonLanguage(lesson) : defaultLessonLanguage(lessons, filter)
}

/** Khoá đổi ngôn ngữ khi buổi có ít nhất một thẻ đã ôn (`reps > 0`) — 12.2 Q16. Buổi mới → không khoá. */
export function isLessonLanguageLocked(
  lessonId: string | undefined,
  items: readonly Pick<Item, 'id' | 'lesson_id'>[],
  cards: readonly Pick<Card, 'item_id' | 'reps'>[],
): boolean {
  if (!lessonId) return false
  const ids = new Set(items.filter((i) => i.lesson_id === lessonId).map((i) => i.id))
  return cards.some((c) => c.reps > 0 && ids.has(c.item_id))
}

export const LANGUAGE_LOCKED_TEXT = 'Buổi này đã có thẻ được ôn nên không đổi ngôn ngữ được.'

/** Mô tả dưới "Mục trong buổi". */
export function lessonItemsDescription(lang: Language): string {
  return `Mỗi mục sẽ thành một thẻ ôn ${LANGUAGE_SHORT[lang]} → Việt. Hai chiều còn lại mở sau khi bạn ôn thẻ đó ở hai ngày khác nhau.`
}

const PASTE_DESC_CJK =
  'Câu, nghĩa tiếng Việt và phiên âm cách nhau bằng dấu gạch ngang, dấu | hoặc tab. Phần thứ tư, nếu có, là ghi chú.'

export const PASTE_DESCRIPTION: Record<Language, string> = {
  en: 'Tiếng Anh và tiếng Việt cách nhau bằng dấu gạch ngang, dấu | hoặc tab. Phần thứ ba, nếu có, là phiên âm /…/ hoặc ghi chú.',
  zh: PASTE_DESC_CJK,
  ja: PASTE_DESC_CJK,
  ko: PASTE_DESC_CJK,
}

export const PASTE_PLACEHOLDER: Record<Language, string> = {
  en: 'Can I have the bill, please? - Cho tôi tính tiền\nbill - hoá đơn - /bɪl/',
  zh: '你好 - Xin chào - nǐ hǎo',
  ja: 'こんにちは - Xin chào - konnichiwa',
  ko: '안녕하세요 - Xin chào - annyeonghaseyo',
}

/** Dòng tình trạng giọng trong Cài đặt → Ngôn ngữ. */
export function voiceStatusLine(speakable: Record<Language, boolean>, webSpeech: boolean): string {
  if (!webSpeech) return 'Trình duyệt này không có giọng đọc.'
  const parts = LANGUAGES.map((l) => `${LANGUAGE_SHORT[l]} — ${speakable[l] ? 'có' : 'chưa có'}`)
  return `Giọng đọc trên thiết bị này: ${parts.join(' · ')}`
}

/** Hậu tố " · Tiếng Trung" khi đang lọc; Tất cả → ''. */
export function filterSuffix(filter: StudyLanguageFilter): string {
  return filter === 'all' ? '' : ` · ${LANGUAGE_LABELS[filter]}`
}

/** Hôm nay, khi lọc mà chưa có thẻ ngôn ngữ đó. */
export function noCardsInLanguageText(lang: Language): string {
  const name = languageNameInSentence(lang)
  return `Chưa có thẻ ${name} nào. Ghi buổi học hoặc thêm mẫu câu ${name}.`
}

/** Ôn thẻ, rỗng khi lọc. */
export function noDueInLanguageText(lang: Language): string {
  return `Không có thẻ ${languageNameInSentence(lang)} nào đến hạn.`
}

/** Câu "tạm ẩn thẻ nghe": thiếu Web Speech → câu cũ; có Web Speech nhưng thiếu giọng → câu T20. */
export function hiddenListenText(count: number, webSpeech: boolean): string {
  return webSpeech
    ? `Đã tạm ẩn ${count} thẻ nghe vì thiết bị chưa có giọng đọc phù hợp.`
    : `Đã tạm ẩn ${count} thẻ nghe vì trình duyệt không hỗ trợ đọc. Thử Chrome hoặc Edge.`
}

/** Mặt trước thẻ en_vi: "Nói to câu tiếng Trung rồi lật thẻ". */
export function sayAloudText(lang: Language): string {
  return `Nói to câu ${languageNameInSentence(lang)} rồi lật thẻ`
}
