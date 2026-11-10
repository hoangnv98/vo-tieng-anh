import { useState, type Ref } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './Field.css'

export interface PasswordFieldProps {
  id: string
  label: string
  name: string
  autoComplete: 'current-password' | 'new-password'
  value: string
  onChange(value: string): void
  error?: string | null
  description?: string
  disabled?: boolean
  /** id phần tử mô tả thêm bên ngoài (vd. khối lỗi đăng nhập) — ghép vào `aria-describedby`. */
  describedBy?: string
  ref?: Ref<HTMLInputElement>
}

/**
 * (T21) Ô mật khẩu + nút hiện/ẩn (aria-pressed) — cùng kiểu `.field*` với `Field`.
 * Không placeholder, không maxLength (để lỗi 72 ký tự hiện rõ), không trim.
 */
export function PasswordField({
  id,
  label,
  name,
  autoComplete,
  value,
  onChange,
  error,
  description,
  disabled = false,
  describedBy: extraDescribedBy,
  ref,
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false)
  // giá trị người dùng gõ gần nhất: cha xoá ô (value → '') thì ẩn lại; người dùng tự xoá hết thì giữ nguyên
  const [typed, setTyped] = useState(value)
  if (value === '' && typed !== '') {
    setTyped('')
    if (shown) setShown(false)
  }

  const descId = description ? `${id}-desc` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [descId, errId, extraDescribedBy].filter(Boolean).join(' ') || undefined

  return (
    <div className={error ? 'field field--error' : 'field'}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="pw-wrap">
        <input
          ref={ref}
          id={id}
          name={name}
          type={shown ? 'text' : 'password'}
          className="field-control pw-control"
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setTyped(e.target.value)
            onChange(e.target.value)
          }}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        <button
          type="button"
          className="pw-toggle"
          aria-pressed={shown}
          aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-controls={id}
          disabled={disabled}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? (
            <EyeOff size={20} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>
      {description && (
        <p id={descId} className="field-desc">
          {description}
        </p>
      )}
      {error && (
        <p id={errId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
