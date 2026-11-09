import { newId } from '../lib/ids'
import type { PendingOp, PendingOpPayload, PendingOpType, Repository } from './types'

export const MAX_OPS = 50
export const MAX_ATTEMPTS = 20
/** Số id op đã replay xong được nhớ để chặn merge hồi sinh. */
export const MAX_DONE_IDS = 500

const OP_TYPES = [
  'upsertLesson',
  'upsertLessons',
  'deleteLesson',
  'upsertItems',
  'deleteItem',
  'upsertCards',
  'addReviewLog',
  'addStudyTime',
  'saveSettings',
] as const satisfies readonly PendingOpType[]

export function pendingKey(userId: string): string {
  return `vta:v1:pending:${userId}`
}

export function invalidPendingKey(userId: string): string {
  return `${pendingKey(userId)}:invalid`
}

export function lockName(userId: string): string {
  return `vta:pending:${userId}`
}

/** Op đọc từ storage có đủ trường meta và `type` thuộc các loại đã biết. */
export function isValidOp(v: unknown): v is PendingOp {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.createdAt === 'string' &&
    typeof o.attempts === 'number' &&
    Number.isFinite(o.attempts) &&
    (OP_TYPES as readonly unknown[]).includes(o.type)
  )
}

/**
 * Gộp hàng đợi nhiều tab theo `op.id`: op trùng id lấy bản `attempts` lớn hơn,
 * sắp theo `createdAt` (sort ổn định — giữ thứ tự xuất hiện khi trùng thời điểm).
 */
export function mergeOps(...lists: (readonly PendingOp[])[]): PendingOp[] {
  const byId = new Map<string, PendingOp>()
  for (const list of lists) {
    for (const op of list) {
      const prev = byId.get(op.id)
      if (!prev || op.attempts > prev.attempts) byId.set(op.id, op)
    }
  }
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
}

/** Map một op sang method tương ứng của Repository. */
export async function applyOp(repo: Repository, op: PendingOpPayload): Promise<void> {
  switch (op.type) {
    case 'upsertLesson':
      return repo.upsertLesson(op.lesson)
    case 'upsertLessons':
      return repo.upsertLessons(op.lessons)
    case 'deleteLesson':
      return repo.deleteLesson(op.lessonId)
    case 'upsertItems':
      return repo.upsertItems(op.items)
    case 'deleteItem':
      return repo.deleteItem(op.itemId)
    case 'upsertCards':
      return repo.upsertCards(op.cards)
    case 'addReviewLog':
      return repo.addReviewLog(op.log)
    case 'addStudyTime':
      await repo.addStudyTime(op.day, op.delta)
      return
    case 'saveSettings':
      return repo.saveSettings(op.settings)
    default: {
      const never: never = op
      throw new Error(`Op không hợp lệ: ${JSON.stringify(never)}`)
    }
  }
}

export interface ReplayResult {
  /** Số op đã chạy thành công và được gỡ khỏi hàng đợi. */
  replayed: number
  /** Op đầu tiên thất bại (đã tăng attempts); các op sau nó còn nguyên. */
  failed?: PendingOp
  error?: unknown
  /** Tab khác đang giữ lock replay → lượt này không chạy. */
  skipped?: boolean
}

export interface PendingState {
  size: number
  /** Lần ghi storage gần nhất thất bại (hàng đợi chỉ còn trong bộ nhớ). */
  persistFailed: boolean
}

export type PendingListener = (state: PendingState) => void

/** Tập con của Web Locks API cần dùng — cho phép inject trong test. */
export interface LockManagerLike {
  request<T>(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: unknown) => Promise<T>,
  ): Promise<T>
}

/**
 * Quyết định khi một op lỗi trong lúc replay (gọi khi tab này còn giữ lock):
 * - `retry`: giữ ở đầu hàng đợi (attempts + 1) và dừng lượt replay — mặc định.
 * - `drop`: gỡ op khỏi hàng đợi (caller tự sao lưu nếu cần) rồi chạy tiếp op sau.
 * - `retryNow`: thử lại ngay op này một lần nữa (vd. sau khi làm mới phiên); lần lỗi kế tiếp coi như `retry`.
 */
export type FailDecision = 'retry' | 'drop' | 'retryNow'

export interface ReplayOptions {
  onFail?: (op: PendingOp, error: unknown) => FailDecision | Promise<FailDecision>
}

export interface PendingQueueOptions {
  /** Mặc định `navigator.locks` nếu có; `null` để tắt lock. */
  locks?: LockManagerLike | null
}

function defaultLocks(): LockManagerLike | null {
  if (typeof navigator === 'undefined') return null
  const locks = (navigator as { locks?: LockManagerLike }).locks
  return locks ?? null
}

