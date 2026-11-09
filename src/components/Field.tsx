import { useId, type ComponentPropsWithRef } from 'react'
import './Field.css'

interface FieldBase {
  label: string
  description?: string
  error?: string | null
}

type InputField = FieldBase & { as?: 'input' } & ComponentPropsWithRef<'input'>
type TextareaField = FieldBase & { as: 'textarea' } & ComponentPropsWithRef<'textarea'>
type SelectField = FieldBase & { as: 'select' } & ComponentPropsWithRef<'select'>

export type FieldProps = InputField | TextareaField | SelectField

/** Label + input/textarea/select + mô tả + lỗi (aria-describedby, aria-invalid). */
export function Field(props: FieldProps) {
  const autoId = useId()
  const { label, description, error, id: givenId, className, ...rest } = props
  const id = givenId ?? autoId
  const descId = description ? `${id}-desc` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [descId, errId].filter(Boolean).join(' ') || undefined
  const control = {
    id,
    className: ['field-control', className].filter(Boolean).join(' '),
    'aria-describedby': describedBy,
    'aria-invalid': error ? (true as const) : undefined,
  }

  let input
  if (rest.as === 'textarea') {
    const { as: _as, ...p } = rest
    void _as
    input = <textarea {...p} {...control} />
  } else if (rest.as === 'select') {
    const { as: _as, ...p } = rest
    void _as
    input = <select {...p} {...control} />
  } else {
    const { as: _as, ...p } = rest
    void _as
    input = <input {...p} {...control} />
  }

  return (
    <div className={error ? 'field field--error' : 'field'}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {input}
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
