import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Tích hợp Supabase trên Vercel Marketplace nạp biến theo tên `SUPABASE_URL`,
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`… nhưng Vite chỉ đưa
 * vào client các biến bắt đầu bằng `VITE_`. Khi thiếu `VITE_SUPABASE_*`, lấy giá trị
 * đầu tiên có trong danh sách tên tương đương. Không bao giờ ánh xạ `service_role`.
 */
const ENV_ALIASES: Record<string, string[]> = {
  VITE_SUPABASE_URL: ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
  VITE_SUPABASE_ANON_KEY: [
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_OR_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
  ],
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Prefix '' để đọc cả biến không có VITE_ từ .env và process.env (Vercel).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  for (const [target, sources] of Object.entries(ENV_ALIASES)) {
    if (env[target]?.trim()) continue
    const found = sources.map((k) => env[k]?.trim()).find(Boolean)
    if (found) process.env[target] = found
  }
  return { plugins: [react()] }
})
