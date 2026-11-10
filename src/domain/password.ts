// (T21) Quy tắc mật khẩu phía client (6.15 (3)-A, 12.1.38) — thuần, không React.
// Không trim, không yêu cầu loại ký tự; độ dài đếm bằng `.length` (giới hạn bcrypt 72).

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

/** Regex email của 6.1 (dùng chung cho cả hai chế độ đăng nhập). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const EMAIL_MAX = 254

/** `email` đã trim + lowercase bên ngoài. */
export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX && EMAIL_RE.test(email)
}

export type NewPasswordError = 'too_short' | 'too_long' | 'mismatch'

/** Đặt / đổi mật khẩu (Cài đặt). Hợp lệ → null. `mismatch` chỉ báo ở ô nhập lại. */
export function validateNewPassword(
  password: string,
  confirm: string,
): { password?: NewPasswordError; confirm?: NewPasswordError } | null {
  const out: { password?: NewPasswordError; confirm?: NewPasswordError } = {}
  if (password.length < PASSWORD_MIN) out.password = 'too_short'
  else if (password.length > PASSWORD_MAX) out.password = 'too_long'
  if (confirm !== password) out.confirm = 'mismatch'
  return out.password || out.confirm ? out : null
}

export type PasswordLoginError = { email?: 'invalid'; password?: 'required' }

/**
 * Đăng nhập bằng mật khẩu: email theo 6.1, mật khẩu chỉ cần khác rỗng (không kiểm tra độ dài —
 * không lộ chính sách, không chặn mật khẩu cũ). `email` đã trim + lowercase bên ngoài.
 */
export function validatePasswordLogin(email: string, password: string): PasswordLoginError | null {
  const out: PasswordLoginError = {}
  if (!isValidEmail(email)) out.email = 'invalid'
  if (password.length === 0) out.password = 'required'
  return out.email || out.password ? out : null
}

/** Microcopy lỗi tại trường (6.15 (6)). */
export const PASSWORD_ERROR_TEXT: Record<NewPasswordError | 'invalid' | 'required', string> = {
  too_short: 'Mật khẩu cần ít nhất 8 ký tự.',
  too_long: 'Mật khẩu tối đa 72 ký tự.',
  mismatch: 'Hai mật khẩu chưa giống nhau.',
  invalid: 'Email chưa đúng. Kiểm tra lại giúp mình nhé.',
  required: 'Nhập mật khẩu.',
}
