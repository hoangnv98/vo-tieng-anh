import { describe, expect, it, vi } from 'vitest'
import type { Card, Item, Lesson, Snapshot } from '../domain/types'
import { MemoryStorage } from '../repo/memoryStorage.test-util'
import { RepoError } from '../repo/errors'
import type { PendingOp, PendingOpPayload, Repository } from '../repo/types'
import type { ImportPlan } from '../domain/importSnapshot'
import { applyPendingOps, dataReducer, initialDataState, type DataState } from './dataReducer'
import { dependentCardOpIds, failedKey, isPatternDuplicate, unseenCorruptKeys, writeMode } from './sync'
import { SyncEngine, type SyncCallbacks } from './syncEngine'

const T = '2026-11-09T00:00:00.000Z'

function lesson(id: string): Lesson {
  return { id, user_id: 'u', number: 1, date: '2026-11-09', topic: 't', notes: '', questions: '', mistakes: '', language: 'en', created_at: T, updated_at: T }
}
function item(id: string, lesson_id: string | null, pattern_id: string | null = null): Item {
  return { id, user_id: 'u', lesson_id, kind: 'phrase', en: 'hi', vi: 'chào', ipa: '', note: '', pattern_id, position: 0, created_at: T, updated_at: T }
}
function card(id: string, item_id: string): Card {
  return { id, user_id: 'u', item_id, direction: 'en_vi', due: T, state: 0, reps: 0, lapses: 0, first_reviewed_at: null, suspended: false, fsrs: {}, created_at: T, updated_at: T }
}
function snapshot(): Snapshot {
  return {
    lessons: [lesson('L1'), lesson('L2')],
    items: [item('I1', 'L1'), item('I2', 'L1'), item('I3', 'L2'), item('P1', null, 'pat-1')],
    cards: [card('C1', 'I1'), card('C2', 'I2'), card('C3', 'I3'), card('C4', 'P1')],
    studyDays: [{ user_id: 'u', day: '2026-11-09', seconds: 30, reviews: 1, shadowing_count: 0 }],
    settings: { user_id: 'u', display_name: 'A', daily_goal_min: 15, new_cards_per_day: 15, voice_name: null, auto_speak: false, study_language: 'all' },
  }
}
function ready(): DataState {
  return dataReducer(initialDataState, { type: 'load/success', snapshot: snapshot() })
}

