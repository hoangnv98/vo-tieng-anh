import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Settings, StudyDay } from '../domain/types'
import { MemoryStorage } from './memoryStorage.test-util'
import {
  MAX_ATTEMPTS,
  MAX_DONE_IDS,
  MAX_OPS,
  PendingQueue,
  applyOp,
  invalidPendingKey,
  isOverloaded,
  pendingKey,
  type LockManagerLike,
  type PendingState,
} from './pending'
import type { PendingOp, Repository } from './types'

const SETTINGS: Settings = { user_id: 'u1', display_name: '', daily_goal_min: 15, new_cards_per_day: 15, voice_name: null, auto_speak: false }

function fakeRepo(calls: string[] = []) {
  const record = (name: string) =>
    vi.fn(async (...args: unknown[]) => {
      calls.push(`${name}:${JSON.stringify(args[0])}`)
    })
  const repo = {
    loadSnapshot: vi.fn(),
    exportAll: vi.fn(),
    upsertLesson: record('upsertLesson'),
    upsertLessons: record('upsertLessons'),
    deleteLesson: record('deleteLesson'),
    upsertItems: record('upsertItems'),
    deleteItem: record('deleteItem'),
    upsertCards: record('upsertCards'),
    addReviewLog: record('addReviewLog'),
    addStudyTime: vi.fn(async (day: string): Promise<StudyDay> => {
      calls.push(`addStudyTime:${JSON.stringify(day)}`)
      return { user_id: 'u1', day, seconds: 0, reviews: 0, shadowing_count: 0 }
    }),
    saveSettings: record('saveSettings'),
  }
  return repo as typeof repo & Repository
}

