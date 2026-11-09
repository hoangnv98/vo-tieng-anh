import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TtsServerConfig } from '../ttsConfig'
import { AudioCache } from './cache'
import { OpenAiCompatibleProvider, parseVoices } from './openaiCompat'
import { fakeSink, hanging, json, status, wav } from './testUtils'
import { TtsError } from './types'

let cfg: TtsServerConfig
let sink: ReturnType<typeof fakeSink>
let cache: AudioCache
let fetchMock: ReturnType<typeof vi.fn>
const owner = {}

function make(lang: 'vi' | 'en' = 'vi', protocol = 'http:') {
  return new OpenAiCompatibleProvider(lang, () => cfg, { cache, sink, pageProtocol: () => protocol })
}
const body = (i = 0) => JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string)

beforeEach(() => {
  cfg = { baseUrl: 'http://localhost:8000', voice: '' }
  sink = fakeSink()
  cache = new AudioCache()
  fetchMock = vi.fn(() => Promise.resolve(wav()))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('speak', () => {
  it('gửi đúng URL, body, credentials omit, không Authorization; play blob', async () => {
    const onStart = vi.fn()
    await make().speak({ text: 'Xin *chào*', lang: 'vi', rate: 1, owner, onStart }).promise
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8000/v1/audio/speech')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('omit')
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i)
    expect(body()).toEqual({ model: 'vieneu-v3-turbo', input: 'Xin chào', voice: 'Hải Đăng', response_format: 'wav' })
    expect(sink.prime).toHaveBeenCalledTimes(1)
    expect(sink.play).toHaveBeenCalledWith(expect.any(Blob), 1)
    expect(onStart).toHaveBeenCalledTimes(1)
  })
  it('speed chỉ gửi khi ≠ 1; giọng do người dùng chọn', async () => {
    cfg.voice = 'af_bella'
    await make('en').speak({ text: 'Hi', lang: 'en', rate: 0.75, owner }).promise
    expect(body()).toEqual({ model: 'kokoro', input: 'Hi', voice: 'af_bella', response_format: 'wav', speed: 0.75 })
    expect(sink.play).toHaveBeenCalledWith(expect.any(Blob), 1)
  })
  it('timeout 8 s → TtsError timeout, đã abort', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(hanging)
    const p = make().speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise
    const check = expect(p).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(8000)
    await check
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
  })
  it('cancel khi đang chờ → abort fetch, stop sink, promise resolve', async () => {
    fetchMock.mockImplementation(hanging)
    const h = make().speak({ text: 'a', lang: 'vi', rate: 1, owner })
    await Promise.resolve()
    h.cancel()
    await expect(h.promise).resolves.toBeUndefined()
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
    expect(sink.stop).toHaveBeenCalled()
    expect(sink.play).not.toHaveBeenCalled()
  })
  it('lỗi mạng → network; 429 → busy; 503 → http 503; 404 → http 404', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(make().speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise).rejects.toMatchObject({ kind: 'network' })
    fetchMock.mockResolvedValueOnce(status(429))
    await expect(make().speak({ text: 'b', lang: 'vi', rate: 1, owner }).promise).rejects.toMatchObject({ kind: 'busy', status: 429 })
    fetchMock.mockResolvedValueOnce(status(503))
    await expect(make().speak({ text: 'c', lang: 'vi', rate: 1, owner }).promise).rejects.toMatchObject({ kind: 'http', status: 503 })
    fetchMock.mockResolvedValueOnce(status(404))
    await expect(make().speak({ text: 'd', lang: 'vi', rate: 1, owner }).promise).rejects.toMatchObject({ kind: 'http', status: 404 })
  })
  it('400 khi có speed → gửi lại 1 lần không speed, playbackRate = rate', async () => {
    fetchMock.mockResolvedValueOnce(status(400))
    await make().speak({ text: 'a', lang: 'vi', rate: 0.8, owner }).promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(body(0).speed).toBe(0.8)
    expect(body(1)).not.toHaveProperty('speed')
    expect(sink.play).toHaveBeenCalledWith(expect.any(Blob), 0.8)
  })
  it('400 khi không có speed → reject http 400, không retry', async () => {
    fetchMock.mockResolvedValueOnce(status(400))
    await expect(make().speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise).rejects.toMatchObject({ kind: 'http', status: 400 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('body rỗng hoặc content-type lạ → decode', async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(0), { status: 200, headers: { 'content-type': 'audio/wav' } }))
    await expect(make().speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise).rejects.toMatchObject({ kind: 'decode' })
    fetchMock.mockResolvedValueOnce(json({ error: 'x' }))
    await expect(make().speak({ text: 'b', lang: 'vi', rate: 1, owner }).promise).rejects.toMatchObject({ kind: 'decode' })
  })
  it('mixed content → blocked, không gọi mạng', async () => {
    cfg.baseUrl = 'http://192.168.1.5:8000'
    await expect(make('vi', 'https:').speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise).rejects.toMatchObject({ kind: 'blocked' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('cache', () => {
  it('cùng (baseUrl, voice, rate, text) → fetch 1 lần; cache hit không prime, play đồng bộ', async () => {
    const p = make()
    await p.speak({ text: 'Xin chào', lang: 'vi', rate: 1, owner }).promise
    sink.prime.mockClear()
    sink.play.mockClear()
    const h = p.speak({ text: 'Xin chào', lang: 'vi', rate: 1, owner })
    expect(sink.play).toHaveBeenCalledTimes(1) // gọi ngay trong call stack (gesture)
    await h.promise
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sink.prime).not.toHaveBeenCalled()
  })
  it('khác rate → fetch lại; đổi baseUrl → fetch lại', async () => {
    const p = make()
    await p.speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise
    await p.speak({ text: 'a', lang: 'vi', rate: 0.9, owner }).promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
    cfg.baseUrl = 'http://localhost:9000'
    await p.speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:9000/v1/audio/speech')
  })
  it('không cache lỗi', async () => {
    fetchMock.mockResolvedValueOnce(status(503))
    const p = make()
    await expect(p.speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise).rejects.toBeInstanceOf(TtsError)
    await p.speak({ text: 'a', lang: 'vi', rate: 1, owner }).promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('văn bản dài → đọc tuần tự từng đoạn, mỗi đoạn một mục cache', async () => {
    const s = `${'từ '.repeat(40).trim()}.`
    await make().speak({ text: `${s} ${s} ${s}`, lang: 'vi', rate: 1, owner }).promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sink.play).toHaveBeenCalledTimes(2)
    expect(cache.size).toBe(2)
  })
})

describe('parseVoices', () => {
  it('string[]', () => expect(parseVoices(['A', 'B'])).toEqual([{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }]))
  it('{voices:[{id,name}]}', () => expect(parseVoices({ voices: [{ id: 'a', name: 'A' }] })).toEqual([{ id: 'a', label: 'A' }]))
  it('{data:[{voice_id}]} + lang', () =>
    expect(parseVoices({ data: [{ voice_id: 'x', language: 'vi' }] })).toEqual([{ id: 'x', label: 'x', lang: 'vi' }]))
  it('[{name}] + bỏ rác + trùng id', () =>
    expect(parseVoices([{ name: 'Mai Anh' }, null, 42, {}, { label: 'no id' }, 'Mai Anh', { id: 'b', display_name: 'Bê' }])).toEqual([
      { id: 'Mai Anh', label: 'Mai Anh' },
      { id: 'b', label: 'Bê' },
    ]))
  it('định dạng lạ → []', () => expect(parseVoices({ foo: 1 })).toEqual([]))
})

describe('probe / listVoices', () => {
  const route = (map: Record<string, () => Promise<Response>>) =>
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = url.replace('http://localhost:8000', '')
      return map[path] ? map[path]() : hanging(url, init)
    })
  it('/v1/models 200 → ok với ms và số giọng', async () => {
    route({ '/v1/models': () => Promise.resolve(json({ data: [] })), '/v1/voices': () => Promise.resolve(json(['A', 'B', 'C'])) })
    const r = await make().probe()
    expect(r).toMatchObject({ ok: true, voices: 3 })
    expect(r.ms).toBeGreaterThanOrEqual(0)
  })
  it('/v1/models 404 → thử /health; voices không có → null', async () => {
    route({
      '/v1/models': () => Promise.resolve(status(404)),
      '/health': () => Promise.resolve(json({ status: 'ok' })),
      '/v1/voices': () => Promise.resolve(status(404)),
      '/v1/audio/voices': () => Promise.resolve(status(404)),
    })
    expect(await make().probe()).toMatchObject({ ok: true, voices: null })
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain('http://localhost:8000/health')
  })
  it('lỗi mạng → network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const r = await make().probe()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.kind).toBe('network')
  })
  it('quá 4 s → timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(hanging)
    const p = make().probe()
    await vi.advanceTimersByTimeAsync(4000)
    const r = await p
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.kind).toBe('timeout')
  })
  it('listVoices: /v1/voices 404 → /v1/audio/voices (kokoro)', async () => {
    route({
      '/v1/voices': () => Promise.resolve(status(404)),
      '/v1/audio/voices': () => Promise.resolve(json({ voices: ['af_heart', 'af_bella'] })),
    })
    expect((await make().listVoices()).map((v) => v.id)).toEqual(['af_heart', 'af_bella'])
  })
})
