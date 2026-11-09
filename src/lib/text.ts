/** Lowercase, chuẩn hoá ’ → ', bỏ dấu câu .,!?;:'"’“”-, gộp khoảng trắng, trim. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[.,!?;:'"’“”-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Khoảng cách Levenshtein theo ký tự. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[b.length]
}

/** So khớp gợi ý (không tự chấm). close khi Levenshtein ≤ max(1, floor(len/8)). */
export function compareAnswer(input: string, expected: string): 'exact' | 'close' | 'wrong' {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(expected)
  if (a === b) return 'exact'
  if (a === '' || b === '') return 'wrong'
  const threshold = Math.max(1, Math.floor(b.length / 8))
  return levenshtein(a, b) <= threshold ? 'close' : 'wrong'
}
