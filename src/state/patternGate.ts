import type { Item } from '../domain/types'

/**
 * Chặn thêm trùng `pattern_id` khi gọi chồng: item nào có pattern_id đã có trong state
 * hoặc đang được thêm dở (đã claim) thì bị loại. Đồng bộ, gọi trước mọi `await`.
 */
export function createPatternGate() {
  const inFlight = new Set<string>()
  return {
    claim(items: Item[], have: ReadonlySet<string>): Item[] {
      const out: Item[] = []
      for (const i of items) {
        const pid = i.pattern_id
        if (pid !== null) {
          if (have.has(pid) || inFlight.has(pid)) continue
          inFlight.add(pid)
        }
        out.push(i)
      }
      return out
    },
    release(items: Item[]) {
      for (const i of items) if (i.pattern_id !== null) inFlight.delete(i.pattern_id)
    },
  }
}
