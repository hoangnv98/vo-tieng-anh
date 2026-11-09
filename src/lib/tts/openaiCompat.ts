import { isMixedContentBlocked, normalizeBaseUrl, type TtsServerConfig } from '../ttsConfig'
import { audioSink as defaultSink, type AudioSink } from './audioSink'
import { AudioCache, cacheKey } from './cache'
import { prepareText } from './text'
import {
  DEFAULT_VOICE,
  MODEL,
  TIMEOUT_PROBE_MS,
  TIMEOUT_SPEAK_MS,
  TtsError,
  type ProbeResult,
  type SpeakHandle,
  type SpeakRequest,
  type TtsLang,
  type TtsProvider,
  type TtsVoice,
} from './types'

export interface OpenAiCompatDeps {
  cache: AudioCache
  sink?: AudioSink
  /** Mặc định `location.protocol` (dùng để phát hiện mixed content). */
  pageProtocol?: () => string
}

/** Parse danh sách giọng khoan dung: `string[]`, `{voices}`, `{data}`; phần tử string hoặc `{id|name|voice_id}`. */
export function parseVoices(json: unknown): TtsVoice[] {
  let list: unknown = json
  if (list && typeof list === 'object' && !Array.isArray(list)) {
    const o = list as Record<string, unknown>
    list = Array.isArray(o.voices) ? o.voices : Array.isArray(o.data) ? o.data : null
  }
  if (!Array.isArray(list)) return []
  const out: TtsVoice[] = []
  const seen = new Set<string>()
  const s = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : typeof x === 'number' ? String(x) : '')
  for (const it of list) {
    let v: TtsVoice | null = null
    if (typeof it === 'string') {
      const id = it.trim()
      if (id) v = { id, label: id }
    } else if (it && typeof it === 'object') {
      const o = it as Record<string, unknown>
      const id = s(o.id) || s(o.name) || s(o.voice_id)
      if (id) {
        const label = s(o.label) || s(o.display_name) || s(o.name) || id
        const lang = s(o.lang) || s(o.language)
        v = lang ? { id, label, lang } : { id, label }
      }
    }
    if (v && !seen.has(v.id)) {
      seen.add(v.id)
      out.push(v)
    }
  }
  return out
}

function isAudioType(ct: string | null): boolean {
  if (!ct) return true
  const t = ct.toLowerCase()
  return t.startsWith('audio/') || t.startsWith('application/octet-stream')
}

function hasNetworkApis(): boolean {
  return typeof fetch === 'function' && typeof AbortController !== 'undefined'
}

interface Timed {
  ctrl: AbortController
  timedOut: () => boolean
  done: () => void
}

/** Một AbortController + setTimeout; nối thêm tín hiệu abort bên ngoài (nếu có). */
function timed(ms: number, outer?: AbortSignal): Timed {
  const ctrl = new AbortController()
  let out = false
  const timer = setTimeout(() => {
    out = true
    ctrl.abort()
  }, ms)
  const onOuter = () => ctrl.abort()
  if (outer) {
    if (outer.aborted) ctrl.abort()
    else outer.addEventListener('abort', onOuter)
  }
  return {
    ctrl,
    timedOut: () => out,
    done: () => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', onOuter)
    },
  }
}

function toTtsError(e: unknown, t: Timed): TtsError {
  if (e instanceof TtsError) return e
  if (t.timedOut()) return new TtsError('timeout')
  if (t.ctrl.signal.aborted) return new TtsError('cancelled')
  return new TtsError('network')
}

export class OpenAiCompatibleProvider implements TtsProvider {
  readonly id: 'server-vi' | 'server-en'
  readonly lang: TtsLang
  private readonly getConfig: () => TtsServerConfig
  private readonly cache: AudioCache
  private readonly sink: AudioSink
  private readonly pageProtocol: () => string

  constructor(lang: TtsLang, getConfig: () => TtsServerConfig, deps: OpenAiCompatDeps) {
    this.lang = lang
    this.id = lang === 'vi' ? 'server-vi' : 'server-en'
    this.getConfig = getConfig
    this.cache = deps.cache
    this.sink = deps.sink ?? defaultSink
    this.pageProtocol = deps.pageProtocol ?? (() => (typeof location === 'undefined' ? 'http:' : location.protocol))
  }

  supports(lang: TtsLang): boolean {
    return lang === this.lang && hasNetworkApis() && this.sink.isSupported()
  }

  /** baseUrl đã chuẩn hoá, hoặc lỗi `blocked`/`unsupported`. */
  private base(): string | TtsError {
    const n = normalizeBaseUrl(this.getConfig().baseUrl)
    if (!n.ok) return new TtsError('unsupported')
    if (isMixedContentBlocked(n.value, this.pageProtocol())) return new TtsError('blocked')
    return n.value
  }

  private voice(): string {
    return this.getConfig().voice.trim() || DEFAULT_VOICE[this.lang]
  }

