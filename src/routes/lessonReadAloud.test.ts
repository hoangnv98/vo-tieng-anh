import { describe, expect, it, vi } from 'vitest'
import { buildReadAloudSteps, plainSpeech, runReadAloud, type ReadAloudDeps } from './lessonReadAloud'

describe('buildReadAloudSteps', () => {
  const items = [
    { id: 'a', en: 'Hello', vi: 'Xin chào' },
    { id: 'b', en: '', vi: 'Chỉ có nghĩa' },
    { id: 'c', en: 'I *really* like it', vi: '  ' },
  ]
  it('đọc EN rồi VI theo thứ tự từng mục, bỏ mục trống, bỏ dấu *', () => {
    expect(buildReadAloudSteps(items, true)).toEqual([
      { itemId: 'a', lang: 'en', text: 'Hello' },
      { itemId: 'a', lang: 'vi', text: 'Xin chào' },
      { itemId: 'b', lang: 'vi', text: 'Chỉ có nghĩa' },
      { itemId: 'c', lang: 'en', text: 'I really like it' },
    ])
  })
  it('không có VI thì chỉ đọc tiếng Anh', () => {
    expect(buildReadAloudSteps(items, false).map((s) => s.lang)).toEqual(['en', 'en'])
  })
  it('plainSpeech gộp khoảng trắng, giữ xuống dòng', () => {
    expect(plainSpeech(' a *b*  x\n  c ')).toBe('a b x\nc')
  })
})

describe('runReadAloud', () => {
  const steps = buildReadAloudSteps(
    [
      { id: 'a', en: 'A', vi: 'a' },
      { id: 'b', en: 'B', vi: 'b' },
    ],
    true,
  )
  function deps(over: Partial<ReadAloudDeps> = {}) {
    const waits: number[] = []
    const spoken: string[] = []
    const d: ReadAloudDeps = {
      speak: async (s) => {
        spoken.push(s.text)
        return { interrupted: false }
      },
      isStopped: () => false,
      isTakenByOther: () => false,
      wait: async (ms) => {
        waits.push(ms)
      },
      ...over,
    }
    return { d, waits, spoken }
  }
  it('đọc hết, nghỉ 400 trong cùng mục và 600 giữa các mục', async () => {
    const { d, waits, spoken } = deps()
    expect(await runReadAloud(steps, 0, d)).toEqual({ status: 'done' })
    expect(spoken).toEqual(['A', 'a', 'B', 'b'])
    expect(waits).toEqual([400, 600, 400])
  })
  it('nghỉ dùng được với fake timers', async () => {
    vi.useFakeTimers()
    const spoken: string[] = []
    const { d } = deps({
      speak: async (s) => {
        spoken.push(s.text)
        return { interrupted: false }
      },
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    })
    const p = runReadAloud(steps, 0, d)
    await vi.advanceTimersByTimeAsync(0)
    expect(spoken).toEqual(['A'])
    await vi.advanceTimersByTimeAsync(399)
    expect(spoken).toEqual(['A'])
    await vi.advanceTimersByTimeAsync(1)
    expect(spoken).toEqual(['A', 'a'])
    await vi.advanceTimersByTimeAsync(2000)
    expect(await p).toEqual({ status: 'done' })
    vi.useRealTimers()
  })
  it('dừng giữa chừng', async () => {
    let stop = false
    const { d, spoken } = deps({
      speak: async (s) => {
        spoken.push(s.text)
        stop = true
        return { interrupted: false }
      },
      isStopped: () => stop,
    })
    expect(await runReadAloud(steps, 0, d)).toEqual({ status: 'stopped' })
    expect(spoken).toEqual(['A'])
  })
  it('speak báo interrupted thì dừng, không phát tiếp', async () => {
    const { d, spoken } = deps({
      speak: async (s) => {
        spoken.push(s.text)
        return { interrupted: true }
      },
    })
    expect(await runReadAloud(steps, 0, d)).toEqual({ status: 'interrupted' })
    expect(spoken).toEqual(['A'])
  })
  it('isTakenByOther true lúc bắt đầu vẫn đọc bước đầu', async () => {
    const { d, spoken } = deps({ isTakenByOther: () => true })
    expect(await runReadAloud(steps, 0, d)).toEqual({ status: 'interrupted' })
    expect(spoken).toEqual(['A'])
  })
  it('người dùng chiếm lượt trong lúc nghỉ thì không chiếm lại', async () => {
    let taken = false
    const { d, spoken } = deps({ wait: async () => void (taken = true), isTakenByOther: () => taken })
    expect(await runReadAloud(steps, 0, d)).toEqual({ status: 'interrupted' })
    expect(spoken).toEqual(['A'])
  })
  it('autoplay trả chỉ số bước dở; tiếp tục từ đó', async () => {
    const err = Object.assign(new Error('x'), { kind: 'autoplay' })
    const { d } = deps({ speak: (s) => (s.text === 'a' ? Promise.reject(err) : Promise.resolve({ interrupted: false })) })
    expect(await runReadAloud(steps, 0, d)).toEqual({ status: 'autoplay', index: 1 })
    const r = deps()
    expect(await runReadAloud(steps, 1, r.d)).toEqual({ status: 'done' })
    expect(r.spoken).toEqual(['a', 'B', 'b'])
  })
  it('lỗi khác thì dừng', async () => {
    const { d } = deps({ speak: () => Promise.reject(new Error('x')) })
    expect(await runReadAloud(steps, 0, d)).toEqual({ status: 'error' })
  })
})
