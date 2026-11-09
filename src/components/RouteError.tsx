import { CircleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import { Button } from './Button'
import './RouteError.css'

/** errorElement của router: khối lỗi tiếng Việt + "Tải lại trang". Không hiện chi tiết lỗi. */
export function RouteError() {
  const error = useRouteError()
  usePageTitle('Có lỗi')
  useEffect(() => {
    const name = error instanceof Error ? error.name : typeof error
    console.warn('[router] lỗi route', name)
  }, [error])
  return (
    <main id="main" tabIndex={-1} className="route-error">
      <div className="card route-error-box" role="alert">
        <p className="route-error-text">
          <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" className="route-error-icon" />
          <span>Không mở được trang này. Kiểm tra mạng rồi tải lại trang.</span>
        </p>
        <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
      </div>
    </main>
  )
}
