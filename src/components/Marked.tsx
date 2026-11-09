import { Fragment } from 'react'
import { parseMarked } from '../domain/lessons'
import './MistakesNote.css'

/** Nội dung có `*từ*` → gạch lượn đỏ. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {parseMarked(text).map((seg, i) =>
        seg.mark ? (
          <em key={i} className="wavy">
            {seg.text}
          </em>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  )
}
