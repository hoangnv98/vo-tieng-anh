import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.tsx'
import { initServices } from './state/services'

// repo/auth phải sẵn sàng trước khi providers render (createRepository có thể async).
const root = createRoot(document.getElementById('root')!)
initServices().then(
  () => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  },
  () => {
    // không tải được module repo (vd. mất mạng khi nạp chunk supabase)
    root.render(
      <p role="alert" style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px', color: 'var(--red)', fontWeight: 500 }}>
        Không tải được ứng dụng. Kiểm tra mạng rồi tải lại trang.
      </p>,
    )
  },
)
