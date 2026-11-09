import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetVoiceCache, cancel, getEnglishVoices, isCurrent, pickDefaultVoice, speak } from './speech'

const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice

let last: { onend?: () => void; onerror?: (e: unknown) => void } & Record<string, unknown>
const synth = { speaking: false, cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => [] as SpeechSynthesisVoice[]), addEventListener: vi.fn(), removeEventListener: vi.fn() }

beforeEach(() => {
  vi.useFakeTimers()
  _resetVoiceCache()
  synth.cancel.mockClear()
  synth.speak.mockClear()
  synth.addEventListener.mockClear()
  synth.removeEventListener.mockClear()
  synth.speaking = false
  synth.getVoices.mockReturnValue([])
  synth.speak.mockImplementation((u) => { last = u })
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(t: string) { this.text = t } })
  vi.stubGlobal('window', globalThis)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('pickDefaultVoice', () => {
  const list = [v('A', 'en-GB'), v('B', 'en-US'), v('C', 'en-AU')]
  it('ưu tiên tên đã lưu', () => expect(pickDefaultVoice(list, 'C')?.name).toBe('C'))
  it('rồi en-US', () => expect(pickDefaultVoice(list, 'Z')?.name).toBe('B'))
  it('rồi en-*', () => expect(pickDefaultVoice([v('A', 'en-GB')])?.name).toBe('A'))
  it('rỗng → undefined', () => expect(pickDefaultVoice([])).toBeUndefined())
})

describe('getEnglishVoices', () => {
  it('lọc en và chờ tối đa 1s', async () => {
    synth.getVoices.mockReturnValue([v('F', 'fr-FR')])
    const p = getEnglishVoices()
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toEqual([])
  })
})

describe('speak', () => {
  it('cancel trước, resolve ở onend', async () => {
    const p = speak({ text: 'hi', rate: 0.75 })
    expect(synth.cancel).toHaveBeenCalled()
    expect(last.lang).toBe('en-US')
    expect(last.rate).toBe(0.75)
    last.onend?.()
    await expect(p).resolves.toBeUndefined()
  })
  it('resolve khi interrupted', async () => {
    const p = speak({ text: 'hi' })
    last.onerror?.({ error: 'interrupted' })
    await expect(p).resolves.toBeUndefined()
  })
  it('reject lỗi khác', async () => {
    const p = speak({ text: 'hi' })
    last.onerror?.({ error: 'synthesis-failed' })
    await expect(p).rejects.toThrow('synthesis-failed')
  })
  it('timeout an toàn', async () => {
    let done = false
    const p = speak({ text: 'hi' }).then(() => { done = true })
    await vi.advanceTimersByTimeAsync(3199)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await p
    expect(done).toBe(true)
  })
  it('timeout theo rate', async () => {
    let done = false
    const p = speak({ text: 'hi', rate: 0.5 }).then(() => { done = true })
    await vi.advanceTimersByTimeAsync(3399)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await p
    expect(done).toBe(true)
  })
  it('timeout gia hạn khi còn speaking, không cancel', async () => {
    synth.speaking = true
    synth.cancel.mockClear()
    let done = false
    const p = speak({ text: 'hi' }).then(() => { done = true })
    synth.cancel.mockClear()
    await vi.advanceTimersByTimeAsync(3200 + 3000 * 3 - 100)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    await p
    expect(done).toBe(true)
    expect(synth.cancel).not.toHaveBeenCalled()
  })
  it('voiceName áp vào u.voice', () => {
    const B = v('B', 'en-GB')
    synth.getVoices.mockReturnValue([v('A', 'en-US'), B])
    void speak({ text: 'hi', voiceName: 'B' })
    expect(last.voice).toBe(B)
  })
  it('cancel trước speak và speak gọi đồng bộ', () => {
    void speak({ text: 'hi' })
    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(synth.cancel.mock.invocationCallOrder[0]).toBeLessThan(synth.speak.mock.invocationCallOrder[0])
  })
  it('timer cũ không cancel utterance mới', async () => {
    const a = speak({ text: 'a' })
    const first = last
    let doneB = false
    const b = speak({ text: 'b'.repeat(100) }).then(() => { doneB = true })
    await a
    synth.cancel.mockClear()
    await vi.advanceTimersByTimeAsync(3500)
    expect(synth.cancel).not.toHaveBeenCalled()
    expect(doneB).toBe(false)
    first.onend?.()
    expect(doneB).toBe(false)
    last.onend?.()
    await b
  })
})

describe('getEnglishVoices (thêm)', () => {
  it('voiceschanged resolve sớm và gỡ listener', async () => {
    const en = [v('A', 'en-US')]
    const p = getEnglishVoices()
    synth.getVoices.mockReturnValue(en)
    const handler = synth.addEventListener.mock.calls[0][1] as () => void
    handler()
    expect(await p).toEqual(en)
    expect(synth.removeEventListener).toHaveBeenCalledWith('voiceschanged', handler)
  })
  it('cache không giữ mảng rỗng', async () => {
    const p = getEnglishVoices()
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toEqual([])
    const en = [v('A', 'en-US')]
    synth.getVoices.mockReturnValue(en)
    expect(await getEnglishVoices()).toEqual(en)
  })
})

describe('owner', () => {
  it('cancel(A) không ảnh hưởng B', async () => {
    const A = {}
    const B = {}
    void speak({ text: 'a', owner: A })
    let doneB = false
    const pb = speak({ text: 'b', owner: B }).then(() => { doneB = true })
    expect(isCurrent(A)).toBe(false)
    expect(isCurrent(B)).toBe(true)
    synth.cancel.mockClear()
    cancel(A)
    expect(synth.cancel).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(doneB).toBe(false)
    cancel(B)
    await pb
    expect(doneB).toBe(true)
  })
  it('rate rất nhỏ được clamp 0.1', async () => {
    let done = false
    const p = speak({ text: 'hi', rate: 0 }).then(() => { done = true })
    await vi.advanceTimersByTimeAsync(2000 + 3000 - 1)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await p
  })
})
