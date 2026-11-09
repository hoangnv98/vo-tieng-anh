import { describe, expect, it } from 'vitest'
import {
  addDays,
  endOfLocalDay,
  formatDateVi,
  formatRelative,
  localDay,
  startOfLocalDay,
  weekdayIndexMondayFirst,
} from './dates'

describe('localDay', () => {
  it('23:59:59 giờ VN vẫn là ngày cũ', () => {
    expect(localDay(new Date('2026-11-09T16:59:59Z'))).toBe('2026-11-09')
  })
  it('00:00 giờ VN sang ngày mới', () => {
    expect(localDay(new Date('2026-11-09T17:00:00Z'))).toBe('2026-11-10')
  })
})

describe('addDays', () => {
  it('qua cuối tháng', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('qua cuối năm', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('startOfLocalDay / endOfLocalDay', () => {
  it('start là 00:00 giờ VN', () => {
    expect(startOfLocalDay('2026-11-09').toISOString()).toBe('2026-11-08T17:00:00.000Z')
  })
  it('end cách start của ngày kế đúng 1ms', () => {
    const diff = startOfLocalDay('2026-11-10').getTime() - endOfLocalDay('2026-11-09').getTime()
    expect(diff).toBe(1)
    expect(localDay(endOfLocalDay('2026-11-09'))).toBe('2026-11-09')
  })
})

describe('formatDateVi / weekdayIndexMondayFirst', () => {
  it('định dạng tiếng Việt, viết hoa chữ đầu', () => {
    expect(formatDateVi('2026-11-07')).toBe('Thứ Bảy, 7/11')
  })
  it('chỉ số thứ bắt đầu Thứ Hai', () => {
    expect(weekdayIndexMondayFirst('2026-11-09')).toBe(0) // Thứ Hai
    expect(weekdayIndexMondayFirst('2026-11-07')).toBe(5) // Thứ Bảy
    expect(weekdayIndexMondayFirst('2026-11-08')).toBe(6) // Chủ Nhật
  })
})

describe('formatRelative', () => {
  const MIN = 60_000
  const DAY = 86_400_000
  it('các mốc', () => {
    expect(formatRelative(0)).toBe('<10 phút')
    expect(formatRelative(9 * MIN)).toBe('<10 phút')
    expect(formatRelative(10 * MIN)).toBe('10 phút')
    expect(formatRelative(59 * MIN)).toBe('59 phút')
    expect(formatRelative(60 * MIN)).toBe('1 giờ')
    expect(formatRelative(5 * 60 * MIN)).toBe('5 giờ')
    expect(formatRelative(23 * 60 * MIN)).toBe('23 giờ')
    expect(formatRelative(DAY)).toBe('1 ngày')
    expect(formatRelative(3 * DAY)).toBe('3 ngày')
    expect(formatRelative(13 * DAY)).toBe('13 ngày')
    expect(formatRelative(14 * DAY)).toBe('2 tuần')
    expect(formatRelative(59 * DAY)).toBe('8 tuần')
    expect(formatRelative(60 * DAY)).toBe('2 tháng')
    expect(formatRelative(365 * DAY)).toBe('12 tháng')
  })
})
