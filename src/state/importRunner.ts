import { buildImportOps, planImport, type ImportFile } from '../domain/importSnapshot'
import type { Card, Snapshot } from '../domain/types'
import { localDay } from '../lib/dates'
import type { PendingOpPayload } from '../repo/types'
import { IMPORT_BLOCKED_MESSAGE, type ImportResult } from './dataContext'
import type { DataAction } from './dataReducer'

/** Phần của SyncEngine mà luồng nhập cần (cho phép engine giả trong test). */
export interface ImportEngine {
  pendingInfo(): { size: number }
  write(ops: PendingOpPayload[]): Promise<void>
  load(kind: 'background'): Promise<void>
}

export interface ImportDeps {
  mode: 'local' | 'supabase'
  online(): boolean
  /** Snapshot/engine/user hiện tại; ném lỗi nếu dữ liệu chưa sẵn sàng. */
  ready(): { snapshot: Snapshot; engine: ImportEngine; userId: string }
  dispatch(action: DataAction): void
  /** Sinh thẻ en_vi mới (createCardRecord). */
  createCard(args: { userId: string; itemId: string; now: Date }): Promise<Card>
  now?: () => Date
}

/**
 * Luồng `importSnapshot` (6.13-B (5).5–8):
 * chặn (supabase + offline/pending) → kế hoạch nháp + sinh thẻ thiếu → (supabase) tải lại nền để hoà giải →
 * lập lại kế hoạch với snapshot mới (sinh thêm thẻ nếu cần) → một dispatch `import/apply` → một `engine.write`
 * → sau khi ghi xong, mode supabase và hàng đợi rỗng → tải lại nền.
 */
export async function runImport(
  file: ImportFile,
  opts: { includeSettings: boolean },
  deps: ImportDeps,
): Promise<ImportResult> {
  const first = deps.ready()
  if (deps.mode === 'supabase' && (!deps.online() || first.engine.pendingInfo().size > 0)) {
    throw new Error(IMPORT_BLOCKED_MESSAGE)
  }
  const now = deps.now?.() ?? new Date()
  const today = localDay(now)
  const drafts = new Map<string, Card>()
  const generate = async (itemIds: readonly string[], userId: string) => {
    const made = await Promise.all(itemIds.map((itemId) => deps.createCard({ userId, itemId, now })))
    for (const c of made) drafts.set(c.item_id, c)
  }

  const draftPlan = planImport(file, first.snapshot, first.userId, today, now)
  await generate(draftPlan.itemsNeedingCard, first.userId)
  if (deps.mode === 'supabase') await first.engine.load('background')

  let cur = deps.ready()
  let plan = planImport(file, cur.snapshot, cur.userId, today, now)
  const missing = plan.itemsNeedingCard.filter((id) => !drafts.has(id))
  if (missing.length > 0) {
    await generate(missing, cur.userId)
    cur = deps.ready()
    plan = planImport(file, cur.snapshot, cur.userId, today, now)
  }

  const generated = plan.itemsNeedingCard.flatMap((id) => {
    const c = drafts.get(id)
    return c ? [c] : []
  })
  const lacking = plan.itemsNeedingCard.length - generated.length
  const cards = [...plan.cards, ...generated]
  const withSettings = opts.includeSettings && plan.settings !== null
  if (plan.counts.skipped > 0) console.warn('[import] bỏ qua bản ghi', plan.skippedReasons)

  deps.dispatch({ type: 'import/apply', plan: { ...plan, cards }, includeSettings: withSettings })

  const ops = buildImportOps(plan, cards, withSettings)
  const { engine } = cur
  if (ops.length > 0) {
    void engine
      .write(ops)
      .then(() => (deps.mode === 'supabase' && engine.pendingInfo().size === 0 ? engine.load('background') : undefined))
  }
  return {
    ...plan.counts,
    cards: { ...plan.counts.cards, add: plan.counts.cards.add - lacking },
    settings: withSettings,
  }
}
