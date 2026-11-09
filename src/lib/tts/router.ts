import { isMixedContentBlocked, normalizeBaseUrl, type TtsConfig } from '../ttsConfig'
import {
  HEALTH_DOWN_TTL_MS,
  TtsError,
  type ProbeResult,
  type SpeakHandle,
  type SpeakRequest,
  type TtsLang,
  type TtsProvider,
  type TtsVoice,
} from './types'

export type Health = 'unknown' | 'ok' | 'down'

export const TOAST_DOWN: Record<TtsLang, string> = {
  en: 'Không kết nối được server giọng đọc, đang dùng giọng trình duyệt.',
  vi: 'Không kết nối được server giọng đọc tiếng Việt. Nút nghe tiếng Việt tạm ẩn.',
}
export const TOAST_BUSY = 'Server giọng đọc đang bận. Thử lại sau vài giây.'

export interface RouterDeps {
  web: TtsProvider & { stopAll?: () => void }
  servers: Record<TtsLang, TtsProvider>
  getConfig: () => TtsConfig
  pageProtocol?: () => string
  notify?: (message: string) => void
}

/** Lỗi coi là "mất kết nối" → đánh dấu down. 4xx (kể cả 429) là cấu hình sai/bận, không down. */
export function isDownError(e: TtsError): boolean {
  return e.kind === 'network' || e.kind === 'timeout' || e.kind === 'decode' || (e.kind === 'http' && (e.status ?? 0) >= 500)
}

interface Current {
  owner: object
  handle: SpeakHandle
  /** true khi lượt bị dừng trước khi tự kết thúc (bị lượt khác chiếm hoặc `cancel`). */
  interrupted: boolean
}

/** Kết quả một lượt đọc: `interrupted` = bị lượt khác chiếm hoặc bị `cancel` trước khi đọc xong. */
export interface SpeakResult {
  interrupted: boolean
}

export interface RouterSpeakHandle {
  promise: Promise<SpeakResult>
  cancel(): void
}

export class TtsRouter {
  private readonly deps: RouterDeps
  private readonly health: Record<TtsLang, Health> = { en: 'unknown', vi: 'unknown' }
  private readonly timers: Partial<Record<TtsLang, ReturnType<typeof setTimeout>>> = {}
  private readonly listeners = new Set<() => void>()
  private readonly notified = new Set<string>()
  private current: Current | null = null
  private notifier: ((message: string) => void) | undefined

  constructor(deps: RouterDeps) {
    this.deps = deps
    this.notifier = deps.notify
  }

