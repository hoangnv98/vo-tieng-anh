import type { Kind } from './types'

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

/** 1 từ (sau khi bỏ dấu câu đầu/cuối) → word, còn lại → phrase. Không bao giờ trả pattern. */
export function inferKind(en: string): Kind {
  const tokens = en
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .split(/\s+/)
    .filter(Boolean)
  return tokens.length === 1 ? 'word' : 'phrase'
}

function splitParts(line: string): string[] {
  let best: { re: RegExp; index: number } | null = null
  for (const re of SEPARATORS) {
    const m = re.exec(line)
    if (m && (best === null || m.index < best.index)) best = { re, index: m.index }
  }
  if (!best) return [line]
  const g = new RegExp(best.re.source, 'g')
  const first = g.exec(line)
  if (!first) return [line]
  const second = g.exec(line)
  const p1 = line.slice(0, first.index)
  if (!second) return [p1, line.slice(first.index + first[0].length)]
  return [
    p1,
    line.slice(first.index + first[0].length, second.index),
    line.slice(second.index + second[0].length),
  ]
}

/** Tách văn bản dán (mỗi dòng một mục) thành các hàng mục. Thuần, không phụ thuộc React/repo. */
export function parsePastedList(text: string): PasteResult {
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

    const parts = splitParts(s).map((p) => p.trim())
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
