/** TTS bằng Web Speech API. Mọi hàm an toàn khi trình duyệt không hỗ trợ. */

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

let voiceCache: SpeechSynthesisVoice[] | null = null

function filterEnglish(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return all.filter((v) => v.lang.toLowerCase().startsWith('en'))
}

/** Giọng tiếng Anh. Chrome trả rỗng lúc đầu → chờ `voiceschanged` tối đa ~1s. */
export function getEnglishVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTtsSupported()) return Promise.resolve([])
  if (voiceCache && voiceCache.length > 0) return Promise.resolve(voiceCache)
  const synth = window.speechSynthesis
  const now = filterEnglish(synth.getVoices())
  if (now.length > 0) {
    voiceCache = now
    return Promise.resolve(now)
  }
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      synth.removeEventListener?.('voiceschanged', finish)
      const list = filterEnglish(synth.getVoices())
      if (list.length > 0) voiceCache = list
      resolve(list)
    }
    const timer = setTimeout(finish, 1000)
    synth.addEventListener?.('voiceschanged', finish)
  })
}

export function pickDefaultVoice(
  voices: SpeechSynthesisVoice[],
  preferredName?: string | null,
): SpeechSynthesisVoice | undefined {
  if (preferredName) {
    const saved = voices.find((v) => v.name === preferredName)
    if (saved) return saved
  }
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase()
  return voices.find((v) => norm(v) === 'en-us') ?? voices.find((v) => norm(v).startsWith('en'))
}

export interface SpeakOptions {
  text: string
  rate?: number
  voiceName?: string | null
  /** Token sở hữu phát âm; dùng với isCurrent/cancel(owner). */
  owner?: object
}

interface Current {
  utterance: SpeechSynthesisUtterance
  owner: object
  settle: () => void
  timer: ReturnType<typeof setTimeout> | undefined
}
let current: Current | null = null

/** Phải gọi trực tiếp trong user gesture (iOS Safari): synth.speak() được gọi đồng bộ, không await trước. */
export function speak({ text, rate = 1, voiceName, owner = {} }: SpeakOptions): Promise<void> {
  if (!isTtsSupported()) return Promise.reject(new Error('tts-unsupported'))
  const synth = window.speechSynthesis
  // Kết thúc phát âm cũ (resolve + clear timer) trước khi cancel.
  current?.settle()
  synth.cancel()
  return new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = rate
    const voice = pickDefaultVoice(filterEnglish(synth.getVoices()), voiceName)
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    }
    let settled = false
    const cur: Current = { utterance: u, owner, settle: () => finish(), timer: undefined }
    function finish(err?: Error) {
      if (settled) return
      settled = true
      clearTimeout(cur.timer)
      if (current === cur) current = null
      if (err) reject(err)
      else resolve()
    }
    let extensions = 0
    function schedule(ms: number) {
      cur.timer = setTimeout(() => {
        if (current !== cur) return
        if (synth.speaking && extensions < 3) {
          extensions++
          schedule(3000)
        } else finish()
      }, ms)
    }
    schedule((text.length * 100) / Math.max(rate, 0.1) + 3000)
    u.onend = () => finish()
    u.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error
      if (err === 'interrupted' || err === 'canceled') finish()
      else finish(new Error(String(err ?? 'tts-error')))
    }
    current = cur
    synth.speak(u)
  })
}

/** `owner` có giá trị mà không còn là phát âm hiện tại → không làm gì. */
export function cancel(owner?: object): void {
  if (owner && current?.owner !== owner) return
  current?.settle()
  if (isTtsSupported()) window.speechSynthesis.cancel()
}

export function isCurrent(owner: object): boolean {
  return current?.owner === owner
}

/** Chỉ dùng cho test. */
export function _resetVoiceCache(): void {
  voiceCache = null
  current = null
}
