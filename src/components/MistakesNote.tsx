import { Marked } from './Marked'
import './MistakesNote.css'

/** "Lỗi hay gặp:" — nhãn đỏ gạch chân, không viền trái. `inline` = dạng dòng mục trong trang vở. */
export function MistakesNote({
  text,
  inline = false,
  className,
}: {
  text: string
  inline?: boolean
  className?: string
}) {
  if (!text.trim()) return null
  const body = (
    <>
      <span className="mistakes-label">Lỗi hay gặp:</span>{' '}
      <span className="mistakes-text">
        <Marked text={text} />
      </span>
    </>
  )
  const extra = className ? ` ${className}` : ''
  return inline ? (
    <div className={`entry mistakes-note mistakes-note--inline${extra}`}>{body}</div>
  ) : (
    <p className={`mistakes-note${extra}`}>{body}</p>
  )
}
