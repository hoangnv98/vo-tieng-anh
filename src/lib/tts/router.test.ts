import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetVoiceCache } from '../speech'
import { DEFAULT_TTS_CONFIG, type TtsConfig } from '../ttsConfig'
import { _resetAudioSink, audioSink } from './audioSink'
import { AudioCache } from './cache'
import { FakeAudio, stubAudio } from './fakeAudio'
import { OpenAiCompatibleProvider } from './openaiCompat'
import { TOAST_BUSY, TOAST_DOWN, TtsRouter } from './router'
import { fakeSink, hanging, status, wav } from './testUtils'
import { HEALTH_DOWN_TTL_MS, type SpeakHandle, type SpeakRequest, type TtsLang, type TtsProvider } from './types'
import { WebSpeechProvider } from './webSpeech'

let config: TtsConfig
let protocol: string
let webVi: boolean
let fetchMock: ReturnType<typeof vi.fn>
let notify: ReturnType<typeof vi.fn<(message: string) => void>>
const owner = {}

function fakeProvider(id: TtsProvider['id']) {
  return {
    id,
    supports: vi.fn((lang: TtsLang) => (id === 'web-speech' ? lang === 'en' || webVi : true)),
    speak: vi.fn((): SpeakHandle => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    probe: vi.fn(),
    listVoices: vi.fn(),
  } satisfies TtsProvider
}

function clone(): TtsConfig {
  return { v: 1, vi: { ...DEFAULT_TTS_CONFIG.vi }, en: { ...DEFAULT_TTS_CONFIG.en } }
}

beforeEach(() => {
  config = clone()
  protocol = 'http:'
  webVi = false
  notify = vi.fn<(message: string) => void>()
  fetchMock = vi.fn(() => Promise.resolve(wav()))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function fakeRouter() {
  const web = fakeProvider('web-speech')
  const servers = { vi: fakeProvider('server-vi'), en: fakeProvider('server-en') }
  const router = new TtsRouter({ web, servers, getConfig: () => config, pageProtocol: () => protocol, notify })
  return { router, web, servers }
}

/** Router với provider server thật (sink giả) + Web Speech giả. */
function realRouter() {
  const web = fakeProvider('web-speech')
  const sink = fakeSink()
  const cache = new AudioCache()
  const mk = (lang: TtsLang) =>
    new OpenAiCompatibleProvider(lang, () => config[lang], { cache, sink, pageProtocol: () => protocol })
  const router = new TtsRouter({ web, servers: { vi: mk('vi'), en: mk('en') }, getConfig: () => config, pageProtocol: () => protocol, notify })
  return { router, web, sink }
}
const req = (lang: TtsLang, text = 'Hello'): SpeakRequest => ({ text, lang, rate: 1, owner })

describe('resolve', () => {
  it("en: mặc định → web-speech; useServer → server-en; down hoặc blocked → web-speech", () => {
    const { router } = fakeRouter()
    expect(router.resolve('en')?.id).toBe('web-speech')
    config.en.useServer = true
    expect(router.resolve('en')?.id).toBe('server-en')
    router.markDown('en')
    expect(router.resolve('en')?.id).toBe('web-speech')
    router.setHealth('en', 'unknown')
    config.en.baseUrl = 'http://192.168.1.5:8880'
    protocol = 'https:'
    expect(router.resolve('en')?.id).toBe('web-speech')
    router._dispose()
  })
  it('vi: mặc định → null; enabled → server-vi; down → null; down + deviceFallback + giọng vi → web-speech', () => {
    const { router } = fakeRouter()
    expect(router.resolve('vi')).toBeNull()
    expect(router.canSpeak('vi')).toBe(false)
    config.vi.enabled = true
    expect(router.resolve('vi')?.id).toBe('server-vi')
    router.markDown('vi')
    expect(router.resolve('vi')).toBeNull()
    config.vi.deviceFallback = true
    expect(router.resolve('vi')).toBeNull() // thiết bị chưa có giọng vi
    webVi = true
    expect(router.resolve('vi')?.id).toBe('web-speech')
    router._dispose()
  })
  it('baseUrl không hợp lệ (thiếu scheme) → không dùng server', () => {
    const { router } = fakeRouter()
    config.en.useServer = true
    config.en.baseUrl = 'localhost:8880'
    expect(router.resolve('en')?.id).toBe('web-speech')
    config.vi.enabled = true
    config.vi.baseUrl = 'localhost:8000'
    expect(router.resolve('vi')).toBeNull()
  })
  it('chưa có notifier → không "tiêu" lượt toast', async () => {
    config.vi.enabled = true
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { router } = realRouter()
    router.setNotifier(undefined)
    await expect(router.speak(req('vi', 'a')).promise).rejects.toMatchObject({ kind: 'network' })
    router.setNotifier(notify)
    router.setHealth('vi', 'unknown')
    await expect(router.speak(req('vi', 'b')).promise).rejects.toMatchObject({ kind: 'network' })
    expect(notify).toHaveBeenCalledTimes(1)
    router._dispose()
  })
  it('vi + https public (Tailscale) không bị chặn', () => {
    const { router } = fakeRouter()
    protocol = 'https:'
    config.vi.enabled = true
    config.vi.baseUrl = 'https://laptop.tail1234.ts.net'
    expect(router.resolve('vi')?.id).toBe('server-vi')
  })
})

describe('health', () => {
  it('down tự về unknown sau 60 s và báo subscriber', () => {
    vi.useFakeTimers()
    const { router } = fakeRouter()
    const cb = vi.fn()
    router.subscribe(cb)
    router.markDown('vi')
    expect(router.getHealth('vi')).toBe('down')
    vi.advanceTimersByTime(HEALTH_DOWN_TTL_MS - 1)
    expect(router.getHealth('vi')).toBe('down')
    vi.advanceTimersByTime(1)
    expect(router.getHealth('vi')).toBe('unknown')
    expect(cb).toHaveBeenCalledTimes(2)
  })
})

describe('speak + fallback', () => {
  it('server-en timeout → markDown, web-speech đúng 1 lần cho lượt đó, toast 1 lần dù lỗi 3 lần', async () => {
    vi.useFakeTimers()
    config.en.useServer = true
    fetchMock.mockImplementation(hanging)
    const { router, web } = realRouter()
    for (let i = 0; i < 3; i++) {
      router.setHealth('en', 'unknown')
      const p = router.speak(req('en', `câu ${i}`)).promise
      await vi.advanceTimersByTimeAsync(8000)
      await expect(p).resolves.toEqual({ interrupted: false })
      expect(router.getHealth('en')).toBe('down')
      expect(web.speak).toHaveBeenCalledTimes(i + 1)
    }
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(TOAST_DOWN.en)
    // Đang down: lượt sau đi thẳng Web Speech, không gọi mạng.
    await router.speak(req('en')).promise
    expect(fetchMock).toHaveBeenCalledTimes(3)
    router._dispose()
  })
  it('server-vi lỗi mạng → markDown, toast VI, reject (không fallback OS)', async () => {
    config.vi.enabled = true
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { router, web } = realRouter()
    await expect(router.speak(req('vi', 'Xin chào')).promise).rejects.toMatchObject({ kind: 'network' })
    expect(router.getHealth('vi')).toBe('down')
    expect(router.canSpeak('vi')).toBe(false)
    expect(web.speak).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(TOAST_DOWN.vi)
    router._dispose()
  })
  it('429 → busy, không markDown, toast bận 1 lần', async () => {
    config.vi.enabled = true
    fetchMock.mockImplementation(() => Promise.resolve(status(429)))
    const { router } = realRouter()
    await expect(router.speak(req('vi', 'a')).promise).rejects.toMatchObject({ kind: 'busy' })
    await expect(router.speak(req('vi', 'b')).promise).rejects.toMatchObject({ kind: 'busy' })
    expect(router.getHealth('vi')).toBe('unknown')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(TOAST_BUSY)
  })
  it('400 không speed → reject, không markDown, không fallback; 503 → markDown', async () => {
    config.en.useServer = true
    const { router, web } = realRouter()
    fetchMock.mockResolvedValueOnce(status(400))
    await expect(router.speak(req('en', 'a')).promise).rejects.toMatchObject({ kind: 'http', status: 400 })
    expect(router.getHealth('en')).toBe('unknown')
    expect(web.speak).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(status(503))
    await router.speak(req('en', 'b')).promise
    expect(router.getHealth('en')).toBe('down')
    expect(web.speak).toHaveBeenCalledTimes(1)
    router._dispose()
  })
  it('thành công → health ok', async () => {
    config.vi.enabled = true
    const { router } = realRouter()
    await router.speak(req('vi', 'a')).promise
    expect(router.getHealth('vi')).toBe('ok')
  })
  it('không có provider → reject unsupported', async () => {
    const { router } = fakeRouter()
    await expect(router.speak(req('vi')).promise).rejects.toMatchObject({ kind: 'unsupported' })
  })
  it('cancel(owner) khác → bỏ qua; đúng owner → huỷ; isCurrent', () => {
    const { router, web } = fakeRouter()
    const handle = { promise: new Promise<void>(() => {}), cancel: vi.fn() }
    web.speak.mockReturnValueOnce(handle)
    router.speak(req('en'))
    expect(router.isCurrent(owner)).toBe(true)
    router.cancel({})
    expect(handle.cancel).not.toHaveBeenCalled()
    router.cancel(owner)
    expect(handle.cancel).toHaveBeenCalledTimes(1)
    expect(router.isCurrent(owner)).toBe(false)
  })
})

describe('currentOwner / isBusy / interrupted', () => {
  it('lượt bị lượt khác chiếm → resolve { interrupted: true }; lượt mới tự xong → false', async () => {
    const { router, web } = fakeRouter()
    let finishA!: () => void
    web.speak.mockReturnValueOnce({ promise: new Promise<void>((r) => (finishA = r)), cancel: vi.fn(() => finishA()) })
    const a = router.speak(req('en'))
    expect(router.currentOwner()).toBe(owner)
    expect(router.isBusy()).toBe(true)
    const ownerB = {}
    const b = router.speak({ ...req('en'), owner: ownerB })
    expect(router.currentOwner()).toBe(ownerB)
    await expect(a.promise).resolves.toEqual({ interrupted: true })
    await expect(b.promise).resolves.toEqual({ interrupted: false })
    expect(router.currentOwner()).toBeNull()
    expect(router.isBusy()).toBe(false)
  })
  it('cancel(owner) → resolve { interrupted: true }, rảnh ngay', async () => {
    const { router, web } = fakeRouter()
    let finish!: () => void
    web.speak.mockReturnValueOnce({ promise: new Promise<void>((r) => (finish = r)), cancel: vi.fn(() => finish()) })
    const a = router.speak(req('en'))
    router.cancel(owner)
    expect(router.isBusy()).toBe(false)
    await expect(a.promise).resolves.toEqual({ interrupted: true })
  })
})

describe('huỷ chéo provider', () => {
  const synth = { speaking: false, cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => [] as SpeechSynthesisVoice[]) }
  beforeEach(() => {
    _resetVoiceCache()
    _resetAudioSink()
    synth.cancel.mockClear()
    synth.speak.mockClear()
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(t: string) { this.text = t } })
    vi.stubGlobal('window', globalThis)
  })
  function liveRouter() {
    const cache = new AudioCache()
    const mk = (lang: TtsLang) => new OpenAiCompatibleProvider(lang, () => config[lang], { cache, sink: audioSink, pageProtocol: () => protocol })
    return new TtsRouter({ web: new WebSpeechProvider(), servers: { vi: mk('vi'), en: mk('en') }, getConfig: () => config, pageProtocol: () => protocol })
  }
  it('đang Web Speech → bấm VI → speechSynthesis.cancel()', () => {
    stubAudio()
    config.vi.enabled = true
    fetchMock.mockImplementation(hanging)
    const router = liveRouter()
    router.speak(req('en'))
    expect(synth.speak).toHaveBeenCalledTimes(1)
    synth.cancel.mockClear()
    router.speak({ ...req('vi', 'Xin chào'), owner: {} })
    expect(synth.cancel).toHaveBeenCalled()
  })
  it('đang <audio> → bấm EN (Web Speech) → audio.pause() + revoke URL', async () => {
    const urls = stubAudio()
    FakeAudio.playImpl = () => Promise.resolve()
    config.vi.enabled = true
    const router = liveRouter()
    router.speak(req('vi', 'Xin chào'))
    await vi.waitFor(() => expect(urls.createObjectURL).toHaveBeenCalled())
    const a = FakeAudio.instances[0]
    a.pause.mockClear()
    router.speak({ ...req('en'), owner: {} })
    expect(a.pause).toHaveBeenCalled()
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:fake/1')
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })
})