/**
 * Hàng đợi ghi chưa thành công (mục 2.4). Persist ở localStorage khoá `vta:v1:pending:<userId>`.
 * Không tự gắn `online`/interval — DataProvider gọi `replay()` khi cần.
 */
export class PendingQueue {
  readonly key: string
  readonly invalidKey: string
  private readonly lockName: string
  private readonly storage: Storage
  private readonly locks: LockManagerLike | null
  private ops: PendingOp[] = []
  /** id các op tab này đã replay xong — không để merge hồi sinh chúng. */
  private readonly done = new Set<string>()
  /** id các op chỉ có trong bộ nhớ vì persist() thất bại — load() không được làm mất chúng. */
  private readonly unsaved = new Set<string>()
  private listeners = new Set<PendingListener>()
  private running: Promise<ReplayResult> | null = null
  private persistFailed = false
  private stopSync: (() => void) | null = null

  constructor(userId: string, storage: Storage = window.localStorage, options: PendingQueueOptions = {}) {
    this.key = pendingKey(userId)
    this.invalidKey = invalidPendingKey(userId)
    this.lockName = lockName(userId)
    this.storage = storage
    this.locks = options.locks === undefined ? defaultLocks() : options.locks
    this.load()
  }

  get size(): number {
    return this.ops.length
  }

  list(): readonly PendingOp[] {
    return this.ops
  }

