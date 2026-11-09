import type { PendingOp, PendingOpPayload } from '../repo/types'

/** Lấy `code`/`status` từ lỗi repository (RepoError hoặc lỗi bất kỳ) — không đụng tới payload. */
export function errorInfo(e: unknown): { code: string | undefined; status: number | undefined } {
  if (typeof e !== 'object' || e === null) return { code: undefined, status: undefined }
  const o = e as { code?: unknown; status?: unknown }
  return {
    code: typeof o.code === 'string' ? o.code : undefined,
    status: typeof o.status === 'number' ? o.status : undefined,
  }
}

/**
 * Quyết định ghi trực tiếp hay enqueue (2.4 điểm 7, FIFO tuyệt đối): sau `replay()`,
 * nếu hàng đợi còn op hoặc lượt replay bị tab khác giữ lock → op mới phải xếp hàng sau.
 */
export function writeMode(args: { queueSize: number; skipped?: boolean }): 'direct' | 'enqueue' {
  return args.queueSize > 0 || args.skipped === true ? 'enqueue' : 'direct'
}

/** 23505 trên upsertItems có pattern_id → mẫu câu đã có trên server (2.4 điểm 11). */
export function isPatternDuplicate(op: PendingOpPayload, code: string | undefined): boolean {
  return code === '23505' && op.type === 'upsertItems' && op.items.some((i) => i.pattern_id !== null)
}

/** Id các op `upsertCards` mà mọi thẻ đều thuộc `itemIds` (phụ thuộc vào op upsertItems bị bỏ). */
export function dependentCardOpIds(ops: readonly PendingOp[], itemIds: ReadonlySet<string>): string[] {
  return ops
    .filter((o) => o.type === 'upsertCards' && o.cards.length > 0 && o.cards.every((c) => itemIds.has(c.item_id)))
    .map((o) => o.id)
}

export function failedKey(userId: string): string {
  return `vta:v1:pending:${userId}:failed`
}

/** Khoá sao lưu dữ liệu hỏng của LocalRepository: `vta:v1:<tên>:corrupt-<ts>`. */
export const CORRUPT_KEY_RE = /^vta:v1:.+:corrupt-/

export const CORRUPT_SEEN_KEY = 'vta:v1:corrupt-seen'

/** Khoá corrupt chưa từng báo cho người dùng. */
export function unseenCorruptKeys(keys: readonly string[], seen: readonly string[]): string[] {
  const s = new Set(seen)
  return keys.filter((k) => CORRUPT_KEY_RE.test(k) && !s.has(k))
}
