import './Spinner.css'

/** Vòng 24px; `prefers-reduced-motion` → chấm tĩnh. Chữ thay thế luôn có (ẩn nếu `hideLabel`). */
export function Spinner({ label = 'Đang tải…', hideLabel = false }: { label?: string; hideLabel?: boolean }) {
  return (
    <span className="spinner" role="status">
      <span className="spinner-ring" aria-hidden="true" />
      <span className={hideLabel ? 'visually-hidden' : 'spinner-label'}>{label}</span>
    </span>
  )
}
