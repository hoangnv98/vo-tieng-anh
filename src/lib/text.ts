import type { Language } from '../domain/types'

/** Dấu câu bỏ đi với mọi ngôn ngữ: ASCII/typographic (trước T20) + CJK/fullwidth (T20). */
const PUNCTUATION = /[.,!?;:'"’“”\-。、，！？；：「」『』（）《》・～]/g

/**
 * Chuẩn hoá câu trả lời để so khớp (4.7): NFC, lowercase, ’ → ', bỏ dấu câu, gộp khoảng trắng, trim.
 * `zh`/`ja` không có ranh giới từ → bỏ hết khoảng trắng; `en`/`ko` giữ một khoảng trắng giữa các từ.
 * Khoảng trắng fullwidth (U+3000) được coi như khoảng trắng thường (`\s` đã gồm U+3000).
 */
export function normalizeAnswer(s: string, language: Language = 'en'): string {
  const collapsed = s
    .normalize('NFC')
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(PUNCTUATION, '')
    .replace(/\s+/g, ' ')
    .trim()
  return language === 'zh' || language === 'ja' ? collapsed.replace(/ /g, '') : collapsed
}

/** Khoảng cách Levenshtein theo code point (ký tự ngoài BMP như '𠀋' tính là 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const x = Array.from(a)
  const y = Array.from(b)
  if (x.length === 0) return y.length
  if (y.length === 0) return x.length
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j)
  for (let i = 1; i <= x.length; i++) {
    const cur = [i]
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[y.length]
}

/** So khớp gợi ý (không tự chấm). close khi Levenshtein ≤ max(1, floor(len/8)), len tính theo code point. */
export function compareAnswer(input: string, expected: string, language: Language = 'en'): 'exact' | 'close' | 'wrong' {
  const a = normalizeAnswer(input, language)
  const b = normalizeAnswer(expected, language)
  if (a === b) return 'exact'
  if (a === '' || b === '') return 'wrong'
  const threshold = Math.max(1, Math.floor(Array.from(b).length / 8))
  return levenshtein(a, b) <= threshold ? 'close' : 'wrong'
}
