import { readTtsConfig, subscribeTtsConfig, type TtsConfig } from '../ttsConfig'
import { AudioCache } from './cache'
import { OpenAiCompatibleProvider } from './openaiCompat'
import { TtsRouter, type Health, type SpeakResult } from './router'
import type { ProbeResult, TtsLang, TtsVoice } from './types'
import { WebSpeechProvider } from './webSpeech'

export { TtsError, type TtsErrorKind, type TtsLang, type TtsVoice, type ProbeResult } from './types'
export type { Health, SpeakResult } from './router'

let config: TtsConfig = readTtsConfig()
const cache = new AudioCache()
export const webSpeech = new WebSpeechProvider()
const router = new TtsRouter({
  web: webSpeech,
  servers: {
    vi: new OpenAiCompatibleProvider('vi', () => config.vi, { cache }),
    en: new OpenAiCompatibleProvider('en', () => config.en, { cache }),
  },
  getConfig: () => config,
})

/** Đổi baseUrl/voice của một ngôn ngữ → xoá cache audio + health về `unknown`. */
export function resetServer(lang: TtsLang): void {
  cache.clear(lang)
  router.setHealth(lang, 'unknown')
}

subscribeTtsConfig(() => {
  const prev = config
  config = readTtsConfig()
  for (const lang of ['en', 'vi'] as const) {
    if (prev[lang].baseUrl !== config[lang].baseUrl || prev[lang].voice !== config[lang].voice) resetServer(lang)
  }
})

export interface FacadeSpeakOptions {
  text: string
  lang?: TtsLang
  rate?: number
  owner?: object
  voiceName?: string | null
  onStart?: () => void
}

/** Gọi trực tiếp trong user gesture: router/provider khởi động đồng bộ. */
/** Tốc độ thực dùng: `rate` tường minh được ưu tiên; VI không truyền → `config.vi.speed`; EN → 1. */
export function effectiveRate(lang: TtsLang, rate: number | undefined, c: TtsConfig): number {
  if (rate !== undefined) return rate
  return lang === 'vi' ? c.vi.speed || 1 : 1
}

/** Resolve `{ interrupted }`: false = đọc xong tự nhiên; true = bị lượt khác chiếm hoặc bị `cancel`. Lỗi thật → reject `TtsError`. */
export function speakResult({ text, lang = 'en', rate, owner = {}, voiceName, onStart }: FacadeSpeakOptions): Promise<SpeakResult> {
  return router.speak({ text, lang, rate: effectiveRate(lang, rate, config), owner, voiceName, onStart }).promise
}

/** Như `speakResult` nhưng resolve `void` (tương thích ngược). */
export function speak(opts: FacadeSpeakOptions): Promise<void> {
  return speakResult(opts).then(() => undefined)
}

export function cancel(owner?: object): void {
  router.cancel(owner)
}

export function isCurrent(owner: object): boolean {
  return router.isCurrent(owner)
}

/** Chủ lượt đang phát/đang tải; null khi rảnh hoặc lượt đã kết thúc. */
export function currentOwner(): object | null {
  return router.currentOwner()
}

export function isBusy(): boolean {
  return router.isBusy()
}

export function canSpeak(lang: TtsLang): boolean {
  return router.canSpeak(lang)
}

/** Tiếng Anh hiện đang đi qua server local. */
export function usingEnServer(): boolean {
  return router.resolve('en')?.id === 'server-en'
}

export function getHealth(lang: TtsLang): Health {
  return router.getHealth(lang)
}

export function probe(lang: TtsLang, signal?: AbortSignal): Promise<ProbeResult> {
  return router.probe(lang, signal)
}

export function listVoices(lang: TtsLang, signal?: AbortSignal): Promise<TtsVoice[]> {
  return router.listVoices(lang, signal)
}

/** Thay đổi cấu hình, health, hoặc danh sách giọng thiết bị (Chrome nạp giọng trễ). */
export function subscribe(cb: () => void): () => void {
  const offConfig = subscribeTtsConfig(cb)
  const offRouter = router.subscribe(cb)
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  synth?.addEventListener?.('voiceschanged', cb)
  return () => {
    offConfig()
    offRouter()
    synth?.removeEventListener?.('voiceschanged', cb)
  }
}

/** DataProvider nối toast (tone info). */
export function setNotifier(fn: ((message: string, tone: 'info') => void) | undefined): void {
  router.setNotifier(fn ? (m) => fn(m, 'info') : undefined)
}
