import { cancel as cancelSpeech, getEnglishVoices, isTtsSupported, speak as speakSpeech } from '../speech'
import { TTS_TAG } from '../../domain/languageCore'
import { prepareText } from './text'
import { TtsError, type ProbeResult, type SpeakHandle, type SpeakRequest, type TtsLang, type TtsProvider, type TtsVoice } from './types'

/** Ngôn ngữ đọc bằng giọng thiết bị tự chọn (không qua `lib/speech.ts`). */
export type DeviceVoiceLang = Exclude<TtsLang, 'en'>

/** BCP-47 cho utterance (6.14 (5).6); `vi` giữ như T19. */
export const DEVICE_TTS_TAG: Record<DeviceVoiceLang, string> = { vi: 'vi-VN', zh: TTS_TAG.zh, ja: TTS_TAG.ja, ko: TTS_TAG.ko }

/** Phần của `SpeechSynthesisVoice` mà `pickVoiceFor` cần (test truyền mảng giả). */
export type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'localService' | 'default'>

function deviceVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return []
  try {
    return window.speechSynthesis.getVoices()
  } catch {
    return []
  }
}

function normLang(v: VoiceLike): string {
  return (v.lang ?? '').replace(/_/g, '-').toLowerCase()
}

/** `tag` hoặc `tag-*` (không khớp nhầm tiền tố khác, vd `jav`). */
function hasPrefix(l: string, tag: string): boolean {
  return l === tag || l.startsWith(`${tag}-`)
}

/**
 * Bậc ưu tiên của giọng cho `lang` (0 = tốt nhất), `-1` = không dùng được.
 * `zh`: 0 `zh-cn` · 1 tiếng Phổ thông giản thể khác (`zh`, `zh-sg`, `cmn-*`) · 2 phồn thể Phổ thông (`zh-tw`, `*-hant-*`)
 * · 3 Quảng Đông (`zh-hk`, `zh-mo`, `yue*`) — đọc khác hẳn nên để cuối.
 * `ja|ko|vi`: 0 khớp đúng `ja-jp`/`ko-kr`/`vi-vn` · 1 bất kỳ `ja*`/`ko*`/`vi*`.
 */
function voiceTier(lang: DeviceVoiceLang, l: string): number {
  if (l === DEVICE_TTS_TAG[lang].toLowerCase()) return 0
  if (lang !== 'zh') return hasPrefix(l, lang) ? 1 : -1
  const cantonese = hasPrefix(l, 'yue') || hasPrefix(l, 'zh-hk') || hasPrefix(l, 'zh-mo') || hasPrefix(l, 'zh-yue')
  if (cantonese) return 3
  if (!hasPrefix(l, 'zh') && !hasPrefix(l, 'cmn')) return -1
  return hasPrefix(l, 'zh-tw') || l.includes('-hant') ? 2 : 1
}

/**
 * Kết quả `pickVoiceFor(lang)` (không truyền `voices`) theo ngôn ngữ: `getVoices()` + quét danh sách chạy mỗi lần
 * render (snapshot `speakable` của useTts), nên nhớ lại tới khi trình duyệt báo `voiceschanged`.
 */
const voiceCache = new Map<DeviceVoiceLang, SpeechSynthesisVoice | undefined>()
let cacheSynth: SpeechSynthesis | null = null

/** Xoá cache giọng (tự gọi khi `voiceschanged`; test gọi khi đổi danh sách giọng giả). */
export function clearVoiceCache(): void {
  voiceCache.clear()
}

/** Gắn listener xoá cache cho đối tượng `speechSynthesis` hiện tại (một lần mỗi đối tượng). */
function watchVoices(): SpeechSynthesis | null {
  if (!isTtsSupported()) return null
  const synth = window.speechSynthesis
  if (synth !== cacheSynth) {
    voiceCache.clear()
    cacheSynth = synth
    synth.addEventListener?.('voiceschanged', () => {
      if (cacheSynth === synth) voiceCache.clear()
    })
  }
  return synth
}
// Đăng ký ngay khi nạp module: listener xoá cache chạy trước listener `subscribe()` của facade (re-render),
// để snapshot đọc lại giọng mới chứ không đọc cache cũ.
watchVoices()

function cachedPick(lang: DeviceVoiceLang): SpeechSynthesisVoice | undefined {
  if (!watchVoices()) return undefined
  if (voiceCache.has(lang)) return voiceCache.get(lang)
  const voices = deviceVoices()
  const v = pickVoiceFor(lang, voices)
  // Danh sách rỗng lúc mới nạp (chưa có `voiceschanged`): không ghi cache để lần render sau đọc lại.
  if (voices.length > 0) voiceCache.set(lang, v)
  return v
}

/**
 * Chọn giọng thiết bị cho `vi|zh|ja|ko` (thuần khi truyền `voices`; không truyền → đọc `speechSynthesis.getVoices()`
 * qua cache theo ngôn ngữ, xoá khi `voiceschanged`).
 * Cùng bậc: `localService` trước (trừ `vi` — giữ thứ tự giọng như T19), rồi `default`, rồi thứ tự gốc.
 * Không có giọng → `undefined`.
 */
