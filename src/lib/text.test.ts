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

describe('(T20) normalizeAnswer / compareAnswer theo ngôn ngữ', () => {
  it('bỏ dấu câu CJK; zh/ja bỏ hết khoảng trắng; ko giữ', () => {
    expect(normalizeAnswer('你好，世界！', 'zh')).toBe('你好世界')
    expect(normalizeAnswer('こんにちは 。', 'ja')).toBe('こんにちは')
    expect(normalizeAnswer('「すみません」、駅はどこですか？', 'ja')).toBe('すみません駅はどこですか')
    expect(normalizeAnswer('안녕하세요. 반가워요', 'ko')).toBe('안녕하세요 반가워요')
    expect(normalizeAnswer('안녕하세요　반가워요', 'ko')).toBe('안녕하세요 반가워요')
  })

  it('NFC: Hangul tách rời (NFD) khớp Hangul tổ hợp', () => {
    expect(normalizeAnswer('한국어'.normalize('NFD'), 'ko')).toBe('한국어')
    expect(compareAnswer('한국어'.normalize('NFD'), '한국어', 'ko')).toBe('exact')
  })

  it('compareAnswer với zh', () => {
    expect(compareAnswer('你好世界', '你好，世界！', 'zh')).toBe('exact')
    expect(compareAnswer('你 好 世 界', '你好世界', 'zh')).toBe('exact')
    expect(compareAnswer('你好世', '你好世界', 'zh')).toBe('close')
    expect(compareAnswer('再见', '你好世界', 'zh')).toBe('wrong')
  })

  it('mặc định en không đổi hành vi', () => {
    expect(normalizeAnswer('  Can I  have the bill, please? ')).toBe('can i have the bill please')
    expect(compareAnswer('Can I have the bill please', 'Can I have the bill, please?')).toBe('exact')
  })

  it('Levenshtein theo code point', () => {
    expect('𠀋'.length).toBe(2)
    expect(levenshtein('𠀋', '')).toBe(1)
    expect(levenshtein('𠀋a', 'ba')).toBe(1)
    expect(levenshtein('a𠀋b', 'ab')).toBe(1)
    expect(compareAnswer('𠀋', '你', 'zh')).toBe('close')
  })
})
