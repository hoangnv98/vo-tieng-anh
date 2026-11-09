import { CircleAlert } from 'lucide-react'
import { useEffect } from 'react'
import './Toast.css'

export interface ToastData {
  id: string
  message: string
  tone: 'info' | 'error'
}

export const TOAST_MS = 4000

/** Vùng thông báo `role="status"` luôn có trong DOM; nội dung tự ẩn sau 4s. */
export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(onDismiss, TOAST_MS)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className="toast">
          {toast.tone === 'error' && (
            <CircleAlert className="toast-icon" size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
