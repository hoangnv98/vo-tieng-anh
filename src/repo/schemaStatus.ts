// (T20, SPEC 3.2) Cờ "Supabase chưa chạy migration khối 9" của phiên. Tách khỏi repo/supabase.ts để
// DataProvider nối notifier mà không nạp tĩnh repository Supabase (mode local vẫn tách bundle).

export const SCHEMA_OUTDATED_MESSAGE =
  'Supabase chưa có cột ngôn ngữ. Chạy lại supabase/schema.sql để lưu ngôn ngữ buổi học.'

let schemaOutdated = false
let schemaOutdatedNotified = false
let schemaOutdatedNotifier: ((message: string) => void) | undefined

/** Đã gặp PGRST204 trong phiên này (server thiếu cột ngôn ngữ). */
export function isSchemaOutdated(): boolean {
  return schemaOutdated
}

/**
 * Nơi hiện toast "Supabase chưa có cột ngôn ngữ…" (DataProvider nối `notify`). Repo tự bảo đảm 1 lần/phiên;
 * nếu lỗi xảy ra trước khi có notifier, thông báo được phát ngay khi notifier được đặt.
 */
export function setSchemaOutdatedNotifier(fn: ((message: string) => void) | undefined): void {
  schemaOutdatedNotifier = fn
  if (fn && schemaOutdated && !schemaOutdatedNotified) {
    schemaOutdatedNotified = true
    fn(SCHEMA_OUTDATED_MESSAGE)
  }
}

/** Gọi khi gặp PGRST204: đặt cờ và báo đúng 1 lần/phiên. */
export function markSchemaOutdated(): void {
  schemaOutdated = true
  if (schemaOutdatedNotified || !schemaOutdatedNotifier) return
  schemaOutdatedNotified = true
  schemaOutdatedNotifier(SCHEMA_OUTDATED_MESSAGE)
}

/** Chỉ cho test: đưa cờ module về trạng thái đầu phiên. */
export function resetSchemaOutdatedForTest(): void {
  schemaOutdated = false
  schemaOutdatedNotified = false
  schemaOutdatedNotifier = undefined
}