  private readStored(): unknown[] {
    try {
      const raw = this.storage.getItem(this.key)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  /**
   * Đọc lại hàng đợi từ storage (thay nội dung trong bộ nhớ). Op hỏng được chuyển (append)
   * sang khoá `:invalid` và gỡ khỏi khoá chính.
   */
  load(): readonly PendingOp[] {
    const stored = this.readStored()
    const valid: PendingOp[] = []
    const invalid: unknown[] = []
    for (const v of stored) (isValidOp(v) ? valid : invalid).push(v)
    if (invalid.length > 0) this.quarantine(invalid, valid)
    const keep = this.ops.filter((o) => this.unsaved.has(o.id))
    this.ops = mergeOps(valid, keep).filter((o) => !this.done.has(o.id))
    this.emit()
    return this.ops
  }

  private quarantine(invalid: unknown[], valid: PendingOp[]): void {
    try {
      let prev: unknown = []
      try {
        prev = JSON.parse(this.storage.getItem(this.invalidKey) ?? '[]')
      } catch {
        prev = []
      }
      const list = Array.isArray(prev) ? prev : [prev]
      this.storage.setItem(this.invalidKey, JSON.stringify([...list, ...invalid]))
      // chỉ gỡ khỏi khoá chính khi đã sao được sang :invalid
      this.storage.setItem(this.key, JSON.stringify(valid))
    } catch {
      // giữ nguyên storage; lần load sau thử lại
    }
  }

  /**
   * Gộp với bản trong storage (tab khác có thể đã ghi) rồi ghi xuống.
   * Trả `false` nếu ghi lỗi — hàng đợi vẫn còn trong bộ nhớ.
   */
  persist(): boolean {
    const stored = this.readStored().filter(isValidOp)
    this.ops = mergeOps(stored, this.ops).filter((o) => !this.done.has(o.id))
    try {
      if (this.ops.length === 0) this.storage.removeItem(this.key)
      else this.storage.setItem(this.key, JSON.stringify(this.ops))
      this.persistFailed = false
      this.unsaved.clear()
    } catch {
      this.persistFailed = true
      // op chưa có trong storage, hoặc bản trong bộ nhớ mới hơn (attempts lớn hơn)
      const inStorage = new Map(stored.map((o) => [o.id, o.attempts]))
      for (const o of this.ops) {
        const a = inStorage.get(o.id)
        if (a === undefined || o.attempts > a) this.unsaved.add(o.id)
      }
    }
    return !this.persistFailed
  }

  enqueue(payload: PendingOpPayload, now: Date = new Date()): PendingOp {
    const op = { ...payload, id: newId(), createdAt: now.toISOString(), attempts: 0 } as PendingOp
    this.ops = [...this.ops, op]
    this.persist()
    this.emit()
    return op
  }

  /**
   * Chạy FIFO; thành công → gỡ; thất bại → tăng attempts và dừng. Không ném lỗi.
   * Gọi chồng nhau trong cùng tab dùng chung một lượt; tab khác đang replay (Web Locks) → `skipped`.
   */
  replay(repo: Repository, options: ReplayOptions = {}): Promise<ReplayResult> {
    // lượt đang chạy dùng options của lần gọi đầu
    if (this.running) return this.running
    // gán `running` trước khi runReplay bắt đầu, để runReplay có thể tự xoá nó một cách đồng bộ
    const p = Promise.resolve().then(() => this.runReplay(repo, options))
    this.running = p
    return p
  }

  private async runReplay(repo: Repository, options: ReplayOptions): Promise<ReplayResult> {
    let replayed = 0
    try {
      for (;;) {
        const r = this.locks
          ? await this.locks.request(this.lockName, { ifAvailable: true }, async (lock) =>
              lock ? this.drain(repo, options) : null,
            )
          : await this.drain(repo, options)
        if (r === null) {
          this.running = null
          return { replayed, skipped: true }
        }
        replayed += r.replayed
        if (r.failed) {
          this.running = null
          return { ...r, replayed }
        }
        // op có thể được enqueue trong lúc nhả lock → chạy tiếp một lượt
        if (this.ops.length === 0) {
          this.running = null
          return { replayed }
        }
      }
    } catch (error) {
      // lỗi từ lock manager (không phải từ op)
      this.running = null
      return { replayed, error }
    }
  }

  private async drain(repo: Repository, options: ReplayOptions = {}): Promise<ReplayResult> {
    let replayed = 0
    const retriedNow = new Set<string>()
    while (this.ops.length > 0) {
      const op = this.ops[0]
      try {
        await applyOp(repo, op)
      } catch (error) {
        let decision: FailDecision = 'retry'
        if (options.onFail) {
          try {
            decision = await options.onFail(op, error)
          } catch {
            decision = 'retry'
          }
        }
        if (decision === 'retryNow' && !retriedNow.has(op.id)) {
          retriedNow.add(op.id)
          continue
        }
        if (decision === 'drop') {
          this.remove([op.id])
          continue
        }
        const current = this.ops.find((o) => o.id === op.id) ?? op
        const failed: PendingOp = { ...current, attempts: current.attempts + 1 }
        this.ops = this.ops.map((o) => (o.id === op.id ? failed : o))
        this.persist()
        this.emit()
        return { replayed, failed, error }
      }
      this.markDone(op.id)
      this.ops = this.ops.filter((o) => o.id !== op.id)
      replayed++
      this.persist()
      this.emit()
    }
    return { replayed }
  }

  /**
   * Gỡ op khỏi hàng đợi (vd. chuyển sang dead-letter). Op bị gỡ được nhớ như "đã xong" nên
   * merge/load sau này không hồi sinh chúng, kể cả khi persist lỗi.
   */
  remove(ids: readonly string[]): void {
    if (ids.length === 0) return
    const drop = new Set(ids)
    for (const id of drop) this.markDone(id)
    this.ops = this.ops.filter((o) => !drop.has(o.id))
    this.persist()
    this.emit()
  }

  /** Trạng thái hiện tại (size + persist gần nhất có lỗi không). */
  getState(): PendingState {
    return { size: this.ops.length, persistFailed: this.persistFailed }
  }

  private markDone(id: string): void {
    this.done.add(id)
    this.unsaved.delete(id)
    while (this.done.size > MAX_DONE_IDS) {
      const oldest = this.done.values().next().value
      if (oldest === undefined) break
      this.done.delete(oldest)
    }
  }

  /** Số op chỉ còn trong bộ nhớ (persist thất bại). */
  get unsavedCount(): number {
    return this.unsaved.size
  }

  /** Số id op đã xong đang được nhớ (≤ MAX_DONE_IDS). */
  get doneCount(): number {
    return this.done.size
  }

  /** Nghe sự kiện `storage` của khoá hàng đợi để `load()` lại khi tab khác ghi. Trả hàm dừng. */
  startCrossTabSync(): () => void {
    if (this.stopSync) return this.stopSync
    if (typeof window === 'undefined') return () => {}
    const onStorage = (e: Event) => {
      const key = (e as StorageEvent).key
      // key null = storage.clear() ở tab khác
      if (key === this.key || key === null) this.load()
    }
    window.addEventListener('storage', onStorage)
    this.stopSync = () => {
      window.removeEventListener('storage', onStorage)
      this.stopSync = null
    }
    return this.stopSync
  }

  stopCrossTabSync(): void {
    this.stopSync?.()
  }

  /** Quá MAX_OPS op hoặc có op thất bại quá MAX_ATTEMPTS lần. Không xoá hàng đợi. */
  isOverloaded(): boolean {
    return isOverloaded(this.ops)
  }

  subscribe(listener: PendingListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    const state = this.getState()
    for (const l of this.listeners) l(state)
  }
}

export function isOverloaded(ops: readonly PendingOp[]): boolean {
  return ops.length > MAX_OPS || ops.some((o) => o.attempts > MAX_ATTEMPTS)
}