describe('dataReducer', () => {
  it('load: loading → ready → error', () => {
    expect(initialDataState.status).toBe('loading')
    const s = ready()
    expect(s.status).toBe('ready')
    expect(dataReducer(s, { type: 'load/error' })).toEqual({ status: 'error', snapshot: null })
  })

  it('bỏ qua action dữ liệu khi chưa có snapshot', () => {
    const s = dataReducer(initialDataState, { type: 'lesson/upsert', lesson: lesson('X') })
    expect(s).toBe(initialDataState)
  })

  it('upsert lesson thay tại chỗ / nối cuối', () => {
    const changed = { ...lesson('L1'), topic: 'mới' }
    let s = dataReducer(ready(), { type: 'lesson/upsert', lesson: changed })
    expect(s.snapshot!.lessons.map((l) => l.id)).toEqual(['L1', 'L2'])
    expect(s.snapshot!.lessons[0].topic).toBe('mới')
    s = dataReducer(s, { type: 'lesson/upsert', lesson: lesson('L3') })
    expect(s.snapshot!.lessons.map((l) => l.id)).toEqual(['L1', 'L2', 'L3'])
  })

  it('xoá lesson cascade items + cards của buổi đó', () => {
    const s = dataReducer(ready(), { type: 'lesson/delete', lessonId: 'L1' }).snapshot!
    expect(s.lessons.map((l) => l.id)).toEqual(['L2'])
    expect(s.items.map((i) => i.id)).toEqual(['I3', 'P1'])
    expect(s.cards.map((c) => c.id)).toEqual(['C3', 'C4'])
  })

  it('xoá item cascade cards', () => {
    const s = dataReducer(ready(), { type: 'item/delete', itemId: 'I2' }).snapshot!
    expect(s.items.map((i) => i.id)).toEqual(['I1', 'I3', 'P1'])
    expect(s.cards.map((c) => c.id)).toEqual(['C1', 'C3', 'C4'])
  })

  it('upsert items + cards', () => {
    let s = dataReducer(ready(), { type: 'items/upsert', items: [item('I4', 'L2'), { ...item('I1', 'L1'), en: 'hello' }] })
    s = dataReducer(s, { type: 'cards/upsert', cards: [card('C5', 'I4')] })
    expect(s.snapshot!.items.find((i) => i.id === 'I1')!.en).toBe('hello')
    expect(s.snapshot!.items.at(-1)!.id).toBe('I4')
    expect(s.snapshot!.cards.at(-1)!.id).toBe('C5')
  })

  it('studyTime cộng dồn ngày có sẵn, tạo ngày mới', () => {
    let s = dataReducer(ready(), { type: 'studyTime/add', userId: 'u', day: '2026-11-09', delta: { seconds: 15, reviews: 1 } })
    s = dataReducer(s, { type: 'studyTime/add', userId: 'u', day: '2026-11-10', delta: { shadowing: 1 } })
    expect(s.snapshot!.studyDays).toEqual([
      { user_id: 'u', day: '2026-11-09', seconds: 45, reviews: 2, shadowing_count: 0 },
      { user_id: 'u', day: '2026-11-10', seconds: 0, reviews: 0, shadowing_count: 1 },
    ])
  })

  it('applyPendingOps áp op chưa đồng bộ lên snapshot theo thứ tự', () => {
    const ops: PendingOpPayload[] = [
      { type: 'upsertLesson', lesson: lesson('L9') },
      { type: 'deleteLesson', lessonId: 'L9' },
      { type: 'deleteItem', itemId: 'I3' },
      { type: 'addStudyTime', day: '2026-11-09', delta: { seconds: 10 } },
    ]
    const s = applyPendingOps(snapshot(), ops, 'u')
    expect(s.lessons.map((l) => l.id)).toEqual(['L1', 'L2'])
    expect(s.items.some((i) => i.id === 'I3')).toBe(false)
    expect(s.studyDays[0].seconds).toBe(40)
  })

  it('lessons/upsert + applyPendingOps hiểu op upsertLessons', () => {
    const a = dataReducer(ready(), { type: 'lessons/upsert', lessons: [{ ...lesson('L1'), topic: 'mới' }, lesson('L7')] })
    expect(a.snapshot?.lessons.map((l) => [l.id, l.topic])).toEqual([['L1', 'mới'], ['L2', 't'], ['L7', 't']])
    const s = applyPendingOps(snapshot(), [{ type: 'upsertLessons', lessons: [lesson('L8'), lesson('L9')] }], 'u')
    expect(s.lessons.map((l) => l.id)).toEqual(['L1', 'L2', 'L8', 'L9'])
  })

  it('(T20) op pending lưu từ trước T20 (thiếu language/study_language) → state đủ trường', () => {
    const { language: _l, ...oldLesson } = lesson('L5')
    const { study_language: _s, ...oldSettings } = snapshot().settings
    const ops = [
      { type: 'upsertLesson', lesson: oldLesson },
      { type: 'upsertLessons', lessons: [{ ...oldLesson, id: 'L6' }, { ...lesson('L7'), language: 'zh' }, { ...oldLesson, id: 'L8', language: 'fr' }] },
      { type: 'saveSettings', settings: { ...oldSettings, display_name: 'B' } },
    ] as unknown as PendingOpPayload[]
    const s = applyPendingOps(snapshot(), ops, 'u')
    expect(s.lessons.map((l) => [l.id, l.language])).toEqual([
      ['L1', 'en'],
      ['L2', 'en'],
      ['L5', 'en'],
      ['L6', 'en'],
      ['L7', 'zh'],
      ['L8', 'en'],
    ])
    expect(s.settings).toMatchObject({ display_name: 'B', study_language: 'all' })
    const zh = applyPendingOps(snapshot(), [{ type: 'saveSettings', settings: { ...snapshot().settings, study_language: 'zh' } }], 'u')
    expect(zh.settings.study_language).toBe('zh')
  })

  it('import/apply: một dispatch áp lessons/items/cards/studyDays; settings chỉ khi tick', () => {
    const plan: ImportPlan = {
      userId: 'u',
      lessons: [lesson('L3')],
      items: [item('I9', 'L3'), { ...item('I1', 'L1'), en: 'hello' }],
      cards: [card('C9', 'I9')],
      itemsNeedingCard: [],
      studyDeltas: [
        { day: '2026-11-09', delta: { seconds: 20, reviews: 0, shadowing: 0 } },
        { day: '2026-11-08', delta: { seconds: 60, reviews: 2, shadowing: 1 } },
      ],
      settings: { ...snapshot().settings, daily_goal_min: 30 },
      counts: { lessons: { add: 1, update: 0 }, items: { add: 1, update: 1 }, cards: { add: 1, update: 0 }, studyDays: 2, skipped: 0 },
      skippedReasons: {},
    }
    const s = dataReducer(ready(), { type: 'import/apply', plan, includeSettings: false }).snapshot!
    expect(s.lessons.map((l) => l.id)).toEqual(['L1', 'L2', 'L3'])
    expect(s.items.find((i) => i.id === 'I1')?.en).toBe('hello')
    expect(s.items.some((i) => i.id === 'I9')).toBe(true)
    expect(s.cards.some((c) => c.id === 'C9')).toBe(true)
    expect(s.studyDays.find((d) => d.day === '2026-11-09')?.seconds).toBe(50)
    expect(s.studyDays.find((d) => d.day === '2026-11-08')).toEqual({ user_id: 'u', day: '2026-11-08', seconds: 60, reviews: 2, shadowing_count: 1 })
    expect(s.settings.daily_goal_min).toBe(15)
    const t = dataReducer(ready(), { type: 'import/apply', plan, includeSettings: true }).snapshot!
    expect(t.settings.daily_goal_min).toBe(30)
  })
})