  setNotifier(fn: ((message: string) => void) | undefined): void {
    this.notifier = fn
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  private emit() {
    for (const cb of [...this.listeners]) cb()
  }

  private protocol(): string {
    return this.deps.pageProtocol?.() ?? (typeof location === 'undefined' ? 'http:' : location.protocol)
  }

  getHealth(lang: TtsLang): Health {
    return this.health[lang]
  }

  setHealth(lang: TtsLang, h: Health): void {
    clearTimeout(this.timers[lang])
    delete this.timers[lang]
    if (h === 'down') {
      // `down` chỉ sống 60 s → `unknown` để server bật lại là tự dùng được.
      this.timers[lang] = setTimeout(() => {
        delete this.timers[lang]
        this.setHealth(lang, 'unknown')
      }, HEALTH_DOWN_TTL_MS)
    }
    if (this.health[lang] === h) return
    this.health[lang] = h
    this.emit()
  }

  markDown(lang: TtsLang): void {
    this.setHealth(lang, 'down')
  }

  /** Server ngôn ngữ `lang` đang được bật và gọi được (chưa xét health). */
  private serverEnabled(lang: TtsLang): boolean {
    const c = this.deps.getConfig()
    const s = lang === 'vi' ? { on: c.vi.enabled, url: c.vi.baseUrl } : { on: c.en.useServer, url: c.en.baseUrl }
    if (!s.on) return false
    const n = normalizeBaseUrl(s.url)
    return n.ok && !isMixedContentBlocked(n.value, this.protocol()) && this.deps.servers[lang].supports(lang)
  }

  resolve(lang: TtsLang): TtsProvider | null {
    const { web, servers, getConfig } = this.deps
    if (this.serverEnabled(lang) && this.health[lang] !== 'down') return servers[lang]
    if (lang === 'en') return web.supports('en') ? web : null
    return getConfig().vi.deviceFallback && web.supports('vi') ? web : null
  }

  canSpeak(lang: TtsLang): boolean {
    return this.resolve(lang) !== null
  }

  private notifyOnce(key: string, message: string) {
    if (this.notified.has(key) || !this.notifier) return
    this.notified.add(key)
    this.notifier(message)
  }

  /** Mọi provider đều dừng (một nguồn phát tại một thời điểm). */
  private stopCurrent() {
    const cur = this.current
    this.current = null
    if (cur) {
      cur.interrupted = true
      cur.handle.cancel()
    }
  }

  /** Chủ lượt đang phát/đang tải; null khi rảnh. */
  currentOwner(): object | null {
    return this.current?.owner ?? null
  }

  isBusy(): boolean {
    return this.current !== null
  }

  speak(req: SpeakRequest): RouterSpeakHandle {
    this.stopCurrent()
    const provider = this.resolve(req.lang)
    if (!provider) return { promise: Promise.reject(new TtsError('unsupported')), cancel: () => {} }
    const { web } = this.deps
    // Đang chuyển provider: chắc chắn Web Speech im lặng trước khi phát <audio>.
    if (provider !== web) web.stopAll?.()
    const entry: Current = { owner: req.owner, handle: provider.speak(req), interrupted: false }
    this.current = entry
    const isServer = provider !== web

    const promise: Promise<SpeakResult> = entry.handle.promise
      .then(
        () => {
          if (isServer && this.current === entry) this.setHealth(req.lang, 'ok')
        },
        (e: unknown) => {
          if (this.current !== entry) return // đã bị huỷ/thay thế
          if (!(e instanceof TtsError) || !isServer) throw e
          if (e.kind === 'busy') {
            this.notifyOnce('busy', TOAST_BUSY)
            throw e
          }
          if (!isDownError(e)) throw e
          this.markDown(req.lang)
          this.notifyOnce(`down:${req.lang}`, TOAST_DOWN[req.lang])
          const canFallback =
            req.lang === 'en' ? web.supports('en') : this.deps.getConfig().vi.deviceFallback && web.supports('vi')
          if (!canFallback) throw e
          // Fallback cho chính lượt này (có thể đã rời gesture; iOS từ chối thì reject).
          entry.handle = web.speak(req)
          return entry.handle.promise
        },
      )
      .then(() => ({ interrupted: entry.interrupted }))
      .finally(() => {
        if (this.current === entry) this.current = null
      })

    return {
      promise,
      cancel: () => {
        if (this.current === entry) this.stopCurrent()
      },
    }
  }

  /** `owner` khác lượt hiện tại → không làm gì (ngữ nghĩa như lib/speech). */
  cancel(owner?: object): void {
    if (owner && this.current?.owner !== owner) return
    this.stopCurrent()
  }

  isCurrent(owner: object): boolean {
    return this.current?.owner === owner
  }

  /** "Kiểm tra kết nối": thành công → ok; lỗi mất kết nối → down; 4xx/bận giữ unknown. */
  async probe(lang: TtsLang, signal?: AbortSignal): Promise<ProbeResult> {
    const r = await this.deps.servers[lang].probe(signal)
    if (r.ok) this.setHealth(lang, 'ok')
    else if (isDownError(r.error)) this.markDown(lang)
    return r
  }

  listVoices(lang: TtsLang, signal?: AbortSignal): Promise<TtsVoice[]> {
    return this.deps.servers[lang].listVoices(signal)
  }

  /** Chỉ dùng cho test. */
  _dispose(): void {
    for (const l of ['en', 'vi'] as const) clearTimeout(this.timers[l])
  }
}
