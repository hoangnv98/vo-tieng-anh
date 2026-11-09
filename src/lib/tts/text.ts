import type { TtsLang } from './types'

export const MAX_CHUNK = 300

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Tách đoạn quá dài theo từ; một "từ" dài hơn `max` mới bị cắt cứng. */
function splitByWords(s: string, max: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const w of s.split(' ')) {
    if (!w) continue
    if (w.length > max) {
      if (cur) out.push(cur)
      cur = ''
      for (let i = 0; i < w.length; i += max) out.push(w.slice(i, i + max))
      continue
    }
    if (!cur) cur = w
    else if (cur.length + 1 + w.length <= max) cur += ` ${w}`
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  return out
}

/** Ngôn ngữ CJK: câu không có khoảng trắng sau dấu ngắt, mỗi câu là một đoạn riêng. */
export function isCjk(lang: TtsLang): boolean {
  return lang === 'zh' || lang === 'ja' || lang === 'ko'
}

/**
 * Chuẩn hoá văn bản trước khi đọc: bỏ `*` (cú pháp `*từ*`), mọi ngôn ngữ khác `en` thay `{slot}` bằng "…",
 * gộp khoảng trắng, chia theo dòng rồi theo `. ! ? ;` (và `。！？` không cần khoảng trắng sau),
 * gộp lại thành đoạn ≤ 300 ký tự. (T20) Với `zh/ja/ko` không gộp: mỗi câu một đoạn.
 */
export function prepareText(text: string, lang: TtsLang, max: number = MAX_CHUNK): string[] {
  let s = text.replace(/\*/g, '')
  if (lang !== 'en') s = s.replace(/\{[^{}]*\}/g, '…')
  const pieces: string[] = []
  for (const line of s.split(/\r?\n/)) {
    const l = clean(line)
    if (!l) continue
    for (const sentence of l.split(/(?<=[.!?;])\s+|(?<=[。！？])\s*/)) {
      const t = clean(sentence)
      if (!t) continue
      if (t.length <= max) pieces.push(t)
      else pieces.push(...splitByWords(t, max))
    }
  }
  if (isCjk(lang)) return pieces
  const chunks: string[] = []
  let cur = ''
  for (const p of pieces) {
    if (!cur) cur = p
    else if (cur.length + 1 + p.length <= max) cur += ` ${p}`
    else {
      chunks.push(cur)
      cur = p
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}
