import { cancel as cancelSpeech, getEnglishVoices, isTtsSupported, speak as speakSpeech } from '../speech'
import { prepareText } from './text'
import { TtsError, type ProbeResult, type SpeakHandle, type SpeakRequest, type TtsLang, type TtsProvider, type TtsVoice } from './types'

function viVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return []
  try {
    return window.speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('vi'))
  } catch {
    return []
  }
}

interface ViCurrent {
  owner: object
  settle: () => void
}
let viCurrent: ViCurrent | null = null

/** Giọng `vi-*` của thiết bị (chỉ khi người dùng bật `deviceFallback`). `lib/speech.ts` chỉ lo tiếng Anh. */
function speakVi(req: SpeakRequest): Promise<void> {
  const synth = window.speechSynthesis
  // Dừng mọi phát âm Web Speech khác (EN qua lib/speech, VI trước đó).
  cancelSpeech()
  viCurrent?.settle()
  return new Promise<void>((resolve, reject) => {
    const text = prepareText(req.text, 'vi').join(' ')
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'vi-VN'
    u.rate = req.rate
    const voice = viVoices()[0]
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    }
    let settled = false
    const cur: ViCurrent = { owner: req.owner, settle: () => finish() }
    const timer = setTimeout(() => {
      if (!synth.speaking) finish()
    }, (text.length * 120) / Math.max(req.rate, 0.1) + 5000)
    function finish(err?: Error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (viCurrent === cur) viCurrent = null
      if (err) reject(err)
      else resolve()
    }
    u.onend = () => finish()
    u.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error
      if (err === 'interrupted' || err === 'canceled') finish()
      else finish(new Error(String(err ?? 'tts-error')))
    }
    viCurrent = cur
    synth.speak(u)
  })
}

/** Bọc `lib/speech.ts` (không đổi hành vi tiếng Anh). */
export class WebSpeechProvider implements TtsProvider {
  readonly id = 'web-speech' as const

  supports(lang: TtsLang): boolean {
    if (lang === 'en') return isTtsSupported()
    return viVoices().length > 0
  }

  speak(req: SpeakRequest): SpeakHandle {
    if (!this.supports(req.lang)) {
      return { promise: Promise.reject(new TtsError('unsupported')), cancel: () => {} }
    }
    if (req.lang === 'vi') {
      const promise = speakVi(req)
      req.onStart?.()
      return {
        promise,
        cancel: () => {
          if (viCurrent?.owner !== req.owner) return
          viCurrent.settle()
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
    viCurrent?.settle()
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
