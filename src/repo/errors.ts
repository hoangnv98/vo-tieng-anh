// Lỗi repository + microcopy dùng chung. Không import supabase-js để mode local không kéo nó vào bundle.

// -----------------------------------------------------------------------------
// Microcopy (Phụ lục A, 6.1)
// -----------------------------------------------------------------------------
export const LOAD_ERROR_MESSAGE = 'Không tải được dữ liệu. Kiểm tra mạng rồi thử lại.'
export const WRITE_ERROR_MESSAGE = 'Chưa lưu được. Sẽ tự thử lại khi có mạng.'
export const RATE_LIMIT_MESSAGE = 'Bạn vừa yêu cầu một liên kết. Đợi khoảng một phút rồi thử lại.'
export const SEND_LINK_ERROR_MESSAGE = 'Không gửi được. Kiểm tra mạng rồi thử lại.'
export const NO_SESSION_MESSAGE = 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'
export const SIGN_OUT_ERROR_MESSAGE = 'Không đăng xuất được. Kiểm tra mạng rồi thử lại.'

// -----------------------------------------------------------------------------
// Lỗi
// -----------------------------------------------------------------------------
export interface RepoErrorOptions {
  code?: string
  status?: number
  cause?: unknown
}

/** Lỗi repository: message tiếng Việt cho người dùng, `code` (PostgREST / Auth) để chẩn đoán. Không chứa payload. */
export class RepoError extends Error {
  readonly code?: string
  readonly status?: number

  constructor(message: string, options: RepoErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'RepoError'
    this.code = options.code
    this.status = options.status
  }
}

export interface PostgrestLikeError {
  code?: string
  message?: string
}

/**
 * Mã Postgres mà replay lại cũng không thể thành công (vi phạm unique / FK / check, sai kiểu, RLS).
 * T06 dùng để không giữ op kẹt đầu hàng đợi vô hạn.
 */
// 22007/22008: ngày giờ sai; 22003: tràn số; 22P05: ký tự không lưu được (U+0000) — dữ liệu hỏng, thử lại vô ích.
const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set(['23505', '23503', '23514', '22P02', '22007', '22008', '22003', '22P05', '42501'])

export function isNonRetryableCode(code: string | undefined | null): boolean {
  return code != null && NON_RETRYABLE_CODES.has(code)
}

/**
 * Mã lỗi có thể do JWT vừa hết hạn (RLS từ chối vì `auth.uid()` null) → DataProvider nên gọi
 * `auth.getSession()` (tự refresh token) một lần rồi retry trước khi đánh dấu op thất bại.
 */
export function shouldRefreshBeforeFail(code: string | undefined | null): boolean {
  return code === '42501'
}

export interface NetworkLikeError {
  name?: string
  message?: string
  status?: number
}

/** Lỗi do mạng / timeout (fetch hỏng, AbortError, TimeoutError, AuthRetryableFetchError, status 0). */
export function isNetworkError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as NetworkLikeError
  return (
    err.status === 0 ||
    err.name === 'AbortError' ||
    err.name === 'TimeoutError' ||
    err.name === 'AuthRetryableFetchError' ||
    /failed to fetch|fetch failed|networkerror|load failed|aborted/i.test(err.message ?? '')
  )
}

/**
 * Đổi lỗi PostgREST thành RepoError chỉ giữ `code` + `status`.
 * Cố ý không giữ `details`/`message` gốc vì chúng có thể chứa giá trị cột (vd. `Key (number)=(3)`).
 * Không có code mà status 0 / lỗi fetch → `code: 'network'`.
 */
export function toRepoError(error: PostgrestLikeError, message: string, status?: number): RepoError {
  const network = !error.code && (status === 0 || isNetworkError(error))
  return new RepoError(message, { code: network ? 'network' : error.code || undefined, status })
}