  speak(req: SpeakRequest): SpeakHandle {
    const base = this.base()
    if (typeof base !== 'string' || !this.supports(req.lang)) {
      const err = typeof base === 'string' ? new TtsError('unsupported') : base
      return { promise: Promise.reject(err), cancel: () => {} }
    }
    const chunks = prepareText(req.text, this.lang)
    if (chunks.length === 0) return { promise: Promise.resolve(), cancel: () => {} }
    const voice = this.voice()
    const rate = req.rate
    const keyOf = (text: string) => cacheKey({ providerId: this.id, baseUrl: base, voice, rate, text })

    let cancelled = false
    let ctrl: AbortController | null = null
    let started = false
    const firstHit = this.cache.get(keyOf(chunks[0]))
    // iOS: mở khoá <audio> trong gesture trước khi fetch. Cache hit → play() ngay bên dưới (vẫn trong gesture).
    if (!firstHit) this.sink.prime()

    const run = async (): Promise<void> => {
      for (let i = 0; i < chunks.length; i++) {
        if (cancelled) return
        const key = keyOf(chunks[i])
        let entry = i === 0 ? firstHit : this.cache.get(key)
        if (!entry) {
          const t = timed(TIMEOUT_SPEAK_MS)
          ctrl = t.ctrl
          try {
            const got = await this.fetchSpeech(base, chunks[i], voice, rate, t)
            this.cache.set(key, this.lang, got.blob, got.playbackRate)
            entry = { blob: got.blob, bytes: got.blob.size, at: Date.now(), lang: this.lang, playbackRate: got.playbackRate }
          } catch (e) {
            if (cancelled) return
            throw toTtsError(e, t)
          } finally {
            t.done()
            ctrl = null
          }
        }
        if (cancelled) return
        if (!started) {
          started = true
          req.onStart?.()
        }
        await this.sink.play(entry.blob, entry.playbackRate)
      }
    }

    return {
      promise: run(),
      cancel: () => {
        if (cancelled) return
        cancelled = true
        ctrl?.abort()
        this.sink.stop()
      },
    }
  }

  private async fetchSpeech(
    base: string,
    input: string,
    voice: string,
    rate: number,
    t: Timed,
  ): Promise<{ blob: Blob; playbackRate: number }> {
    const post = (withSpeed: boolean) => {
      const body: Record<string, unknown> = { model: MODEL[this.lang], input, voice, response_format: 'wav' }
      if (withSpeed) body.speed = rate
      return fetch(`${base}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
        signal: t.ctrl.signal,
      })
    }
    let playbackRate = 1
    let res = await post(rate !== 1)
    if ((res.status === 400 || res.status === 422) && rate !== 1) {
      res = await post(false)
      playbackRate = rate
    }
    if (res.status === 429) throw new TtsError('busy', 429)
    if (!res.ok) throw new TtsError('http', res.status)
    if (!isAudioType(res.headers.get('content-type'))) throw new TtsError('decode')
    const blob = await res.blob()
    if (blob.size === 0) throw new TtsError('decode')
    return { blob, playbackRate }
  }

  private async get(base: string, path: string, t: Timed): Promise<Response> {
    return fetch(`${base}${path}`, { method: 'GET', credentials: 'omit', signal: t.ctrl.signal })
  }

  /** GET /v1/models; 404/405 → GET /health. Thành công thì đếm giọng (null nếu không lấy được). */
  async probe(signal?: AbortSignal): Promise<ProbeResult> {
    const started = Date.now()
    const ms = () => Date.now() - started
    const base = this.base()
    if (typeof base !== 'string') return { ok: false, ms: 0, error: base }
    if (!hasNetworkApis()) return { ok: false, ms: 0, error: new TtsError('unsupported') }
    const t = timed(TIMEOUT_PROBE_MS, signal)
    try {
      let res = await this.get(base, '/v1/models', t)
      if (res.status === 404 || res.status === 405) res = await this.get(base, '/health', t)
      if (res.status === 429) throw new TtsError('busy', 429)
      if (!res.ok) throw new TtsError('http', res.status)
    } catch (e) {
      return { ok: false, ms: ms(), error: toTtsError(e, t) }
    } finally {
      t.done()
    }
    const elapsed = ms()
    let voices: number | null = null
    try {
      const list = await this.listVoices(signal)
      voices = list.length > 0 ? list.length : null
    } catch {
      voices = null
    }
    return { ok: true, ms: elapsed, voices }
  }

  /** GET /v1/voices (VieNeu) → dự phòng GET /v1/audio/voices (kokoro-fastapi). */
  async listVoices(signal?: AbortSignal): Promise<TtsVoice[]> {
    const base = this.base()
    if (typeof base !== 'string') throw base
    if (!hasNetworkApis()) throw new TtsError('unsupported')
    const t = timed(TIMEOUT_PROBE_MS, signal)
    try {
      let lastErr: TtsError | null = null
      for (const path of ['/v1/voices', '/v1/audio/voices']) {
        let res: Response
        try {
          res = await this.get(base, path, t)
        } catch (e) {
          const err = toTtsError(e, t)
          if (err.kind !== 'network') throw err
          lastErr = err
          continue
        }
        if (!res.ok) {
          lastErr = res.status === 429 ? new TtsError('busy', 429) : new TtsError('http', res.status)
          continue
        }
        try {
          return parseVoices(await res.json())
        } catch (e) {
          const err = toTtsError(e, t)
          if (err.kind === 'timeout' || err.kind === 'cancelled') throw err
          lastErr = new TtsError('decode')
        }
      }
      throw lastErr ?? new TtsError('network')
    } finally {
      t.done()
    }
  }
}
