// (T20) Phần thuần của domain/language.ts không phụ thuộc kho mẫu câu: nhãn, thẻ BCP-47, chuẩn hoá dữ liệu.
// Repository/domain nạp sớm (bundle chính) import từ đây để không kéo data/patterns vào bundle chính.
// Code UI dùng `domain/language.ts` (re-export toàn bộ file này).
import { LANGUAGES, STUDY_LANGUAGES } from './types'
import type { Direction, Language, Lesson, StudyLanguageFilter } from './types'

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'Tiếng Anh',
  zh: 'Tiếng Trung',
  ja: 'Tiếng Nhật',
  ko: 'Tiếng Hàn',
}

export const LANGUAGE_SHORT: Record<Language, string> = { en: 'Anh', zh: 'Trung', ja: 'Nhật', ko: 'Hàn' }

export const STUDY_LANGUAGE_LABELS: Record<StudyLanguageFilter, string> = { all: 'Tất cả', ...LANGUAGE_LABELS }

/** Thuộc tính HTML `lang` cho câu ngôn ngữ đích. */
export const LANG_TAG: Record<Language, string> = { en: 'en', zh: 'zh-Hans', ja: 'ja', ko: 'ko' }

/** Thuộc tính HTML `lang` cho phiên âm. */
export const ROMAN_TAG: Record<Language, string> = { en: 'en', zh: 'zh-Latn', ja: 'ja-Latn', ko: 'ko-Latn' }

/** BCP-47 cho SpeechSynthesisUtterance. */
export const TTS_TAG: Record<Language, string> = { en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' }

export const TARGET_PLACEHOLDER: Record<Language, string> = {
  en: 'Can I have the bill, please?',
  zh: '你好',
  ja: 'こんにちは',
  ko: '안녕하세요',
}

export const IPA_PLACEHOLDER: Record<Language, string> = {
  en: '/kæn aɪ hæv ðə bɪl/',
  zh: 'nǐ hǎo',
  ja: 'konnichiwa',
  ko: 'annyeonghaseyo',
}

const LANGUAGE_SET: ReadonlySet<unknown> = new Set<unknown>(LANGUAGES)
const STUDY_LANGUAGE_SET: ReadonlySet<unknown> = new Set<unknown>(STUDY_LANGUAGES)

export function isLanguage(x: unknown): x is Language {
  return LANGUAGE_SET.has(x)
}

/** Giá trị không hợp lệ (thiếu, null, mã lạ) → `fallback` (mặc định 'en' — dữ liệu trước T20). */
export function asLanguage(x: unknown, fallback: Language = 'en'): Language {
  return isLanguage(x) ? x : fallback
}

export function isStudyLanguage(x: unknown): x is StudyLanguageFilter {
  return STUDY_LANGUAGE_SET.has(x)
}

/** Không hợp lệ → 'all'. */
export function asStudyLanguage(x: unknown): StudyLanguageFilter {
  return isStudyLanguage(x) ? x : 'all'
}

/** Ngôn ngữ của buổi; buổi không tồn tại hoặc thiếu trường → 'en'. */
export function lessonLanguage(l: Pick<Lesson, 'language'> | undefined): Language {
  return asLanguage(l?.language)
}

/** "Trung → Việt" / "Việt → Trung" / "Nghe → gõ". */
export function directionLabel(d: Direction, lang: Language): string {
  const short = LANGUAGE_SHORT[lang]
  if (d === 'en_vi') return `${short} → Việt`
  if (d === 'vi_en') return `Việt → ${short}`
  return 'Nghe → gõ'
}

export function matchesFilter(lang: Language, filter: StudyLanguageFilter): boolean {
  return filter === 'all' || lang === filter
}

/** Tên ngôn ngữ đặt giữa câu: "tiếng Trung" (chữ "Tiếng" viết thường). */
export function languageNameInSentence(lang: Language): string {
  const name = LANGUAGE_LABELS[lang]
  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`
}

/** Dòng Info khi Web Speech có nhưng thiết bị chưa có giọng ngôn ngữ đó (6.14 (6)). */
export function missingVoiceText(lang: Language, tail = 'Bạn vẫn đọc được phiên âm.'): string {
  return `Thiết bị chưa có giọng ${languageNameInSentence(lang)}. ${tail}`
}
