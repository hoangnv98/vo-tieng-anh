import { useEffect } from 'react'

export const APP_NAME = 'Vở Ngoại Ngữ'

/** `document.title = "{Tên màn} · Vở Ngoại Ngữ"`. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
