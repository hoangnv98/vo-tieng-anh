import type { ReactNode } from 'react'
import './EmptyState.css'

export interface EmptyStateProps {
  title: string
  description?: string
  /** Một nút/link primary. */
  action?: ReactNode
  /** Tuỳ chọn: một nút/link ghost. */
  secondary?: ReactNode
  /** 1 khi EmptyState là nội dung chính của màn (vd. 404), mặc định 2. */
  headingLevel?: 1 | 2
}

export function EmptyState({ title, description, action, secondary, headingLevel = 2 }: EmptyStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div className="empty">
      <Heading className="empty-title">{title}</Heading>
      {description && <p className="empty-desc">{description}</p>}
      {(action || secondary) && (
        <div className="empty-actions">
          {action}
          {secondary}
        </div>
      )}
    </div>
  )
}