export function pickVoiceFor(lang: DeviceVoiceLang): SpeechSynthesisVoice | undefined
export function pickVoiceFor<V extends VoiceLike>(lang: DeviceVoiceLang, voices: readonly V[]): V | undefined
export function pickVoiceFor(lang: DeviceVoiceLang, voices?: readonly VoiceLike[]): VoiceLike | undefined {
  if (voices === undefined) return cachedPick(lang)
  let best: VoiceLike | undefined
  let bestKey = Infinity
  const useLocal = lang !== 'vi'
  for (const v of voices) {
    const tier = voiceTier(lang, normLang(v))
    if (tier < 0) continue
    // Khoá so sánh: bậc → localService (không áp cho vi) → default; bằng nhau giữ giọng đứng trước (thứ tự gốc).
    const key = tier * 4 + (useLocal && !v.localService ? 2 : 0) + (v.default ? 0 : 1)
    if (key < bestKey) {
      best = v
      bestKey = key
    }
  }
  return best
}

interface VoiceCurrent {
  owner: object
  settle: () => void
}
let voiceCurrent: VoiceCurrent | null = null

/** Thời gian chờ tối đa: `vi` như T19; CJK mỗi ký tự đọc lâu hơn nên tính theo 400 ms/ký tự, tối thiểu 3 s. */
export function speakTimeoutMs(lang: DeviceVoiceLang, length: number, rate: number): number {
  const r = Math.max(rate, 0.1)
  return lang === 'vi' ? (length * 120) / r + 5000 : Math.max(length * 400, 3000) / r + 5000
}

/**
 * Đọc bằng một giọng thiết bị cụ thể (`vi` khi bật `deviceFallback`; `zh|ja|ko` luôn đi đây).
 * `lib/speech.ts` chỉ lo tiếng Anh.
 */
function speakWithVoice(req: SpeakRequest & { lang: DeviceVoiceLang }, voice: SpeechSynthesisVoice | undefined, tag: string): Promise<void> {
  const synth = window.speechSynthesis
  // Dừng mọi phát âm Web Speech khác (EN qua lib/speech, lượt giọng thiết bị trước đó).
  cancelSpeech()
  voiceCurrent?.settle()
  return new Promise<void>((resolve, reject) => {
    // zh/ja không có khoảng trắng giữa các câu → nối lại không thêm dấu cách.
    const text = prepareText(req.text, req.lang).join(req.lang === 'zh' || req.lang === 'ja' ? '' : ' ')
    const u = new SpeechSynthesisUtterance(text)
    u.lang = tag
    u.rate = req.rate
    if (voice) {
      u.voice = voice
      u.lang = voice.lang || tag
    }
    let settled = false
    const cur: VoiceCurrent = { owner: req.owner, settle: () => finish() }
    const timer = setTimeout(() => {
      if (!synth.speaking) finish()
    }, speakTimeoutMs(req.lang, text.length, req.rate))
    function finish(err?: Error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (voiceCurrent === cur) voiceCurrent = null
      if (err) reject(err)
      else resolve()
    }
    u.onend = () => finish()
    u.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error
      if (err === 'interrupted' || err === 'canceled') finish()
      else finish(new Error(String(err ?? 'tts-error')))
    }
    voiceCurrent = cur
    synth.speak(u)
  })
}

/** Bọc `lib/speech.ts` (không đổi hành vi tiếng Anh); `vi|zh|ja|ko` dùng giọng thiết bị theo `pickVoiceFor`. */
export class WebSpeechProvider implements TtsProvider {
  readonly id = 'web-speech' as const

  supports(lang: TtsLang): boolean {
    if (lang === 'en') return isTtsSupported()
    return pickVoiceFor(lang) !== undefined
  }

  speak(req: SpeakRequest): SpeakHandle {
    if (!this.supports(req.lang)) {
      return { promise: Promise.reject(new TtsError('unsupported')), cancel: () => {} }
    }
    if (req.lang !== 'en') {
      const lang = req.lang
      const promise = speakWithVoice({ ...req, lang }, pickVoiceFor(lang), DEVICE_TTS_TAG[lang])
      req.onStart?.()
      return {
        promise,
        cancel: () => {
          if (voiceCurrent?.owner !== req.owner) return
          voiceCurrent.settle()
          window.speechSynthesis.cancel()
        },
      }
    }
    // Gọi đồng bộ trong user gesture (iOS).
    const promise = speakSpeech({ text: req.text, rate: req.rate, voiceName: req.voiceName, owner: req.owner })
    req.onStart?.()
    return { promise, cancel: () => cancelSpeech(req.owner) }
  }

  /** Dừng mọi phát âm Web Speech (khi router chuyển sang provider khác). */
  stopAll(): void {
    voiceCurrent?.settle()
    cancelSpeech()
  }

  async probe(): Promise<ProbeResult> {
    return this.supports('en')
      ? { ok: true, ms: 0, voices: null }
      : { ok: false, ms: 0, error: new TtsError('unsupported') }
  }

  async listVoices(): Promise<TtsVoice[]> {
    const list = await getEnglishVoices()
    return list.map((v) => ({ id: v.name, label: v.name, lang: v.lang }))
  }
}
