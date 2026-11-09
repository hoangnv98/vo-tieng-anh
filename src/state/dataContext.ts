import { createContext } from 'react'
import type { ImportCounts, ImportFile } from '../domain/importSnapshot'
import type { Card, Grade, Item, Lesson, Settings, Snapshot } from '../domain/types'
import type { StudyTimeDelta } from '../repo/types'
import type { DataStatus } from './dataReducer'
import type { PendingInfo, ToastTone } from './syncEngine'

export interface GradeResult {
  card: Card
  /** Đẩy về cuối hàng đợi phiên (4.4.6). */
  requeue: boolean
  /** Số thẻ chiều mới (vi_en/listen) thực sự được tạo do mở khoá (4.3); 0 nếu không. */
  unlocked: number
}

/** Kết quả thực tế của `importSnapshot` (để hiện toast). */
export interface ImportResult extends ImportCounts {
  /** Đã ghi cài đặt từ tệp. */
  settings: boolean
}

/** Câu báo khi chặn nhập ở chế độ Supabase (offline hoặc còn op chờ đồng bộ). */
export const IMPORT_BLOCKED_MESSAGE = 'Nhập dữ liệu cần có mạng và không còn thay đổi chờ đồng bộ.'

/**
 * Mọi action ghi đều trả Promise: resolve ngay sau khi state lạc quan đã cập nhật (không chờ mạng —
 * ghi repo chạy nền qua hàng đợi FIFO, lỗi ghi báo bằng toast). Reject khi dữ liệu chưa `ready`
 * hoặc đầu vào không hợp lệ (vd. thẻ không tồn tại) — không bao giờ throw đồng bộ.
 */
export interface DataContextValue {
  mode: 'local' | 'supabase'
  status: DataStatus
  /** `null` khi chưa `ready`. */
  snapshot: Snapshot | null
  pending: PendingInfo
  online: boolean
  retry(): void
  createLesson(l: Lesson): Promise<void>
  updateLesson(l: Lesson): Promise<void>
  deleteLesson(id: string): Promise<void>
  /** Upsert items; item mới (chưa có thẻ en_vi) được sinh 1 thẻ `en_vi` (4.3). */
  saveItems(items: Item[]): Promise<void>
  deleteItem(id: string): Promise<void>
  /** Như saveItems nhưng bỏ item có `pattern_id` đã có/đang thêm; tự gán user_id; trả số item thực thêm. */
  addPatternItems(items: Item[]): Promise<number>
  /** `timesShown` = số lần thẻ đã hiện trong phiên, kể cả lần này. */
  gradeCard(cardId: string, grade: Grade, durationMs: number, timesShown: number): Promise<GradeResult>
  addStudyTime(delta: StudyTimeDelta): Promise<void>
  saveSettings(s: Settings): Promise<void>
  /**
   * Gộp tệp xuất vào dữ liệu hiện có (6.13-B). Resolve sau khi state lạc quan cập nhật; ghi repo chạy nền.
   * Reject với `IMPORT_BLOCKED_MESSAGE` khi mode supabase mà offline hoặc còn op chờ đồng bộ.
   */
  importSnapshot(file: ImportFile, opts: { includeSettings: boolean }): Promise<ImportResult>
  /** Hiện toast (vd "Đã lưu."). */
  notify(message: string, tone?: ToastTone): void
}

export const DataContext = createContext<DataContextValue | null>(null)
