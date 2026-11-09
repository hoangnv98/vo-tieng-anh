import type { Snapshot } from '../domain/types'
import { newId } from '../lib/ids'
import { isNonRetryableCode, shouldRefreshBeforeFail } from '../repo/errors'
import { PendingQueue, applyOp, type LockManagerLike, type ReplayResult } from '../repo/pending'
import type { PendingOp, PendingOpPayload, Repository } from '../repo/types'
import { applyPendingOps } from './dataReducer'
import { MSG_CORRUPT, MSG_STORAGE_FULL, MSG_UNSYNCED, MSG_WRITE_ERROR } from './messages'
import {
  CORRUPT_KEY_RE,
  CORRUPT_SEEN_KEY,
  dependentCardOpIds,
  errorInfo,
  failedKey,
  isPatternDuplicate,
  unseenCorruptKeys,
  writeMode,
} from './sync'

function asOp(p: PendingOpPayload): PendingOp {
  return { ...p, id: newId(), createdAt: new Date().toISOString(), attempts: 1 } as PendingOp
}

/** Chỉ số các `upsertCards` sau vị trí `i` mà mọi thẻ đều thuộc `items`. */
function dependentPayloadIndexes(payloads: readonly PendingOpPayload[], i: number, items: readonly { id: string }[]): number[] {
  const itemIds = new Set(items.map((it) => it.id))
  const out: number[] = []
  for (let j = i + 1; j < payloads.length; j++) {
    const q = payloads[j]
    if (q.type === 'upsertCards' && q.cards.length > 0 && q.cards.every((c) => itemIds.has(c.item_id))) out.push(j)
  }
  return out
}

export type ToastTone = 'info' | 'error'

export interface PendingInfo {
  size: number
  persistFailed: boolean
  overloaded: boolean
}

export interface SyncCallbacks {
  notify(message: string, tone: ToastTone): void
  onSnapshot(snapshot: Snapshot): void
  onLoadError(): void
  onPending(info: PendingInfo): void
}

export interface SyncEngineOptions {
  repo: Repository
  userId: string
  mode: 'local' | 'supabase'
  callbacks: SyncCallbacks
  storage?: Storage
  /** Truyền xuống PendingQueue (test dùng `null`). */
  locks?: LockManagerLike | null
  /** Làm mới phiên (auth.getSession) trước khi coi lỗi 42501 là vĩnh viễn. */
  refreshSession?: () => Promise<unknown>
}

/** `initial`: lần đầu/Thử lại (lỗi → màn lỗi). `background`: sau khi tab ẩn lâu (chỉ khi hàng đợi rỗng). `reconcile`: sau lỗi không retry được. */
export type LoadKind = 'initial' | 'background' | 'reconcile'

export const REPLAY_INTERVAL_MS = 30_000
export const BACKGROUND_RELOAD_AFTER_MS = 10 * 60_000

/**
 * Bộ máy đồng bộ (2.4): mọi lần đọc/ghi repository đi qua một chuỗi promise duy nhất,
 * nên các op trong tab này luôn chạy đúng thứ tự gọi. Trước mỗi op mới: replay hàng đợi;
 * còn op tồn → op mới enqueue thẳng (FIFO tuyệt đối, điểm 7).
 */
export class SyncEngine {
  readonly queue: PendingQueue | null
  private readonly repo: Repository
  private readonly userId: string
  private readonly cb: SyncCallbacks
  private readonly storage: Storage
  private readonly refreshSession: () => Promise<unknown>
  /** id op đã được làm mới phiên + thử lại một lần sau 42501. */
  private readonly refreshed = new Set<string>()

  /** Số op đang được nhớ là đã làm mới phiên (test). */
  get refreshedCount(): number {
    return this.refreshed.size
  }
  private chain: Promise<void> = Promise.resolve()
  private inflight = 0
  private disposed = false
  private overloadNotified = false
  private corruptNotified = false
  private unsubscribe: (() => void) | null = null

  constructor(opts: SyncEngineOptions) {
    this.repo = opts.repo
    this.userId = opts.userId
    this.cb = opts.callbacks
    this.storage = opts.storage ?? window.localStorage
    this.refreshSession = opts.refreshSession ?? (() => Promise.resolve())
    this.queue =
      opts.mode === 'supabase'
        ? new PendingQueue(opts.userId, this.storage, opts.locks === undefined ? {} : { locks: opts.locks })
        : null
    if (this.queue) {
      this.unsubscribe = this.queue.subscribe((s) => {
        if (!this.disposed) this.cb.onPending({ ...s, overloaded: this.queue?.isOverloaded() ?? false })
      })
    }
  }

  pendingInfo(): PendingInfo {
    const q = this.queue
    if (!q) return { size: 0, persistFailed: false, overloaded: false }
    return { ...q.getState(), overloaded: q.isOverloaded() }
  }

