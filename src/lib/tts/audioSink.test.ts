import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetAudioSink, isUnlocked, play, prime, SILENT_WAV, stop } from './audioSink'
import { FakeAudio, stubAudio } from './fakeAudio'

let urls: ReturnType<typeof stubAudio>
beforeEach(() => {
  _resetAudioSink()
  urls = stubAudio()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('audioSink', () => {
  it('prime() phát WAV im lặng đồng bộ, chỉ khi chưa unlocked', async () => {
    prime()
    const a = FakeAudio.instances[0]
    expect(a.src).toBe(SILENT_WAV)
    expect(a.play).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(isUnlocked()).toBe(true)
    prime()
    expect(a.play).toHaveBeenCalledTimes(1)
    expect(FakeAudio.instances).toHaveLength(1)
  })
  it('prime() bị từ chối → vẫn chưa unlocked, lần sau thử lại', async () => {
    FakeAudio.playImpl = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    prime()
    await Promise.resolve()
    await Promise.resolve()
    expect(isUnlocked()).toBe(false)
    prime()
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(2)
  })
  it('play() đặt src blob + playbackRate, resolve ở ended, revoke URL', async () => {
    const p = play(new Blob(['x']), 0.8)
    const a = FakeAudio.instances[0]
    expect(a.src).toBe('blob:fake/1')
    expect(a.playbackRate).toBe(0.8)
    expect(a.defaultPlaybackRate).toBe(0.8)
    expect(a.preservesPitch).toBe(true)
    expect(a.webkitPreservesPitch).toBe(true)
    a.playbackRate = 1
    a.onloadedmetadata?.()
    expect(a.playbackRate).toBe(0.8)
    a.onended?.()
    await expect(p).resolves.toBeUndefined()
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:fake/1')
  })
  it('NotAllowedError → TtsError autoplay', async () => {
    FakeAudio.playImpl = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    await expect(play(new Blob(['x']), 1)).rejects.toMatchObject({ kind: 'autoplay' })
  })
  it('stop() → pause, revoke, lượt đang phát resolve', async () => {
    const p = play(new Blob(['x']), 1)
    stop()
    await expect(p).resolves.toBeUndefined()
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled()
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:fake/1')
  })
})
