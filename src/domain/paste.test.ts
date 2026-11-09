import { describe, expect, it } from 'vitest'
import { inferKind, parsePastedList, PASTE_MAX_LINES } from './paste'

const one = (t: string) => parsePastedList(t).rows[0]

describe('parsePastedList', () => {
  it('bỏ đánh số và tách ` - `', () => {
    expect(one('1. Can I have the bill, please? - Cho tôi tính tiền')).toMatchObject({
      kind: 'phrase',
      en: 'Can I have the bill, please?',
      vi: 'Cho tôi tính tiền',
      ipa: '',
      note: '',
    })
  })
  it('tab và IPA ở phần 2/3', () => {
    expect(one('bill\thoá đơn\t/bɪl/')).toMatchObject({ kind: 'word', en: 'bill', vi: 'hoá đơn', ipa: '/bɪl/' })
    expect(one('bill\t/bɪl/\thoá đơn')).toMatchObject({ en: 'bill', vi: 'hoá đơn', ipa: '/bɪl/' })
  })
  it('dấu | với phần 3 là ghi chú, check-in là 1 từ', () => {
    expect(one('check-in | làm thủ tục | quầy số 3')).toMatchObject({
      kind: 'word',
      en: 'check-in',
      vi: 'làm thủ tục',
      note: 'quầy số 3',
    })
  })
  it('IPA viết liền cuối EN, en dash', () => {
    expect(one('hello /həˈloʊ/ – xin chào')).toMatchObject({ en: 'hello', ipa: '/həˈloʊ/', vi: 'xin chào' })
  })
  it('em dash như en dash', () => {
    expect(one('Good morning — Chào buổi sáng')).toMatchObject({ en: 'Good morning', vi: 'Chào buổi sáng' })
  })
  it('"8:30" không bị cắt bởi dấu hai chấm', () => {
    expect(one("It's 8:30 - Bây giờ 8 giờ 30")).toMatchObject({ en: "It's 8:30", vi: 'Bây giờ 8 giờ 30' })
    expect(one("It's 8:30")).toMatchObject({ en: "It's 8:30", vi: '' })
  })
  it('dấu hai chấm có khoảng trắng sau thì tách', () => {
    expect(one('bill: hoá đơn')).toMatchObject({ en: 'bill', vi: 'hoá đơn' })
  })
  it('chỉ EN tính vào missingVi', () => {
    const r = parsePastedList('Where is the toilet?\nbill - hoá đơn')
    expect(r.rows[0]).toMatchObject({ en: 'Where is the toilet?', vi: '', kind: 'phrase' })
    expect(r.missingVi).toBe(1)
    expect(r.total).toBe(2)
  })
  it('gạch đầu dòng, giữ "-ed ending"', () => {
    expect(one('- -ed ending - đuôi -ed')).toMatchObject({ en: '-ed ending', vi: 'đuôi -ed' })
    expect(one('• apple - táo')).toMatchObject({ en: 'apple', vi: 'táo', kind: 'word' })
    expect(one('-ed')).toMatchObject({ en: '-ed' })
  })
  it('CRLF, NBSP, dòng trống và trim; line là số dòng gốc', () => {
    const r = parsePastedList('  a - b  \r\n\r\n\r\n 2) c d - e \r\n')
    expect(r.total).toBe(2)
    expect(r.rows[0]).toMatchObject({ en: 'a', vi: 'b', line: 1 })
    expect(r.rows[1]).toMatchObject({ en: 'c d', vi: 'e', line: 4 })
  })
  it('phần dư nối vào phần 3', () => {
    expect(one('a | b | c | d')).toMatchObject({ en: 'a', vi: 'b', note: 'c | d' })
  })
  it('101 dòng thì chặn', () => {
    const text = Array.from({ length: PASTE_MAX_LINES + 1 }, (_, i) => `w${i} - n${i}`).join('\n')
    expect(parsePastedList(text)).toEqual({ rows: [], total: 101, missingVi: 0, tooMany: true })
    const ok = Array.from({ length: PASTE_MAX_LINES }, (_, i) => `w${i} - n${i}`).join('\n')
    expect(parsePastedList(ok).tooMany).toBe(false)
  })
  it('bỏ dòng chỉ có số thứ tự nhưng total giữ nguyên', () => {
    const r = parsePastedList('1.\n2)\na - b')
    expect(r.total).toBe(3)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ en: 'a', line: 3 })
  })
  it('không cắt "1.5 kg"', () => {
    expect(one('1.5 kg - một cân rưỡi')).toMatchObject({ en: '1.5 kg', vi: 'một cân rưỡi' })
  })
  it('rỗng', () => {
    expect(parsePastedList('  \n\n')).toEqual({ rows: [], total: 0, missingVi: 0, tooMany: false })
  })
})

describe('inferKind', () => {
  it('1 token → word, còn lại → phrase', () => {
    expect(inferKind('bill')).toBe('word')
    expect(inferKind('"hello!"')).toBe('word')
    expect(inferKind('thank you')).toBe('phrase')
  })
})
