import type { ReactNode } from 'react'
import './PageTitle.css'

/** H1 thống nhất (28px / 24px). Không kicker/eyebrow phía trên. */
export function PageTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="page-title">
      {children}
    </h1>
  )
}
