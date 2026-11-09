/** Giới hạn cài đặt (6.11), khớp check constraint `settings` trong `supabase/schema.sql`. Dùng chung cho form và nhập JSON. */
export { isStudyLanguage } from './languageCore'

export interface IntRange {
  min: number
  max: number
  step: number
}

export const NAME_MAX = 40
export const GOAL: IntRange = { min: 5, max: 120, step: 5 }
export const NEW_CARDS: IntRange = { min: 5, max: 30, step: 1 }

/** Số nguyên trong [min, max] và đúng bước tính từ `min`. */
export function isIntInRange(v: unknown, r: IntRange): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= r.min && v <= r.max && (v - r.min) % r.step === 0
}
