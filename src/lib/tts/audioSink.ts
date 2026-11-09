import { TtsError } from './types'

/**
 * Một `<audio>` dùng chung cho mọi provider server. iOS chỉ cho `play()` sau fetch nếu chính phần tử
 * này đã được `play()` trong user gesture → `prime()` phát WAV im lặng ~50 ms đồng bộ trong handler.
 * Không dùng AudioContext (đổi playbackRate làm méo cao độ; `<audio>` có preservesPitch).
 */

/** WAV PCM 8-bit mono 8 kHz, 400 mẫu im lặng (~50 ms). */
export const SILENT_WAV =
  'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'

export interface AudioSink {
  isSupported(): boolean
  prime(): void
  play(blob: Blob, rate: number): Promise<void>
  stop(): void
}

let el: HTMLAudioElement | null = null
let unlocked = false
let objectUrl: string | null = null
let active: { settle: (err?: Error) => void } | null = null

export function isAudioSupported(): boolean {
  return typeof Audio !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
}

function getEl(): HTMLAudioElement | null {
  if (!isAudioSupported()) return null
  if (!el) {
    el = new Audio()
    el.preload = 'auto'
    el.setAttribute('playsinline', '')
    ;(el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
  }
  return el
}

function revoke() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

function detach(a: HTMLAudioElement) {
  a.onended = null
  a.onerror = null
  a.onloadedmetadata = null
}

export function isUnlocked(): boolean {
  return unlocked
}

/** Gọi đồng bộ trong user gesture, trước mọi `await`. Đã mở khoá → không làm gì. */
export function prime(): void {
  if (unlocked) return
  const a = getEl()
  if (!a) return
  detach(a)
  a.src = SILENT_WAV
  try {
    const p = a.play()
    if (p && typeof p.then === 'function') p.then(() => { unlocked = true }, () => {})
  } catch {
    // bỏ qua
  }
}

/** Dừng âm thanh hiện tại (lượt đang phát resolve), revoke object URL. */
export function stop(): void {
  const cur = active
  active = null
  if (el) {
    detach(el)
    try {
      el.pause()
    } catch {
      // bỏ qua
    }
  }
  revoke()
  cur?.settle()
}

/** Phát blob; resolve khi `ended` hoặc khi bị `stop()`; reject `TtsError('autoplay'|'decode')`. */
export function play(blob: Blob, rate: number): Promise<void> {
  const a = getEl()
  if (!a) return Promise.reject(new TtsError('unsupported'))
  stop()
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const me = {
      settle: (err?: Error) => {
        if (settled) return
        settled = true
        if (active === me) active = null
        if (err) reject(err)
        else resolve()
      },
    }
    active = me
    const finish = (err?: Error) => {
      if (active !== me) return
      detach(a)
      revoke()
      me.settle(err)
    }
    objectUrl = URL.createObjectURL(blob)
    a.onended = () => finish()
    a.onerror = () => finish(new TtsError('decode'))
    const applyRate = () => {
      a.defaultPlaybackRate = rate
      a.playbackRate = rate
      const ap = a as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }
      ap.preservesPitch = true
      if ('webkitPreservesPitch' in ap) ap.webkitPreservesPitch = true
    }
    // Một số trình duyệt reset playbackRate khi nạp src mới → gán lại sau loadedmetadata.
    a.onloadedmetadata = () => {
      if (active === me) applyRate()
    }
    a.src = objectUrl
    applyRate()
    let p: Promise<void> | undefined
    try {
      p = a.play()
    } catch (e) {
      finish(new TtsError((e as Error)?.name === 'NotAllowedError' ? 'autoplay' : 'decode'))
      return
    }
    if (p && typeof p.then === 'function') {
      p.then(
        () => {
          unlocked = true
        },
        (e: unknown) => {
          const name = (e as Error)?.name
          if (name === 'AbortError') return // bị pause/đổi src — stop() đã xử lý
          finish(new TtsError(name === 'NotAllowedError' ? 'autoplay' : 'decode'))
        },
      )
    }
  })
}

export const audioSink: AudioSink = { isSupported: isAudioSupported, prime, play, stop }

/** Chỉ dùng cho test. */
export function _resetAudioSink(): void {
  el = null
  unlocked = false
  objectUrl = null
  active = null
}
