import { describe, expect, it } from 'vitest'
import {
  applyGrade,
  clampDuration,
  currentCardId,
  isFinished,
  progress,
  sessionDurationLabel,
  skipCurrent,
  skipMissing,
  startSession,
  timesShown,
} from './reviewSession'

describe('reviewSession', () => {
  it('bắt đầu ở thẻ đầu, timesShown = 1', () => {
    const s = startSession(['a', 'b'])
    expect(currentCardId(s)).toBe('a')
    expect(timesShown(s)).toBe(1)
    expect(progress(s)).toEqual({ i: 1, n: 2 })
    expect(isFinished(s)).toBe(false)
  })

  it('requeue đưa thẻ về cuối và tăng timesShown', () => {
    let s = startSession(['a', 'b'])
    s = applyGrade(s, { grade: 1, requeue: true, durationMs: 5000 })
    expect(s.queue).toEqual(['a', 'b', 'a'])
    expect(currentCardId(s)).toBe('b')
    expect(progress(s)).toEqual({ i: 2, n: 3 })
    s = applyGrade(s, { grade: 3, requeue: false, durationMs: 1000 })
    expect(currentCardId(s)).toBe('a')
    expect(timesShown(s)).toBe(2)
    s = applyGrade(s, { grade: 1, requeue: true, durationMs: 1000 })
    expect(currentCardId(s)).toBe('a')
    expect(timesShown(s)).toBe(3)
    expect(s.againCount).toBe(2)
  })

  it('không requeue → không nối thêm; kết thúc khi hết hàng đợi', () => {
    let s = startSession(['a'])
    s = applyGrade(s, { grade: 4, requeue: false, durationMs: 2000 })
    expect(currentCardId(s)).toBeNull()
    expect(isFinished(s)).toBe(true)
    expect(s.reviewed).toEqual(['a'])
    expect(progress(s)).toEqual({ i: 1, n: 1 })
  })

  it('đếm thẻ đã ôn theo id duy nhất', () => {
    let s = startSession(['a', 'b'])
    s = applyGrade(s, { grade: 1, requeue: true, durationMs: 0 })
    s = applyGrade(s, { grade: 3, requeue: false, durationMs: 0 })
    s = applyGrade(s, { grade: 3, requeue: false, durationMs: 0 })
    expect(isFinished(s)).toBe(true)
    expect(s.reviewed).toEqual(['a', 'b'])
  })

  it('hàng đợi rỗng không tính là "xong phiên"', () => {
    const s = startSession([])
    expect(currentCardId(s)).toBeNull()
    expect(isFinished(s)).toBe(false)
    expect(applyGrade(s, { grade: 3, requeue: false, durationMs: 0 })).toBe(s)
  })

  it('skipCurrent đi tiếp mà không tính đã ôn', () => {
    const s = skipCurrent(startSession(['a', 'b']))
    expect(currentCardId(s)).toBe('b')
    expect(s.reviewed).toEqual([])
    expect(s.seen).toEqual({})
  })

  it('skipMissing bỏ qua thẻ đã bị xoá, giữ nguyên khi thẻ còn', () => {
    const s = startSession(['a', 'b', 'c'])
    expect(skipMissing(s, () => true)).toBe(s)
    const t = skipMissing(s, (id) => id === 'c')
    expect(currentCardId(t)).toBe('c')
    expect(t.reviewed).toEqual([])
    expect(isFinished(skipMissing(s, () => false))).toBe(true)
  })

  it('cap thời lượng 60s và tính phút', () => {
    expect(clampDuration(90_000)).toBe(60_000)
    expect(clampDuration(-5)).toBe(0)
    expect(clampDuration(Number.NaN)).toBe(0)
    let s = startSession(['a', 'b', 'c'])
    expect(sessionDurationLabel(s)).toBe('<1 phút')
    s = applyGrade(s, { grade: 3, requeue: false, durationMs: 59_000 })
    expect(sessionDurationLabel(s)).toBe('<1 phút')
    s = applyGrade(s, { grade: 3, requeue: false, durationMs: 120_000 })
    expect(s.durationMs).toBe(119_000)
    expect(sessionDurationLabel(s)).toBe('2 phút')
  })
})
