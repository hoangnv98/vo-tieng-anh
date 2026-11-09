import { describe, expect, it } from 'vitest'
import { prepareText } from './text'

describe('prepareText', () => {
  it('bỏ *, gộp khoảng trắng', () => expect(prepareText('  I *get*   up\tearly. ', 'en')).toEqual(['I get up early.']))
  it('VI thay {slot} bằng …; EN giữ nguyên', () => {
    expect(prepareText('Tôi muốn {món}.', 'vi')).toEqual(['Tôi muốn ….'])
    expect(prepareText('I want {x}.', 'en')).toEqual(['I want {x}.'])
  })
  it('rỗng → không đoạn nào', () => expect(prepareText(' * \n ', 'vi')).toEqual([]))
  it('700 ký tự → ≤ 3 đoạn ≤ 300 tại ranh giới câu, không cắt giữa từ', () => {
    const sentence = `${'word '.repeat(19)}end.` // 99 ký tự
    const text = Array.from({ length: 7 }, () => sentence).join(' ')
    expect(text.length).toBeGreaterThanOrEqual(699)
    const chunks = prepareText(text, 'en')
    expect(chunks.length).toBeLessThanOrEqual(3)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(300)
      expect(c.endsWith('end.')).toBe(true)
    }
    expect(chunks.join(' ')).toBe(text)
  })
  it('tách theo dòng mới; câu quá dài cắt theo từ', () => {
    expect(prepareText('Một.\nHai!', 'vi')).toEqual(['Một. Hai!'])
    const long = 'abcdefghi '.repeat(40).trim() // 399 ký tự, không dấu câu
    const chunks = prepareText(long, 'en')
    expect(chunks.length).toBe(2)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(300)
      expect(c.split(' ').every((w) => w === 'abcdefghi')).toBe(true)
    }
  })
})
