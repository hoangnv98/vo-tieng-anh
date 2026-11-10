// (T21) Chế độ mặc định của /login theo thiết bị (6.15 (3)-D). Không lưu email, không lưu mật khẩu.

export type LoginMode = 'link' | 'password'
export const LOGIN_MODE_KEY = 'vta:v1:login-mode'

/** `localStorage` nếu dùng được; Safari private cũ / môi trường không có DOM → null. */
function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Giá trị lạ, lỗi đọc, thiếu storage → `'link'`. */
export function readLoginMode(storage: Storage | null = safeLocalStorage()): LoginMode {
  if (!storage) return 'link'
  try {
    return storage.getItem(LOGIN_MODE_KEY) === 'password' ? 'password' : 'link'
  } catch {
    return 'link'
  }
}

/** Nuốt mọi lỗi (quota, private mode) — không báo gì cho người dùng. */
export function writeLoginMode(mode: LoginMode, storage: Storage | null = safeLocalStorage()): void {
  if (!storage) return
  try {
    storage.setItem(LOGIN_MODE_KEY, mode)
  } catch {
    /* bỏ qua */
  }
}