  /** Gắn online / interval 30s / visibilitychange / storage. Trả hàm gỡ. */
  start(): () => void {
    this.cb.onPending(this.pendingInfo())
    const stopCrossTab = this.queue?.startCrossTabSync() ?? (() => {})
    const onOnline = () => void this.sync()
    const timer = window.setInterval(() => {
      if ((this.queue?.size ?? 0) > 0) void this.sync()
    }, REPLAY_INTERVAL_MS)
    let hiddenAt: number | null = null
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt > BACKGROUND_RELOAD_AFTER_MS) void this.load('background')
      hiddenAt = null
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopCrossTab()
      window.clearInterval(timer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  /** Có thao tác đang chờ trong chuỗi. */
  get busy(): boolean {
    return this.inflight > 0
  }

  /** Ghi một nhóm op theo thứ tự (không ném lỗi). */
  write(payloads: PendingOpPayload[]): Promise<void> {
    if (payloads.length === 0) return Promise.resolve()
    return this.task(() => this.execute(payloads))
  }

  /** Replay hàng đợi nếu còn op. */
  sync(): Promise<void> {
    return this.task(async () => {
      if (this.queue && this.queue.size > 0) await this.replay(true)
    })
  }

  load(kind: LoadKind): Promise<void> {
    return this.task(() => this.runLoad(kind))
  }

  /** Chờ chuỗi hiện tại chạy xong (test). */
  idle(): Promise<void> {
    return this.chain
  }

  private task(fn: () => Promise<void>): Promise<void> {
    this.inflight++
    const p = this.chain
      .then(() => (this.disposed ? undefined : fn()))
      .catch((e: unknown) => {
        const { code, status } = errorInfo(e)
        console.warn('[sync] lỗi không mong đợi', code, status)
      })
      .finally(() => {
        this.inflight--
      })
    this.chain = p
    return p
  }

  private async runLoad(kind: LoadKind): Promise<void> {
    if (this.queue && this.queue.size > 0) await this.replay(false)
    if (kind === 'background' && this.queue && this.queue.size > 0) return
    let snapshot: Snapshot
    try {
      snapshot = await this.repo.loadSnapshot()
    } catch (e) {
      const { code, status } = errorInfo(e)
      console.warn('[sync] tải snapshot thất bại', code, status)
      if (kind === 'initial' && !this.disposed) this.cb.onLoadError()
      return
    }
    if (this.disposed) return
    // Có thao tác lạc quan mới xếp sau trong chuỗi → thay state lúc này sẽ làm mất chúng; tải lại sau cùng.
    if (kind !== 'initial' && this.inflight > 1) {
      void this.load(kind)
      return
    }
    this.cb.onSnapshot(applyPendingOps(snapshot, this.queue?.list() ?? [], this.userId))
    this.scanCorrupt()
  }

  private async execute(payloads: PendingOpPayload[]): Promise<void> {
    const queue = this.queue
    if (!queue) {
      await this.executeLocal(payloads)
      return
    }
    let skipped = false
    if (queue.size > 0) skipped = (await this.replay(true)).skipped === true
    let reconcile = false
    const skip = new Set<number>()
    for (let i = 0; i < payloads.length; i++) {
      if (skip.has(i)) continue
      const p = payloads[i]
      if (writeMode({ queueSize: queue.size, skipped }) === 'enqueue') {
        queue.enqueue(p)
        continue
      }
      try {
        await this.applyWithRefresh(p)
      } catch (e) {
        const { code, status } = errorInfo(e)
        console.warn('[sync] ghi thất bại', code, status)
        if (!isNonRetryableCode(code)) {
          queue.enqueue(p)
          this.cb.notify(MSG_WRITE_ERROR, 'error')
          continue
        }
        reconcile = true
        // upsertCards cùng nhóm phụ thuộc vào items vừa lỗi → chắc chắn cũng lỗi (FK): bỏ cùng lúc
        const deps = p.type === 'upsertItems' ? dependentPayloadIndexes(payloads, i, p.items) : []
        for (const j of deps) skip.add(j)
        // mẫu câu đã có trên server: không phải mất dữ liệu, chỉ cần tải lại
        if (isPatternDuplicate(p, code)) continue
        this.deadLetter(asOp(p))
        for (const j of deps) this.deadLetter(asOp(payloads[j]))
        this.cb.notify(MSG_UNSYNCED, 'error')
      }
    }
    this.checkOverload()
    if (reconcile) void this.load('reconcile')
  }

  /** 42501 có thể do JWT vừa hết hạn: làm mới phiên một lần rồi thử lại trước khi coi là lỗi vĩnh viễn. */
  private async applyWithRefresh(p: PendingOpPayload): Promise<void> {
    try {
      await applyOp(this.repo, p)
    } catch (e) {
      if (!shouldRefreshBeforeFail(errorInfo(e).code)) throw e
      await this.refreshSafely()
      await applyOp(this.repo, p)
    }
  }

  private async refreshSafely(): Promise<void> {
    try {
      await this.refreshSession()
    } catch {
      // không làm mới được — để lần thử lại báo lỗi
    }
  }

  private async executeLocal(payloads: PendingOpPayload[]): Promise<void> {
    for (const p of payloads) {
      try {
        await applyOp(this.repo, p)
      } catch (e) {
        const message = e instanceof Error && e.message ? e.message : MSG_STORAGE_FULL
        this.cb.notify(message, 'error')
        return
      }
    }
  }

  /**
   * Replay FIFO. Op lỗi không retry được được xử lý ngay trong lúc còn giữ lock (`onFail`):
   * 42501 → làm mới phiên rồi thử lại một lần; mẫu câu trùng → bỏ op + thẻ phụ thuộc;
   * còn lại → dead-letter + bỏ. `reloadAfter`: xếp một lượt tải lại để hoà giải state.
   */
  private async replay(reloadAfter: boolean): Promise<ReplayResult> {
    const queue = this.queue
    if (!queue) return { replayed: 0 }
    let reconcile = false
    const r = await queue.replay(this.repo, {
      onFail: async (op, error) => {
        const { code, status } = errorInfo(error)
        console.warn('[sync] replay thất bại', code, status)
        if (!isNonRetryableCode(code)) return 'retry'
        if (shouldRefreshBeforeFail(code) && !this.refreshed.has(op.id)) {
          this.refreshed.add(op.id)
          await this.refreshSafely()
          return 'retryNow'
        }
        reconcile = true
        const depIds = new Set(
          op.type === 'upsertItems' ? dependentCardOpIds(queue.list(), new Set(op.items.map((it) => it.id))) : [],
        )
        const deps = queue.list().filter((o) => depIds.has(o.id))
        if (isPatternDuplicate(op, code)) {
          queue.remove(deps.map((o) => o.id))
          return 'drop'
        }
        this.deadLetter(op)
        for (const d of deps) this.deadLetter(d)
        queue.remove(deps.map((o) => o.id))
        this.cb.notify(MSG_UNSYNCED, 'error')
        return 'drop'
      },
    })
    // op đã thành công hoặc bị gỡ → không cần nhớ lượt làm mới phiên nữa
    if (this.refreshed.size > 0) {
      const live = new Set(queue.list().map((o) => o.id))
      for (const id of this.refreshed) if (!live.has(id)) this.refreshed.delete(id)
    }
    if (r.failed) {
      const { code, status } = errorInfo(r.error)
      console.warn('[sync] hàng đợi dừng ở op lỗi', code, status)
    }
    this.checkOverload()
    if (reconcile && reloadAfter) void this.load('reconcile')
    return r
  }

  private deadLetter(op: PendingOp): void {
    const key = failedKey(this.userId)
    try {
      let prev: unknown = []
      try {
        prev = JSON.parse(this.storage.getItem(key) ?? '[]')
      } catch {
        prev = []
      }
      const list = Array.isArray(prev) ? prev : [prev]
      this.storage.setItem(key, JSON.stringify([...list, op]))
    } catch {
      // bộ nhớ đầy: không có chỗ sao lưu
    }
  }

  private checkOverload(): void {
    if (this.overloadNotified || !this.queue?.isOverloaded()) return
    this.overloadNotified = true
    this.cb.notify(MSG_UNSYNCED, 'error')
  }

  /** Báo một lần các khoá `vta:v1:*:corrupt-*` mới xuất hiện (LocalRepository sao lưu JSON hỏng). */
  private scanCorrupt(): void {
    if (this.corruptNotified) return
    try {
      const keys: string[] = []
      for (let i = 0; i < this.storage.length; i++) {
        const k = this.storage.key(i)
        if (k && CORRUPT_KEY_RE.test(k)) keys.push(k)
      }
      if (keys.length === 0) return
      let seen: unknown = []
      try {
        seen = JSON.parse(this.storage.getItem(CORRUPT_SEEN_KEY) ?? '[]')
      } catch {
        seen = []
      }
      const fresh = unseenCorruptKeys(keys, Array.isArray(seen) ? (seen as string[]) : [])
      if (fresh.length === 0) return
      this.corruptNotified = true
      this.cb.notify(MSG_CORRUPT, 'info')
      this.storage.setItem(CORRUPT_SEEN_KEY, JSON.stringify(keys))
    } catch {
      // không đọc được storage — bỏ qua
    }
  }
}
