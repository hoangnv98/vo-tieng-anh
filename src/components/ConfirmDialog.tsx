import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  /** Khoá nút nguy hiểm (vd. chưa gõ xác nhận). */
  confirmDisabled?: boolean
  /** Kiểu nút xác nhận: `danger` (mặc định, xoá/đăng xuất) hoặc `primary` (thao tác không phá huỷ, vd. nhập dữ liệu). */
  confirmVariant?: 'danger' | 'primary'
  /** Nội dung thêm giữa mô tả và hàng nút (vd. ô xác nhận). */
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

/** `<dialog>` native: Huỷ (trái, nhận focus) — nút xác nhận (phải, mặc định kiểu nguy hiểm). Esc = Huỷ. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Huỷ',
  confirmDisabled = false,
  confirmVariant = 'danger',
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      cancelRef.current?.focus()
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <h2 id={titleId} className="confirm-title">
        {title}
      </h2>
      {description && (
        <p id={descId} className="confirm-desc">
          {description}
        </p>
      )}
      {children && <div className="confirm-body">{children}</div>}
      <div className="confirm-actions">
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmDisabled}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