describe('sync helpers', () => {
  it('writeMode: hàng đợi rỗng → ghi trực tiếp; còn op hoặc bị tab khác giữ lock → enqueue', () => {
    expect(writeMode({ queueSize: 0 })).toBe('direct')
    expect(writeMode({ queueSize: 1 })).toBe('enqueue')
    expect(writeMode({ queueSize: 0, skipped: true })).toBe('enqueue')
  })

  it('isPatternDuplicate chỉ cho 23505 + upsertItems có pattern_id', () => {
    expect(isPatternDuplicate({ type: 'upsertItems', items: [item('P1', null, 'p')] }, '23505')).toBe(true)
    expect(isPatternDuplicate({ type: 'upsertItems', items: [item('I1', 'L1')] }, '23505')).toBe(false)
    expect(isPatternDuplicate({ type: 'upsertItems', items: [item('P1', null, 'p')] }, '23503')).toBe(false)
  })

  it('dependentCardOpIds chỉ lấy upsertCards mà mọi thẻ thuộc item bị bỏ', () => {
    const meta = { createdAt: T, attempts: 0 }
    const ops: PendingOp[] = [
      { id: 'a', type: 'upsertCards', cards: [card('C1', 'P1')], ...meta },
      { id: 'b', type: 'upsertCards', cards: [card('C2', 'P1'), card('C3', 'I3')], ...meta },
      { id: 'c', type: 'deleteItem', itemId: 'P1', ...meta },
    ]
    expect(dependentCardOpIds(ops, new Set(['P1']))).toEqual(['a'])
  })

  it('unseenCorruptKeys lọc đúng mẫu khoá và bỏ khoá đã báo', () => {
    const keys = ['vta:v1:cards:corrupt-1', 'vta:v1:lessons', 'vta:v1:pending:u:invalid', 'vta:v1:items:corrupt-2']
    expect(unseenCorruptKeys(keys, ['vta:v1:cards:corrupt-1'])).toEqual(['vta:v1:items:corrupt-2'])
  })
})

/** Repo giả chỉ ghi lại thứ tự gọi; `fail` quyết định lỗi cho từng lần gọi. */
function fakeRepo(fail: (name: string) => unknown = () => null) {
  const calls: string[] = []
  const run = (name: string) => async () => {
    const e = fail(name)
    if (e) throw e
    calls.push(name)
  }
  const repo = {
    loadSnapshot: vi.fn(async () => snapshot()),
    exportAll: vi.fn(async () => snapshot()),
    upsertLesson: vi.fn(run('upsertLesson')),
    upsertLessons: vi.fn(run('upsertLessons')),
    deleteLesson: vi.fn(run('deleteLesson')),
    upsertItems: vi.fn(run('upsertItems')),
    deleteItem: vi.fn(run('deleteItem')),
    upsertCards: vi.fn(run('upsertCards')),
    addReviewLog: vi.fn(run('addReviewLog')),
    addStudyTime: vi.fn(async () => {
      await run('addStudyTime')()
      return snapshot().studyDays[0]
    }),
    saveSettings: vi.fn(run('saveSettings')),
  } satisfies Repository
  return { repo, calls }
}

