/**
 * (T21) Phiên bị thu hồi phía server (vd. 403 `session_not_found` khi đặt mật khẩu): auth-js không tự xoá
 * session cục bộ nên `loginLoader` sẽ đẩy `/login` về `/`. Đăng xuất trước (lỗi thì bỏ qua — supabase-js
 * vẫn xoá session cục bộ với 401/403/404) để AuthProvider nhận SIGNED_OUT, rồi mới điều hướng.
 */
export async function leaveLostSession(signOut: () => Promise<void>, go: () => void): Promise<void> {
  try {
    await signOut()
  } catch {
    /* phiên đã mất; vẫn rời đi */
  }
  go()
}
