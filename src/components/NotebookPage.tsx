import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Remark } from './Remark'
import './NotebookPage.css'

export interface NotebookPageProps {
  dateLine?: string
  title?: string
  remark?: string | null
  children?: ReactNode
  className?: string
}

const LINE = 48

/** Làm tròn chiều cao mỗi `.entry` lên bội số 48px (mobile: câu EN xuống 2 dòng 24px + VI 24px = 72px). */
function snapEntries(body: HTMLElement): void {
  body.querySelectorAll<HTMLElement>('.entry').forEach((el) => {
    el.style.minHeight = ''
    const h = el.getBoundingClientRect().height
    const snapped = Math.ceil(Math.round(h) / LINE) * LINE
    if (snapped > Math.round(h)) el.style.minHeight = `${snapped}px`
  })
}

/**
 * Trang vở ô ly (5.5). Mỗi con trực tiếp của thân trang phải là một dòng mục `.entry`
 * (được làm tròn chiều cao lên bội số 48px để giữ lưới):
 * `<div className="entry"><span className="en" lang="en">…</span><span className="vi">…</span></div>`.
 * Khối khác (nút, ghi chú, EmptyState…) đặt ngoài trang, hoặc bọc trong một `.entry` — nếu không,
 * các dòng phía sau sẽ lệch lưới.
 */
export function NotebookPage({ dateLine, title, remark, children, className }: NotebookPageProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  // Nội dung đổi → snap lại.
  useLayoutEffect(() => {
    if (bodyRef.current) snapEntries(bodyRef.current)
  }, [children])

  // Gắn một lần: đổi bề rộng (xuống dòng khác) và font swap (display=swap) đều có thể đổi chiều cao.
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    let alive = true
    void document.fonts?.ready.then(() => alive && snapEntries(body))
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        alive = false
      }
    }
    let lastWidth = body.clientWidth
    // chỉ phản ứng khi bề rộng đổi — min-height do chính snap đặt không gây vòng lặp
    const ro = new ResizeObserver(() => {
      if (body.clientWidth === lastWidth) return
      lastWidth = body.clientWidth
      snapEntries(body)
    })
    ro.observe(body)
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [])

  const hasHead = Boolean(dateLine || title)
  const hasRemark = Boolean(remark && remark.trim())
  const cls = [
    'notebook-page',
    'ruled-paper',
    hasHead ? null : 'notebook-page--no-head',
    hasRemark ? 'notebook-page--has-remark' : null,
    className,
  ]
  return (
    <section className={cls.filter(Boolean).join(' ')}>
      {hasHead && (
        // Đầu trang luôn cao 24 + 48·n px (ô ngày 24px + mỗi dòng tiêu đề 48px) để thân trang giữ đúng lưới.
        <header className="notebook-head">
          <p className="notebook-date">{dateLine ? <span className="notebook-mask">{dateLine}</span> : null}</p>
          {title ? (
            <h2 className="notebook-title">
              <span className="notebook-mask">{title}</span>
            </h2>
          ) : (
            <div className="notebook-title" aria-hidden="true" />
          )}
        </header>
      )}
      {hasRemark && <Remark className="notebook-remark">{remark}</Remark>}
      <div ref={bodyRef} className="notebook-body">
        {children}
      </div>
    </section>
  )
}
