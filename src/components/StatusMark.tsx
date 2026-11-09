import type { ReactNode } from 'react'
import './StatusMark.css'

export type StatusVariant = 'forgot' | 'hard' | 'new' | 'learning'

const LABELS: Record<Exclude<StatusVariant, 'forgot'>, string> = {
  hard: 'khó',
  new: 'mới',
  learning: 'đang học',
}

/** Dấu trạng thái thẻ: chỉ chữ (không badge nền). `forgot` đỏ, còn lại mute. */
export function StatusMark({
  variant,
  lapses = 1,
  children,
}: {
  variant: StatusVariant
  lapses?: number
  children?: ReactNode
}) {
  const text = children ?? (variant === 'forgot' ? `quên ${lapses} lần` : LABELS[variant])
  return <span className={`status-mark status-mark--${variant}`}>{text}</span>
}
