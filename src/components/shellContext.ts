import { createContext, useContext, useEffect } from 'react'

export interface ShellContextValue {
  /** Ẩn thanh dưới mobile (phiên ôn đang chạy) — Shell gắn `data-review-active`. */
  setBottomBarHidden(hidden: boolean): void
}

export const ShellContext = createContext<ShellContextValue>({ setBottomBarHidden: () => {} })

/** Ẩn thanh dưới khi `active`; tự hiện lại khi unmount. */
export function useHideBottomBar(active: boolean): void {
  const { setBottomBarHidden } = useContext(ShellContext)
  useEffect(() => {
    setBottomBarHidden(active)
    return () => setBottomBarHidden(false)
  }, [active, setBottomBarHidden])
}
