import type { Kind, Language } from './types'

/** Số dòng không trống tối đa cho mỗi lần dán (6.13-A). */
export const PASTE_MAX_LINES = 100

export interface ParsedRow {
  kind: Kind
  en: string
  vi: string
  ipa: string
  note: string
  /** Số dòng gốc, 1-based (tính cả dòng trống). */
  line: number
}

export interface PasteResult {
  rows: ParsedRow[]
  /** Số dòng không trống. */
  total: number
  /** Số hàng chưa có nghĩa tiếng Việt. */
  missingVi: number
  tooMany: boolean
}

/** Dấu tách thử theo thứ tự; dấu nào xuất hiện sớm nhất trong dòng thì được chọn. */
const SEPARATORS: RegExp[] = [
  /\s+-\s+/, // " - "
  /\s+[–—]\s+/, // " – " / " — "
  /\t+/,
  /\s*\|\s*/,
  /:(?=\s|$)\s*/, // ":" chỉ khi sau đó là khoảng trắng/hết dòng ("8:30" không bị cắt)
]

const LEADING_NUMBER = /^\d{1,3}[.)](?!\d)\s*/
const LEADING_BULLET = /^[-•*–—]\s+/
const INLINE_IPA = /\s*\/[^/]+\/$/

/**
 * Suy loại mục, không bao giờ trả pattern.
 * `en`/`ko`: 1 từ (tách khoảng trắng, sau khi bỏ dấu câu đầu/cuối) → word, còn lại → phrase.
 * `zh`/`ja` (T20, không có ranh giới từ): đếm ký tự chữ/số; ≤ 3 → word, còn lại → phrase.
 */
export function inferKind(en: string, language: Language = 'en'): Kind {
  if (language === 'zh' || language === 'ja') {
    const letters = en.match(/[\p{L}\p{N}]/gu)?.length ?? 0
    return letters <= 3 ? 'word' : 'phrase'
  }
  const tokens = en
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .split(/\s+/)
    .filter(Boolean)
  return tokens.length === 1 ? 'word' : 'phrase'
}

/** Tách tối đa `maxParts` phần theo dấu tách xuất hiện sớm nhất; phần dư nối vào phần cuối. */
function splitParts(line: string, maxParts: number): string[] {
  let best: { re: RegExp; index: number } | null = null
  for (const re of SEPARATORS) {
    const m = re.exec(line)
    if (m && (best === null || m.index < best.index)) best = { re, index: m.index }
  }
  if (!best) return [line]
  const g = new RegExp(best.re.source, 'g')
  const parts: string[] = []
  let start = 0
  for (let m = g.exec(line); m && parts.length < maxParts - 1; m = g.exec(line)) {
    parts.push(line.slice(start, m.index))
    start = m.index + m[0].length
  }
  parts.push(line.slice(start))
  return parts
}

/**
 * Tách văn bản dán (mỗi dòng một mục) thành các hàng mục. Thuần, không phụ thuộc React/repo.
 * `en`: thuật toán 6.13 (3)-A. `zh`/`ja`/`ko` (T20, 6.14 (3)-E): câu – nghĩa – phiên âm – ghi chú theo đúng thứ tự,
 * tối đa 4 phần, không cắt IPA liền `/…/`.
 */
export function parsePastedList(text: string, language: Language = 'en'): PasteResult {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map((raw, i) => ({ text: raw.trim(), line: i + 1 }))
    .filter((l) => l.text !== '')

  const total = lines.length
  if (total > PASTE_MAX_LINES) return { rows: [], total, missingVi: 0, tooMany: true }

  const rows: ParsedRow[] = lines.flatMap(({ text: raw, line }) => {
    let s = raw
    if (LEADING_NUMBER.test(s)) s = s.replace(LEADING_NUMBER, '')
    else s = s.replace(LEADING_BULLET, '')
    s = s.trim()

    if (language !== 'en') {
      const [en = '', vi = '', ipa = '', note = ''] = splitParts(s, 4).map((p) => p.trim())
      if (!en && !vi && !ipa && !note) return []
      return [{ kind: inferKind(en, language), en, vi, ipa, note, line }]
    }

    const parts = splitParts(s, 3).map((p) => p.trim())
    let en = parts[0] ?? ''
    let vi = ''
    let ipa = ''
    let note = ''
    const [, p2, p3] = parts
    if (p2 !== undefined && p2.startsWith('/')) {
      ipa = p2
      vi = p3 ?? ''
    } else {
      vi = p2 ?? ''
      if (p3) {
        if (p3.startsWith('/')) ipa = p3
        else note = p3
      }
    }
    if (!ipa) {
      const m = INLINE_IPA.exec(en)
      if (m) {
        ipa = m[0].trim()
        en = en.slice(0, m.index).trim()
      }
    }
    if (!en && !vi && !ipa && !note) return []
    return [{ kind: inferKind(en), en, vi, ipa, note, line }]
  })

  return { rows, total, missingVi: rows.filter((r) => r.vi === '').length, tooMany: false }
}
