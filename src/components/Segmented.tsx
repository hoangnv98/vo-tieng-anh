import { useRef, type KeyboardEvent } from 'react'
import './Segmented.css'

export interface SegmentedProps<T extends string | number> {
  label?: string
  labelledBy?: string
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
  /** (T21) Khoá cả nhóm (đang gửi / đang đăng nhập). */
  disabled?: boolean
  /** (T21) Chiếm hết chiều ngang, các nút chia đều (`seg--fill`). */
  fill?: boolean
}

/** Nhóm nút chọn một (`role="radiogroup"`), phím mũi tên di chuyển + chọn. Dùng ở Shadowing và Đăng nhập. */
export function Segmented<T extends string | number>({
  label,
  labelledBy,
  value,
  options,
  onChange,
  disabled = false,
  fill = false,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    const cur = options.findIndex((o) => o.value === value)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div
      className={fill ? 'seg seg--fill' : 'seg'}
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => {
        const checked = o.value === value
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="seg-btn"
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
