import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudyTimer, type TimerEnv } from './useStudyTimer'

function fakeEnv() {
  let visible = true
  const listeners = new Set<() => void>()
  const env: TimerEnv = {
    isVisible: () => visible,
    onHide(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  return {
    env,
    hide() {
      visible = false
      listeners.forEach((fn) => fn())
    },
    show() {
      visible = true
    },
    listenerCount: () => listeners.size,
  }
}

describe('createStudyTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    const e = fakeEnv()
    const onFlush = vi.fn<(s: number) => void>()
    const onSecond = vi.fn()
    const timer = createStudyTimer({ env: e.env, onFlush, onSecond })
    return { ...e, onFlush, onSecond, timer }
  }

  it('không đếm khi chưa active', () => {
    const { timer, onSecond, onFlush } = setup()
    vi.advanceTimersByTime(60_000)
    expect(onSecond).not.toHaveBeenCalled()
    timer.dispose()
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('gom và flush mỗi 30 giây, không gọi mỗi giây', () => {
    const { timer, onSecond, onFlush } = setup()
    timer.setActive(true)
    vi.advanceTimersByTime(29_000)
    expect(onSecond).toHaveBeenCalledTimes(29)
    expect(onFlush).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1_000)
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenLastCalledWith(30)
    vi.advanceTimersByTime(30_000)
    expect(onFlush).toHaveBeenCalledTimes(2)
    expect(onFlush).toHaveBeenLastCalledWith(30)
    timer.dispose()
  })

  it('flush phần lẻ khi ẩn tab và ngừng đếm khi tab ẩn', () => {
    const { timer, onSecond, onFlush, hide, show } = setup()
    timer.setActive(true)
    vi.advanceTimersByTime(12_000)
    hide()
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenLastCalledWith(12)
    vi.advanceTimersByTime(20_000)
    expect(onSecond).toHaveBeenCalledTimes(12)
    show()
    vi.advanceTimersByTime(5_000)
    expect(onSecond).toHaveBeenCalledTimes(17)
    timer.dispose()
    expect(onFlush).toHaveBeenCalledTimes(2)
    expect(onFlush).toHaveBeenLastCalledWith(5)
  })

  it('ẩn tab khi không có gì gom thì không ghi', () => {
    const { timer, onFlush, hide } = setup()
    timer.setActive(true)
    hide()
    expect(onFlush).not.toHaveBeenCalled()
    timer.dispose()
  })

  it('ngừng active thì flush; dispose flush phần còn lại và huỷ đăng ký', () => {
    const { timer, onFlush, listenerCount } = setup()
    timer.setActive(true)
    vi.advanceTimersByTime(7_000)
    timer.setActive(false)
    expect(onFlush).toHaveBeenLastCalledWith(7)
    vi.advanceTimersByTime(10_000)
    expect(onFlush).toHaveBeenCalledTimes(1)
    timer.setActive(true)
    vi.advanceTimersByTime(3_000)
    timer.dispose()
    expect(onFlush).toHaveBeenLastCalledWith(3)
    expect(listenerCount()).toBe(0)
    vi.advanceTimersByTime(10_000)
    expect(onFlush).toHaveBeenCalledTimes(2)
  })
})