function stored(storage: Storage, userId = 'u1'): PendingOp[] {
  return JSON.parse(storage.getItem(pendingKey(userId)) ?? '[]') as PendingOp[]
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// Chạy mỗi kịch bản với Web Locks thật của Node và khi không có lock.
const LOCK_MODES: [string, LockManagerLike | null | undefined][] = [
  ['navigator.locks', undefined],
  ['không có locks', null],
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('applyOp', () => {
  it('upsertLessons gọi repo.upsertLessons với cả mảng; isValidOp nhận op upsertLessons', async () => {
    const calls: string[] = []
    const repo = fakeRepo(calls)
    await applyOp(repo, { type: 'upsertLessons', lessons: [] })
    expect(repo.upsertLessons).toHaveBeenCalledWith([])
    const storage = new MemoryStorage()
    const q = new PendingQueue('u1', storage, { locks: null })
    q.enqueue({ type: 'upsertLessons', lessons: [] })
    expect(new PendingQueue('u1', storage, { locks: null }).size).toBe(1)
    expect(calls).toEqual(['upsertLessons:[]'])
  })
})

describe('PendingQueue', () => {
  it('enqueue persist/load round-trip theo khoá vta:v1:pending:<userId>', () => {
    const storage = new MemoryStorage()
    const q = new PendingQueue('u1', storage)
    const op = q.enqueue({ type: 'deleteItem', itemId: 'I1' }, new Date('2026-11-09T00:00:00Z'))
    q.enqueue({ type: 'saveSettings', settings: SETTINGS })
    expect(op).toMatchObject({ type: 'deleteItem', itemId: 'I1', attempts: 0, createdAt: '2026-11-09T00:00:00.000Z' })
    expect(op.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(pendingKey('u1')).toBe('vta:v1:pending:u1')
    expect(stored(storage)).toHaveLength(2)

    const q2 = new PendingQueue('u1', storage)
    expect(q2.size).toBe(2)
    expect(q2.list()).toEqual(q.list())
    expect(new PendingQueue('u2', storage).size).toBe(0)
  })

  for (const [mode, locks] of LOCK_MODES) {
    describe(mode, () => {
      it('replay FIFO gọi đúng method theo thứ tự rồi gỡ hết', async () => {
        const storage = new MemoryStorage()
        const q = new PendingQueue('u1', storage, { locks })
        q.enqueue({ type: 'deleteLesson', lessonId: 'L1' })
        q.enqueue({ type: 'addStudyTime', day: '2026-11-09', delta: { seconds: 30 } })
        q.enqueue({ type: 'deleteItem', itemId: 'I9' })
        q.enqueue({ type: 'saveSettings', settings: SETTINGS })
        const calls: string[] = []
        const repo = fakeRepo(calls)
        expect(await q.replay(repo)).toEqual({ replayed: 4 })
        expect(calls).toEqual([
          'deleteLesson:"L1"',
          'addStudyTime:"2026-11-09"',
          'deleteItem:"I9"',
          `saveSettings:${JSON.stringify(SETTINGS)}`,
        ])
        expect(repo.addStudyTime).toHaveBeenCalledWith('2026-11-09', { seconds: 30 })
        expect(q.size).toBe(0)
        expect(new PendingQueue('u1', storage).size).toBe(0)
      })

      it('op thất bại → dừng tại đó, attempts tăng, op sau còn nguyên', async () => {
        const storage = new MemoryStorage()
        const q = new PendingQueue('u1', storage, { locks })
        q.enqueue({ type: 'deleteLesson', lessonId: 'L1' })
        const bad = q.enqueue({ type: 'deleteItem', itemId: 'I1' })
        const after = q.enqueue({ type: 'saveSettings', settings: SETTINGS })
        const repo = fakeRepo()
        const err = new Error('offline')
        repo.deleteItem.mockRejectedValueOnce(err)

        const res = await q.replay(repo)
        expect(res.replayed).toBe(1)
        expect(res.failed).toMatchObject({ id: bad.id, attempts: 1 })
        expect(res.error).toBe(err)
        expect(repo.saveSettings).not.toHaveBeenCalled()
        expect(q.list().map((o) => o.id)).toEqual([bad.id, after.id])
        expect(q.list()[1]).toEqual(after)
        expect(new PendingQueue('u1', storage).list()[0].attempts).toBe(1)

        expect(await q.replay(repo)).toEqual({ replayed: 2 })
        expect(q.size).toBe(0)
      })

      it('(a) 2 replay đồng thời → mỗi method chạy đúng 1 lần', async () => {
        const q = new PendingQueue('u1', new MemoryStorage(), { locks })
        q.enqueue({ type: 'deleteLesson', lessonId: 'L1' })
        q.enqueue({ type: 'deleteItem', itemId: 'I1' })
        const repo = fakeRepo()
        const p1 = q.replay(repo)
        const p2 = q.replay(repo)
        expect(p2).toBe(p1) // dùng chung một lượt
        const [r1, r2] = await Promise.all([p1, p2])
        expect(repo.deleteLesson).toHaveBeenCalledTimes(1)
        expect(repo.deleteItem).toHaveBeenCalledTimes(1)
        expect(r1).toEqual({ replayed: 2 })
        expect(r2).toBe(r1)
        expect(q.size).toBe(0)
        // lượt sau khởi động lại bình thường
        q.enqueue({ type: 'deleteItem', itemId: 'I2' })
        expect(await q.replay(repo)).toEqual({ replayed: 1 })
      })

      it('(b) enqueue trong lúc một op đang await → op mới chạy trong cùng lượt', async () => {
        const q = new PendingQueue('u1', new MemoryStorage(), { locks })
        q.enqueue({ type: 'deleteLesson', lessonId: 'L1' })
        const repo = fakeRepo()
        const gate = deferred()
        let entered!: () => void
        const started = new Promise<void>((r) => {
          entered = r
        })
        repo.deleteLesson.mockImplementationOnce(async () => {
          entered()
          await gate.promise
        })
        const p = q.replay(repo)
        await started
        q.enqueue({ type: 'deleteItem', itemId: 'I1' })
        gate.resolve()
        expect(await p).toEqual({ replayed: 2 })
        expect(repo.deleteItem).toHaveBeenCalledWith('I1')
        expect(q.size).toBe(0)
      })
    })
  }

  it('tab khác giữ lock → { replayed: 0, skipped: true }, không gọi repo', async () => {
    const busy: LockManagerLike = {
      request: (_name, _opts, cb) => cb(null),
    }
    const request = vi.spyOn(busy, 'request')
    const q = new PendingQueue('u1', new MemoryStorage(), { locks: busy })
    q.enqueue({ type: 'deleteItem', itemId: 'I1' })
    const repo = fakeRepo()
    expect(await q.replay(repo)).toEqual({ replayed: 0, skipped: true })
    expect(request).toHaveBeenCalledWith('vta:pending:u1', { ifAvailable: true }, expect.any(Function))
    expect(repo.deleteItem).not.toHaveBeenCalled()
    expect(q.size).toBe(1)
  })

  it('subscribe nhận { size, persistFailed }, unsubscribe dừng nhận', async () => {
    const q = new PendingQueue('u1', new MemoryStorage())
    const states: PendingState[] = []
    const off = q.subscribe((s) => states.push(s))
    q.enqueue({ type: 'deleteItem', itemId: 'I1' })
    await q.replay(fakeRepo())
    off()
    q.enqueue({ type: 'deleteItem', itemId: 'I2' })
    expect(states).toEqual([
      { size: 1, persistFailed: false },
      { size: 0, persistFailed: false },
    ])
  })

  it('(c) persist thất bại → hàng đợi vẫn trong bộ nhớ, listener nhận persistFailed: true', () => {
    const storage = new MemoryStorage()
    const q = new PendingQueue('u1', storage)
    const states: PendingState[] = []
    q.subscribe((s) => states.push(s))
    storage.failWith = new DOMException('full', 'QuotaExceededError')
    const op = q.enqueue({ type: 'deleteItem', itemId: 'I1' })
    expect(q.list()).toEqual([op])
    expect(states.at(-1)).toEqual({ size: 1, persistFailed: true })
    expect(q.persist()).toBe(false)
    storage.failWith = null
    expect(q.persist()).toBe(true)
    expect(stored(storage).map((o) => o.id)).toEqual([op.id])
  })

  it('op chưa lưu được (storage đầy) không bị load() từ tab khác làm mất', () => {
    const win = new EventTarget()
    vi.stubGlobal('window', win)
    const storage = new MemoryStorage()
    const q = new PendingQueue('u1', storage)
    q.startCrossTabSync()
    const op1 = q.enqueue({ type: 'deleteItem', itemId: 'I1' }, new Date('2026-11-09T00:00:00Z'))
    storage.failWith = new DOMException('full', 'QuotaExceededError')
    const op2 = q.enqueue({ type: 'deleteItem', itemId: 'I2' }, new Date('2026-11-09T00:00:01Z'))
    expect(q.unsavedCount).toBe(1)

    // tab khác ghi storage (ở đây ghi thẳng vì storage đang "đầy" với instance này) rồi phát sự kiện
    storage.failWith = null
    const other: PendingOp = { type: 'deleteItem', itemId: 'I3', id: 'other', createdAt: '2026-11-09T00:00:02.000Z', attempts: 0 }
    storage.setItem(pendingKey('u1'), JSON.stringify([op1, other]))
    storage.failWith = new DOMException('full', 'QuotaExceededError')
    win.dispatchEvent(Object.assign(new Event('storage'), { key: pendingKey('u1') }))
    expect(q.list().map((o) => o.id)).toEqual([op1.id, op2.id, 'other'])
    q.load()
    expect(q.list().map((o) => o.id)).toContain(op2.id)

    storage.failWith = null
    expect(q.persist()).toBe(true)
    expect(q.unsavedCount).toBe(0)
    expect(stored(storage).map((o) => o.id)).toEqual([op1.id, op2.id, 'other'])
    q.stopCrossTabSync()
  })

  it('tập done chỉ nhớ 500 id gần nhất', async () => {
    expect(MAX_DONE_IDS).toBe(500)
    const q = new PendingQueue('u1', new MemoryStorage(), { locks: null })
    for (let i = 0; i < 520; i++) q.enqueue({ type: 'deleteItem', itemId: `I${i}` })
    expect(await q.replay(fakeRepo())).toEqual({ replayed: 520 })
    expect(q.doneCount).toBe(500)
  })

  it('(d) merge nhiều tab: storage có [op1], instance khác enqueue op2 → storage có cả hai', () => {
    const storage = new MemoryStorage()
    const tabB = new PendingQueue('u1', storage) // mở trước khi tab A ghi
    const tabA = new PendingQueue('u1', storage)
    const op1 = tabA.enqueue({ type: 'deleteItem', itemId: 'I1' }, new Date('2026-11-09T00:00:00Z'))
    const op2 = tabB.enqueue({ type: 'deleteItem', itemId: 'I2' }, new Date('2026-11-09T00:00:01Z'))
    expect(stored(storage).map((o) => o.id)).toEqual([op1.id, op2.id])
    expect(tabB.list().map((o) => o.id)).toEqual([op1.id, op2.id])
  })

  it('merge: trùng id lấy attempts lớn hơn; op đã replay xong không bị hồi sinh', async () => {
    const storage = new MemoryStorage()
    const q = new PendingQueue('u1', storage, { locks: null })
    const op = q.enqueue({ type: 'deleteItem', itemId: 'I1' })
    // tab khác đã thử op này 3 lần
    storage.setItem(pendingKey('u1'), JSON.stringify([{ ...op, attempts: 3 }]))
    q.persist()
    expect(q.list()[0].attempts).toBe(3)

    const stale = JSON.stringify(stored(storage))
    await q.replay(fakeRepo())
    storage.setItem(pendingKey('u1'), stale) // tab khác ghi đè bản cũ
    q.enqueue({ type: 'deleteItem', itemId: 'I2' })
    expect(stored(storage).map((o) => o.type === 'deleteItem' && o.itemId)).toEqual(['I2'])
  })

  it('(e) load lọc op hỏng sang khoá :invalid (append, không xoá)', () => {
    const storage = new MemoryStorage()
    const good: PendingOp = { type: 'deleteItem', itemId: 'I1', id: 'a', createdAt: '2026-11-09T00:00:00.000Z', attempts: 0 }
    const bad1 = { type: 'dropTable', id: 'b', createdAt: 'x', attempts: 0 }
    const bad2 = { type: 'deleteItem', id: 7, createdAt: 'x', attempts: 0 }
    const bad3 = 'rác'
    storage.setItem(invalidPendingKey('u1'), JSON.stringify(['cũ']))
    storage.setItem(pendingKey('u1'), JSON.stringify([good, bad1, bad2, bad3]))

    const q = new PendingQueue('u1', storage)
    expect(q.list()).toEqual([good])
    expect(invalidPendingKey('u1')).toBe('vta:v1:pending:u1:invalid')
    expect(JSON.parse(storage.getItem(invalidPendingKey('u1')) ?? '[]')).toEqual(['cũ', bad1, bad2, bad3])
    expect(stored(storage)).toEqual([good])
    // load lại không nhân bản
    q.load()
    expect(JSON.parse(storage.getItem(invalidPendingKey('u1')) ?? '[]')).toHaveLength(4)
  })

  it('startCrossTabSync: sự kiện storage đúng khoá → load lại; stop thì thôi', () => {
    const win = new EventTarget()
    vi.stubGlobal('window', win)
    const storage = new MemoryStorage()
    const q = new PendingQueue('u1', storage)
    const other = new PendingQueue('u1', storage)
    const stop = q.startCrossTabSync()
    other.enqueue({ type: 'deleteItem', itemId: 'I1' })
    const fire = (key: string | null) => win.dispatchEvent(Object.assign(new Event('storage'), { key }))
    fire('vta:v1:cards')
    expect(q.size).toBe(0)
    fire(pendingKey('u1'))
    expect(q.size).toBe(1)
    stop()
    other.enqueue({ type: 'deleteItem', itemId: 'I2' })
    fire(pendingKey('u1'))
    expect(q.size).toBe(1)
  })

  it('isOverloaded với 51 op và với attempts 21', () => {
    expect(MAX_OPS).toBe(50)
    expect(MAX_ATTEMPTS).toBe(20)
    const q = new PendingQueue('u1', new MemoryStorage())
    for (let i = 0; i < 50; i++) q.enqueue({ type: 'deleteItem', itemId: `I${i}` })
    expect(q.isOverloaded()).toBe(false)
    q.enqueue({ type: 'deleteItem', itemId: 'I50' })
    expect(q.isOverloaded()).toBe(true)
    expect(q.size).toBe(51)

    const op = (attempts: number): PendingOp => ({ type: 'deleteItem', itemId: 'X', id: 'x', createdAt: '', attempts })
    expect(isOverloaded([op(20)])).toBe(false)
    expect(isOverloaded([op(21)])).toBe(true)
  })
})

describe('PendingQueue.remove + replay onFail', () => {
  it('remove gỡ op, persist, emit và không bị merge hồi sinh từ storage cũ', () => {
    const storage = new MemoryStorage()
    const q = new PendingQueue('u1', storage, { locks: null })
    const a = q.enqueue({ type: 'deleteItem', itemId: 'A' })
    q.enqueue({ type: 'deleteItem', itemId: 'B' })
    const snapshotBefore = storage.getItem(pendingKey('u1'))
    const states: PendingState[] = []
    q.subscribe((s) => states.push(s))
    q.remove([a.id])
    expect(q.list().map((o) => o.type === 'deleteItem' && o.itemId)).toEqual(['B'])
    expect(stored(storage).length).toBe(1)
    expect(states.at(-1)?.size).toBe(1)
    // tab khác ghi lại bản cũ còn op A → load không hồi sinh
    storage.setItem(pendingKey('u1'), snapshotBefore!)
    q.load()
    expect(q.size).toBe(1)
  })

  it('onFail "drop" gỡ op lỗi và chạy tiếp; mặc định "retry" dừng như cũ', async () => {
    const calls: string[] = []
    const repo = fakeRepo(calls)
    repo.deleteItem.mockImplementationOnce(async () => {
      throw Object.assign(new Error('x'), { code: '23503' })
    })
    const q = new PendingQueue('u1', new MemoryStorage(), { locks: null })
    q.enqueue({ type: 'deleteItem', itemId: 'A' })
    q.enqueue({ type: 'saveSettings', settings: SETTINGS })
    const onFail = vi.fn(() => 'drop' as const)
    const r = await q.replay(repo, { onFail })
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(r.failed).toBeUndefined()
    expect(q.size).toBe(0)
    expect(calls.map((c) => c.split(':')[0])).toEqual(['saveSettings'])
  })

  it('onFail "retryNow" thử lại ngay đúng một lần', async () => {
    const repo = fakeRepo()
    repo.saveSettings.mockRejectedValue(Object.assign(new Error('x'), { code: '42501' }))
    const q = new PendingQueue('u1', new MemoryStorage(), { locks: null })
    q.enqueue({ type: 'saveSettings', settings: SETTINGS })
    const onFail = vi.fn(() => 'retryNow' as const)
    const r = await q.replay(repo, { onFail })
    expect(repo.saveSettings).toHaveBeenCalledTimes(2)
    expect(r.failed?.attempts).toBe(1)
    expect(q.size).toBe(1)
  })

  it('persist lỗi: op bị drop vẫn không quay lại, onFail chỉ gọi một lần mỗi op', async () => {
    const storage = new MemoryStorage()
    const repo = fakeRepo()
    repo.deleteItem.mockRejectedValue(Object.assign(new Error('x'), { code: '23503' }))
    repo.saveSettings.mockRejectedValue(Object.assign(new Error('x'), { code: 'network' }))
    const q = new PendingQueue('u1', storage, { locks: null })
    q.enqueue({ type: 'deleteItem', itemId: 'A' })
    q.enqueue({ type: 'saveSettings', settings: SETTINGS })
    storage.failWith = new Error('QuotaExceededError')
    const onFail = vi.fn((op: PendingOp) => (op.type === 'deleteItem' ? ('drop' as const) : ('retry' as const)))
    await q.replay(repo, { onFail })
    expect(q.list().map((o) => o.type)).toEqual(['saveSettings'])
    expect(q.getState().persistFailed).toBe(true)
    // storage vẫn còn bản cũ có op A, nhưng load không hồi sinh
    expect(stored(storage).length).toBe(2)
    q.load()
    expect(q.list().map((o) => o.type)).toEqual(['saveSettings'])
    await q.replay(repo, { onFail })
    expect(repo.deleteItem).toHaveBeenCalledTimes(1)
  })
})
