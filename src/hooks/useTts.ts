import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useData } from '../state/useData'
import { getEnglishVoices, isTtsSupported } from '../lib/speech'
import { canSpeak, cancel as cancelTts, speak as speakTts, subscribe as subscribeTts, usingEnServer, type TtsLang } from '../lib/tts'

/** Chờ server quá ngưỡng này mới coi là "đang tải" (đổi icon). */
export const LOADING_DELAY_MS = 300

const getViAvailable = () => canSpeak('vi')
const getEnServer = () => usingEnServer()
const getFalse = () => false

export function useTts() {
  const { snapshot } = useData()
  const voiceName = snapshot?.settings?.voice_name ?? null
  /** Chỉ Web Speech (buildQueue/thẻ listen dựa vào đây); server EN không đổi nghĩa. */
  const supported = isTtsSupported()
  const viAvailable = useSyncExternalStore(subscribeTts, getViAvailable, getFalse)
  const enServer = useSyncExternalStore(subscribeTts, getEnServer, getFalse)
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)
  const token = useRef(0)
  /** true khi instance này đang sở hữu phát âm hiện tại. */
  const ownerRef = useRef<object | null>(null)
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(loadingTimer.current)
      if (ownerRef.current) cancelTts(ownerRef.current)
    }
  }, [])

  const speak = useCallback(
    (text: string, opts: { rate?: number; lang?: TtsLang } = {}): Promise<void> => {
      const id = ++token.current
      const owner = {}
      ownerRef.current = owner
      setSpeaking(true)
      setLoading(false)
      clearTimeout(loadingTimer.current)
      let started = false
      loadingTimer.current = setTimeout(() => {
        if (token.current === id && !started && mounted.current) setLoading(true)
      }, LOADING_DELAY_MS)
      const onStart = () => {
        started = true
        if (token.current !== id) return
        clearTimeout(loadingTimer.current)
        if (mounted.current) setLoading(false)
      }
      const end = () => {
        if (token.current !== id) return
        clearTimeout(loadingTimer.current)
        if (ownerRef.current === owner) ownerRef.current = null
        if (mounted.current) {
          setSpeaking(false)
          setLoading(false)
        }
      }
      // speak() được gọi đồng bộ để còn nằm trong user gesture.
      return speakTts({ text, rate: opts.rate, lang: opts.lang ?? 'en', voiceName, owner, onStart }).then(end, (e) => {
        end()
        throw e
      })
    },
    [voiceName],
  )

  const cancel = useCallback(() => {
    token.current++
    clearTimeout(loadingTimer.current)
    if (ownerRef.current) cancelTts(ownerRef.current)
    ownerRef.current = null
    setSpeaking(false)
    setLoading(false)
  }, [])

  return { supported, viAvailable, enServer, speaking, loading, speak, cancel }
}

/** Danh sách giọng tiếng Anh (chỉ Settings dùng). `loaded` false cho tới khi tải xong. */
export function useVoices() {
  const supported = isTtsSupported()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [loaded, setLoaded] = useState(!supported)
  useEffect(() => {
    if (!supported) return
    let alive = true
    void getEnglishVoices().then((v) => {
      if (!alive) return
      setVoices(v)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [supported])
  return { supported, voices, loaded }
}
