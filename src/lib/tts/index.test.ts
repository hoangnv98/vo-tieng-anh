import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('facade với cấu hình mặc định', () => {
  it('canSpeak + subscribe không gọi mạng tới server TTS', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const tts = await import('./index')
    expect(tts.canSpeak('vi')).toBe(false)
    expect(tts.usingEnServer()).toBe(false)
    const off = tts.subscribe(() => {})
    off()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('tốc độ tiếng Việt', () => {
  it('VI không truyền rate → dùng config.vi.speed; rate tường minh được ưu tiên; EN mặc định 1', async () => {
    const { DEFAULT_TTS_CONFIG } = await import('../ttsConfig')
    const { effectiveRate } = await import('./index')
    const c = { ...DEFAULT_TTS_CONFIG, vi: { ...DEFAULT_TTS_CONFIG.vi, speed: 0.8 } }
    expect(effectiveRate('vi', undefined, c)).toBe(0.8)
    expect(effectiveRate('vi', 1.2, c)).toBe(1.2)
    expect(effectiveRate('en', undefined, c)).toBe(1)
    expect(effectiveRate('en', 0.75, c)).toBe(0.75)
  })
  it("speak('x', {lang:'vi'}) với vi.speed=0.8 → server nhận speed 0.8", async () => {
    const { stubAudio } = await import('./fakeAudio')
    stubAudio()
    const store = new Map<string, string>([
      ['vta:v1:tts', JSON.stringify({ v: 1, vi: { enabled: true, baseUrl: 'http://localhost:8000', voice: '', speed: 0.8, deviceFallback: false }, en: {} })],
    ])
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/wav' } })),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const tts = await import('./index')
    void tts.speak({ text: 'Xin chào', lang: 'vi' }).catch(() => {})
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(JSON.parse(calls[0][1].body as string).speed).toBe(0.8)
    tts.cancel()
    vi.restoreAllMocks()
  })
})
