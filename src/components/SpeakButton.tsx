import type { ReactNode } from 'react'
import { Info, LoaderCircle, Square, Volume2 } from 'lucide-react'
import { useTts } from '../hooks/useTts'
import { isTtsSupported } from '../lib/speech'
import type { TtsLang } from '../lib/tts'
import { missingVoiceText } from '../domain/languageCore'
import type { Language } from '../domain/types'
import { buttonClass } from './buttonClass'
import './SpeakButton.css'

export interface SpeakButtonProps {
  text: string
  /** Bỏ trống = để facade chọn (VI áp `vi.speed`). */
  rate?: number
  size?: 'md' | 'lg'
  label?: string
  /**
   * `'vi'` chỉ hiện khi có server tiếng Việt (hoặc giọng thiết bị đã bật); `zh|ja|ko` chỉ hiện khi thiết bị có giọng.
   * Mặc định `'en'`.
   */
  lang?: TtsLang
  /** Chữ hiển thị cạnh icon (đổi thành "Dừng" khi đang phát). */
  visibleLabel?: string
}

export function SpeakButton({ text, rate, size = 'md', label, lang = 'en', visibleLabel }: SpeakButtonProps) {
  const { supported, viAvailable, canSpeakLang, speaking, loading, speak, cancel } = useTts()
  const name = loading ? 'Đang tải giọng đọc. Bấm để dừng.' : speaking ? 'Dừng' : (label ?? 'Nghe phát âm')

  function onClick() {
    if (speaking) {
      cancel()
      return
    }
    speak(text, { rate, lang }).catch(() => {})
  }

  const available = lang === 'en' ? supported : lang === 'vi' ? viAvailable : canSpeakLang(lang)
  if (!available) return null

  return (
    <button
      type="button"
      className={buttonClass('secondary', size, visibleLabel ? 'speak-btn speak-btn--labeled' : 'speak-btn')}
      aria-label={name}
      onClick={onClick}
    >
      {loading ? (
        <LoaderCircle className="speak-btn-loader" size={20} strokeWidth={1.75} aria-hidden="true" />
      ) : speaking ? (
        <Square size={20} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Volume2 size={20} strokeWidth={1.75} aria-hidden="true" />
      )}
      {visibleLabel && (speaking || loading ? 'Dừng' : visibleLabel)}
    </button>
  )
}

/**
 * Dòng Info "không đọc được". `lang` ≠ en và trình duyệt có Web Speech → câu thiếu giọng ngôn ngữ đó;
 * còn lại → câu cũ (hoặc `children`).
 */
export function TtsUnsupportedNote({ children, lang }: { children?: ReactNode; lang?: Language }) {
  const missingVoice = lang !== undefined && lang !== 'en' && isTtsSupported()
  return (
    <p className="tts-note">
      <Info size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>
        {missingVoice ? missingVoiceText(lang) : (children ?? 'Trình duyệt này không đọc được câu mẫu. Hãy thử Chrome hoặc Edge.')}
      </span>
    </p>
  )
}
