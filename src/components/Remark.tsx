import './Remark.css'

/** Lời phê Charm đỏ — tối đa 1 / màn. Không render khi rỗng. */
export function Remark({ children, className }: { children?: string | null; className?: string }) {
  if (!children || children.trim() === '') return null
  return <p className={['remark', className].filter(Boolean).join(' ')}>{children}</p>
}
