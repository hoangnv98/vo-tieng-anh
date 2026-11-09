import type { ReactNode } from 'react'
import { Info, LoaderCircle, Square, Volume2 } from 'lucide-react'
import { useTts } from '../hooks/useTts'
import type { TtsLang } from '../lib/tts'
import { buttonClass } from './buttonClass'
import './SpeakButton.css'

export interface SpeakButtonProps {
  text: string
  /** Bỏ trống = để facade chọn (VI áp `vi.speed`). */
  rate?: number
  size?: 'md' | 'lg'
  label?: string
  /** `'vi'` chỉ hiện khi có server tiếng Việt (hoặc giọng thiết bị đã bật). Mặc định `'en'`. */
  lang?: TtsLang
  /** Chữ hiển thị cạnh icon (đổi thành "Dừng" khi đang phát). */
  visibleLabel?: string
}

export function SpeakButton({ text, rate, size = 'md', label, lang = 'en', visibleLabel }: SpeakButtonProps) {
  const { supported, viAvailable, speaking, loading, speak, cancel } = useTts()
  const name = loading ? 'Đang tải giọng đọc. Bấm để dừng.' : speaking ? 'Dừng' : (label ?? 'Nghe phát âm')

  function onClick() {
    if (speaking) {
      cancel()
      return
    }
    speak(text, { rate, lang }).catch(() => {})
  }

  if (lang === 'vi' ? !viAvailable : !supported) return null

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

export function TtsUnsupportedNote({ children }: { children?: ReactNode }) {
  return (
    <p className="tts-note">
      <Info size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>{children ?? 'Trình duyệt này không đọc được câu mẫu. Hãy thử Chrome hoặc Edge.'}</span>
    </p>
  )
}
