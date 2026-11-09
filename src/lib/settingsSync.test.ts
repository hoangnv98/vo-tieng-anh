import { describe, expect, it } from 'vitest'
import { shouldSyncField } from './settingsSync'

const trim = (v: string) => v.trim()

describe('shouldSyncField', () => {
  it('không ghi đè khi ô chỉ khác khoảng trắng cuối', () => {
    expect(shouldSyncField('Hoàng ', 'Hoàng', trim)).toBe(false)
  })
  it('ghi đè khi giá trị lưu thật sự khác', () => {
    expect(shouldSyncField('Hoàng', 'Lan', trim)).toBe(true)
  })
  it('so sánh số theo dạng chuẩn hoá', () => {
    const norm = (v: string) => String(Number(v))
    expect(shouldSyncField('015', '15', norm)).toBe(false)
    expect(shouldSyncField('20', '15', norm)).toBe(true)
  })
})
