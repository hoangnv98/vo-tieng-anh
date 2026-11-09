export type Direction = 'en_vi' | 'vi_en' | 'listen'
export type Kind = 'word' | 'phrase' | 'pattern'
export type Grade = 1 | 2 | 3 | 4 // Again, Hard, Good, Easy (trùng ts-fsrs Rating)

/** (T20) Ngôn ngữ học. Giao diện luôn tiếng Việt; `vi` KHÔNG phải ngôn ngữ học. */
export type Language = 'en' | 'zh' | 'ja' | 'ko'
export const LANGUAGES = ['en', 'zh', 'ja', 'ko'] as const satisfies readonly Language[]
/** (T20) Bộ lọc "Ngôn ngữ đang học": một ngôn ngữ hoặc tất cả. */
export type StudyLanguageFilter = 'all' | Language
export const STUDY_LANGUAGES = ['all', 'en', 'zh', 'ja', 'ko'] as const satisfies readonly StudyLanguageFilter[]

export interface Lesson {
  id: string
  user_id: string
  number: number
  date: string /*YYYY-MM-DD*/
  topic: string
  notes: string
  questions: string
  mistakes: string
  /** (T20) Ngôn ngữ của buổi; dữ liệu cũ thiếu trường → 'en' khi đọc. */
  language: Language
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  user_id: string
  lesson_id: string | null
  kind: Kind
  /** Câu NGÔN NGỮ ĐÍCH (tên trường giữ nguyên vì lý do tương thích, xem SPEC 6.14 (5).2). */
  en: string
  vi: string
  /** Phiên âm: IPA (en), pinyin có dấu thanh (zh), romaji Hepburn hoặc kana (ja), Revised Romanization (ko). */
  ipa: string
  note: string
  pattern_id: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  user_id: string
  item_id: string
  direction: Direction
  due: string /*ISO*/
  state: 0 | 1 | 2 | 3
  reps: number
  lapses: number
  first_reviewed_at: string | null
  suspended: boolean
  fsrs: Record<string, unknown> /* card object ts-fsrs đã JSON hoá */
  created_at: string
  updated_at: string
}

export interface ReviewLogEntry {
  id: string
  user_id: string
  card_id: string
  rating: Grade
  reviewed_at: string
  duration_ms: number
  revlog: Record<string, unknown>
}

export interface StudyDay {
  user_id: string
  day: string
  seconds: number
  reviews: number
  shadowing_count: number
}

export interface Settings {
  user_id: string
  display_name: string
  daily_goal_min: number
  new_cards_per_day: number
  voice_name: string | null
  auto_speak: boolean
  /** (T20) Bộ lọc "Ngôn ngữ đang học", mặc định 'all'. */
  study_language: StudyLanguageFilter
}

export interface Snapshot {
  lessons: Lesson[]
  items: Item[]
  cards: Card[]
  studyDays: StudyDay[]
  settings: Settings
}

export const DIRECTIONS = ['en_vi', 'vi_en', 'listen'] as const satisfies readonly Direction[]
export const KINDS = ['word', 'phrase', 'pattern'] as const satisfies readonly Kind[]
export const GRADES = [1, 2, 3, 4] as const satisfies readonly Grade[]

export const GRADE_LABELS = {
  1: 'Quên',
  2: 'Khó',
  3: 'Nhớ',
  4: 'Dễ',
} as const satisfies Record<Grade, string>

/** Nhãn chiều cho tiếng Anh (= `directionLabel(d, 'en')` ở `domain/language.ts`); giữ cho code/test cũ. */
export const DIRECTION_LABELS = {
  en_vi: 'Anh → Việt',
  vi_en: 'Việt → Anh',
  listen: 'Nghe → gõ',
} as const satisfies Record<Direction, string>

export const KIND_LABELS = {
  word: 'Từ',
  phrase: 'Cụm',
  pattern: 'Mẫu câu',
} as const satisfies Record<Kind, string>