function callbacks(): SyncCallbacks & { toasts: string[] } {
  const toasts: string[] = []
  return {
    toasts,
    notify: (m) => toasts.push(m),
    onSnapshot: () => {},
    onLoadError: () => {},
    onPending: () => {},
  }
}

describe('SyncEngine (FIFO tuyệt đối)', () => {
  it('lỗi mạng → enqueue + toast cố định; op sau đó enqueue thẳng, không gọi repo trực tiếp', async () => {
    let offline = true
    const { repo, calls } = fakeRepo(() => (offline ? new RepoError('x', { code: 'network', status: 0 }) : null))
    const cb = callbacks()
    const engine = new SyncEngine({ repo, userId: 'u', mode: 'supabase', callbacks: cb, storage: new MemoryStorage(), locks: null })
    void engine.write([{ type: 'upsertLesson', lesson: lesson('L1') }])
    void engine.write([{ type: 'deleteLesson', lessonId: 'L1' }])
    await engine.idle()
    expect(engine.queue!.list().map((o) => o.type)).toEqual(['upsertLesson', 'deleteLesson'])
    expect(cb.toasts).toEqual(['Chưa lưu được. Sẽ tự thử lại khi có mạng.'])
    // deleteLesson chỉ được thử qua replay (sau upsertLesson), không bao giờ gọi trực tiếp trước nó
    expect(repo.deleteLesson.mock.invocationCallOrder.every((o) => o > repo.upsertLesson.mock.invocationCallOrder[0])).toBe(true)

    offline = false
    await engine.sync()
    expect(calls).toEqual(['upsertLesson', 'deleteLesson'])
    expect(engine.queue!.size).toBe(0)
  })

  it('mã không retry được → dead-letter, toast, tải lại snapshot', async () => {
    const { repo } = fakeRepo((n) => (n === 'upsertLesson' ? new RepoError('x', { code: '23514' }) : null))
    const storage = new MemoryStorage()
    const cb = callbacks()
    const engine = new SyncEngine({ repo, userId: 'u', mode: 'supabase', callbacks: cb, storage, locks: null })
    await engine.write([{ type: 'upsertLesson', lesson: lesson('L1') }])
    await engine.idle()
    expect(engine.queue!.size).toBe(0)
    const failed = JSON.parse(storage.getItem(failedKey('u')) ?? '[]') as PendingOp[]
    expect(failed.map((o) => o.type)).toEqual(['upsertLesson'])
    expect(cb.toasts).toEqual(['Có dữ liệu chưa đồng bộ được. Hãy tải lại trang khi có mạng.'])
    expect(repo.loadSnapshot).toHaveBeenCalledTimes(1)
  })

  it('42501 → làm mới phiên một lần rồi thử lại', async () => {
    let first = true
    const { repo, calls } = fakeRepo((n) => {
      if (n === 'saveSettings' && first) {
        first = false
        return new RepoError('x', { code: '42501' })
      }
      return null
    })
    const refreshSession = vi.fn(async () => null)
    const engine = new SyncEngine({ repo, userId: 'u', mode: 'supabase', callbacks: callbacks(), storage: new MemoryStorage(), locks: null, refreshSession })
    await engine.write([{ type: 'saveSettings', settings: snapshot().settings }])
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['saveSettings'])
    expect(engine.queue!.size).toBe(0)
  })

  it('replay: 42501 → làm mới phiên, thử lại ngay; thành công thì quên id trong `refreshed`', async () => {
    let step = 0
    const { repo, calls } = fakeRepo((n) => {
      if (n !== 'saveSettings') return null
      step++
      if (step === 1) return new RepoError('x', { code: 'network', status: 0 })
      if (step === 2) return new RepoError('x', { code: '42501' })
      return null
    })
    const refreshSession = vi.fn(async () => null)
    const engine = new SyncEngine({ repo, userId: 'u', mode: 'supabase', callbacks: callbacks(), storage: new MemoryStorage(), locks: null, refreshSession })
    await engine.write([{ type: 'saveSettings', settings: snapshot().settings }])
    expect(engine.queue!.size).toBe(1)
    await engine.sync()
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['saveSettings'])
    expect(engine.queue!.size).toBe(0)
    expect(engine.refreshedCount).toBe(0)
  })

  it('mẫu câu trùng (23505) → bỏ op items + thẻ phụ thuộc, không dead-letter', async () => {
    const { repo, calls } = fakeRepo((n) => (n === 'upsertItems' ? new RepoError('x', { code: '23505' }) : null))
    const storage = new MemoryStorage()
    const cb = callbacks()
    const engine = new SyncEngine({ repo, userId: 'u', mode: 'supabase', callbacks: cb, storage, locks: null })
    await engine.write([
      { type: 'upsertItems', items: [item('P2', null, 'pat-2')] },
      { type: 'upsertCards', cards: [card('C9', 'P2')] },
    ])
    await engine.idle()
    expect(calls).toEqual([])
    expect(storage.getItem(failedKey('u'))).toBeNull()
    expect(cb.toasts).toEqual([])
    expect(repo.loadSnapshot).toHaveBeenCalledTimes(1)
  })

  it('mode local: không có hàng đợi; lỗi → toast message của lỗi', async () => {
    const { repo } = fakeRepo(() => new Error('Bộ nhớ trình duyệt đầy. Hãy xuất dữ liệu rồi xoá bớt.'))
    const cb = callbacks()
    const engine = new SyncEngine({ repo, userId: 'local', mode: 'local', callbacks: cb, storage: new MemoryStorage() })
    await engine.write([{ type: 'upsertLesson', lesson: lesson('L1') }])
    expect(engine.queue).toBeNull()
    expect(cb.toasts).toEqual(['Bộ nhớ trình duyệt đầy. Hãy xuất dữ liệu rồi xoá bớt.'])
  })

  it('replay: op lỗi không retry được → dead-letter cùng thẻ phụ thuộc, gỡ khỏi hàng đợi, kể cả khi persist lỗi', async () => {
    let mode: 'offline' | 'reject' = 'offline'
    const { repo, calls } = fakeRepo((n) => {
      if (mode === 'offline') return new RepoError('x', { code: 'network', status: 0 })
      return n === 'upsertItems' ? new RepoError('x', { code: '23503' }) : null
    })
    const storage = new MemoryStorage()
    const cb = callbacks()
    const engine = new SyncEngine({ repo, userId: 'u', mode: 'supabase', callbacks: cb, storage, locks: null })
    void engine.write([
      { type: 'upsertItems', items: [item('I9', 'L1')] },
      { type: 'upsertCards', cards: [card('C9', 'I9')] },
      { type: 'saveSettings', settings: snapshot().settings },
    ])
    await engine.idle()
    expect(engine.queue!.size).toBe(3)

    mode = 'reject'
    storage.failWith = new Error('QuotaExceededError')
    await engine.sync()
    await engine.idle()
    expect(engine.queue!.size).toBe(0)
    expect(calls).toEqual(['saveSettings'])
    expect(repo.upsertItems).toHaveBeenCalledTimes(2) // 1 lần offline + 1 lần bị từ chối — không lặp
    expect(cb.toasts.filter((t) => t.startsWith('Có dữ liệu')).length).toBe(1)
    expect(engine.pendingInfo().persistFailed).toBe(false)

    storage.failWith = null
    mode = 'offline'
    const before = repo.upsertItems.mock.calls.length
    await engine.sync()
    expect(repo.upsertItems.mock.calls.length).toBe(before)
  })

  it('ghi trực tiếp: upsertItems bị từ chối → dead-letter luôn upsertCards phụ thuộc, không gọi repo cho thẻ', async () => {
    const { repo } = fakeRepo((n) => (n === 'upsertItems' ? new RepoError('x', { code: '23514' }) : null))
    const storage = new MemoryStorage()
    const engine = new SyncEngine({ repo, userId: 'u', mode: 'supabase', callbacks: callbacks(), storage, locks: null })
    await engine.write([
      { type: 'upsertItems', items: [item('I9', 'L1')] },
      { type: 'upsertCards', cards: [card('C9', 'I9')] },
    ])
    expect(repo.upsertCards).not.toHaveBeenCalled()
    const failed = JSON.parse(storage.getItem(failedKey('u')) ?? '[]') as PendingOp[]
    expect(failed.map((o) => o.type)).toEqual(['upsertItems', 'upsertCards'])
  })
})
