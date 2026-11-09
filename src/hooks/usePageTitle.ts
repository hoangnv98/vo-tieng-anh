import { useEffect } from 'react'

export const APP_NAME = 'Vở Tiếng Anh'

/** `document.title = "{Tên màn} · Vở Tiếng Anh"`. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
