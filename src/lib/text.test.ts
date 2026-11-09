import { describe, expect, it } from 'vitest'
import { compareAnswer, levenshtein, normalizeAnswer } from './text'

describe('normalizeAnswer', () => {
  it('bỏ dấu câu, lowercase', () => {
    expect(normalizeAnswer('Can I have the bill, please?')).toBe('can i have the bill please')
  })
  it('chuẩn hoá nháy cong và khoảng trắng', () => {
    expect(normalizeAnswer('  I’m   “fine” - thanks!  ')).toBe('im fine thanks')
    expect(normalizeAnswer("I'm fine")).toBe(normalizeAnswer('I’m fine'))
  })
})

describe('levenshtein', () => {
  it('tính đúng', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', 'abc')).toBe(0)
  })
})

describe('compareAnswer', () => {
  it('exact khi chỉ khác dấu câu/hoa thường', () => {
    expect(compareAnswer('can i have the bill please', 'Can I have the bill, please?')).toBe('exact')
  })
  it('close khi sai nhỏ', () => {
    expect(compareAnswer('Nice to met you', 'Nice to meet you')).toBe('close')
  })
  it('wrong khi khác nhiều', () => {
    expect(compareAnswer('See you later', 'Nice to meet you')).toBe('wrong')
  })
  it('input rỗng không bao giờ là close', () => {
    expect(compareAnswer('', 'I')).toBe('wrong')
    expect(compareAnswer('   ', 'Hi')).toBe('wrong')
  })
})
