import type { ServerLang, TtsLang } from '../ttsConfig'

export type { ServerLang, TtsLang }

export interface SpeakRequest {
  text: string
  lang: TtsLang
  rate: number
  owner: object
  /** Giọng Web Speech đã chọn trong Cài đặt (`settings.voice_name`); server bỏ qua. */
  voiceName?: string | null
  /** Gọi khi âm thanh thật sự bắt đầu phát (Web Speech: ngay lập tức). Dùng cho trạng thái "đang tải". */
  onStart?: () => void
}

export interface SpeakHandle {
  promise: Promise<void>
  cancel(): void
}

export interface TtsVoice {
  id: string
  label: string
  lang?: string
}

export type TtsErrorKind =
  | 'unsupported'
  | 'blocked'
  | 'network'
  | 'timeout'
  | 'http'
  | 'busy'
  | 'decode'
  | 'autoplay'
  | 'cancelled'

export class TtsError extends Error {
  kind: TtsErrorKind
  status?: number
  constructor(kind: TtsErrorKind, status?: number) {
    super(status === undefined ? `tts-${kind}` : `tts-${kind}-${status}`)
    this.name = 'TtsError'
    this.kind = kind
    if (status !== undefined) this.status = status
  }
}

export type ProbeResult = { ok: true; ms: number; voices: number | null } | { ok: false; ms: number; error: TtsError }

export type TtsProviderId = 'web-speech' | 'server-vi' | 'server-en'

export interface TtsProvider {
  readonly id: TtsProviderId
  supports(lang: TtsLang): boolean
  /** PHẢI khởi động đồng bộ (không await trước) để còn nằm trong user gesture (iOS). */
  speak(req: SpeakRequest): SpeakHandle
  probe(signal?: AbortSignal): Promise<ProbeResult>
  listVoices(signal?: AbortSignal): Promise<TtsVoice[]>
}

export const MODEL: Record<ServerLang, string> = { vi: 'vieneu-v3-turbo', en: 'kokoro' }
export const DEFAULT_VOICE: Record<ServerLang, string> = { vi: 'Hải Đăng', en: 'af_heart' }
export const TIMEOUT_SPEAK_MS = 8000
export const TIMEOUT_PROBE_MS = 4000
export const HEALTH_DOWN_TTL_MS = 60000
