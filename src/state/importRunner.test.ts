import { describe, expect, it, vi } from 'vitest'
import type { ImportFile } from '../domain/importSnapshot'
import type { Card, Item, Lesson, Snapshot } from '../domain/types'
import type { PendingOpPayload } from '../repo/types'
import { IMPORT_BLOCKED_MESSAGE } from './dataContext'
import type { DataAction } from './dataReducer'
import { dataReducer } from './dataReducer'
import { runImport, type ImportDeps, type ImportEngine } from './importRunner'

const NOW = new Date('2026-11-09T03:00:00.000Z')
const T = '2026-11-01T03:00:00.000Z'
const FSRS = { dueAt: T, lastReviewAt: null, stability: 0, difficulty: 0, state: 0 }

function lesson(id: string): Lesson {
  return { id, user_id: 'u', number: 1, date: '2026-11-01', topic: 'Chào', notes: '', questions: '', mistakes: '', language: 'en', created_at: T, updated_at: T }
}
function item(id: string, over: Partial<Item> = {}): Item {
  return { id, user_id: 'u', lesson_id: null, kind: 'word', en: 'hi', vi: 'chào', ipa: '', note: '', pattern_id: null, position: 0, created_at: T, updated_at: T, ...over }
}
function card(id: string, itemId: string): Card {
  return { id, user_id: 'u', item_id: itemId, direction: 'en_vi', due: T, state: 0, reps: 0, lapses: 0, first_reviewed_at: null, suspended: false, fsrs: FSRS, created_at: T, updated_at: T }
}
function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    lessons: [],
    items: [],
    cards: [],
    studyDays: [],
    settings: { user_id: 'u', display_name: '', daily_goal_min: 15, new_cards_per_day: 15, voice_name: null, auto_speak: false, study_language: 'all' },
    ...over,
  }
}
const FILE: ImportFile = {
  lessons: [lesson('L1')],
  items: [item('I1', { lesson_id: 'L1' }), item('I2'), item('P1', { pattern_id: 'p-1' })],
  cards: [card('C2', 'I2')],
  studyDays: [{ day: '2026-11-08', seconds: 60, reviews: 1, shadowing_count: 0 }],
  settings: { daily_goal_min: 30 },
}

function setup(mode: 'local' | 'supabase', opts: { online?: boolean; pending?: number; onLoad?: (s: { snapshot: Snapshot }) => void } = {}) {
  const state = { snapshot: snap() }
  const writes: PendingOpPayload[][] = []
  let pending = opts.pending ?? 0
  const loads: string[] = []
  let resolveWrite!: () => void
  const engine: ImportEngine = {
    pendingInfo: () => ({ size: pending }),
    write: vi.fn((ops: PendingOpPayload[]) => {
      writes.push(ops)
      return new Promise<void>((r) => {
        resolveWrite = r
      })
    }),
    load: vi.fn(async (kind: string) => {
      loads.push(kind)
      opts.onLoad?.(state)
    }),
  }
  const actions: DataAction[] = []
  const deps: ImportDeps = {
    mode,
    online: () => opts.online ?? true,
    ready: () => ({ snapshot: state.snapshot, engine, userId: 'u' }),
    dispatch: (a) => {
      actions.push(a)
      state.snapshot = dataReducer({ status: 'ready', snapshot: state.snapshot }, a).snapshot!
    },
    createCard: vi.fn(async ({ itemId }: { itemId: string }) => card(`gen-${itemId}`, itemId)),
    now: () => NOW,
  }
  return {
    state,
    writes,
    loads,
    actions,
    deps,
    engine,
    setPending: (n: number) => {
      pending = n
    },
    finishWrite: async () => {
      resolveWrite()
      await new Promise((r) => setTimeout(r, 0))
    },
  }
}

describe('runImport', () => {
  it('local: một dispatch import/apply, một engine.write đúng thứ tự, sinh thẻ cho item thiếu, không reload', async () => {
    const t = setup('local')
    const r = await runImport(FILE, { includeSettings: true }, t.deps)
    expect(t.actions.map((a) => a.type)).toEqual(['import/apply'])
    expect(t.writes).toHaveLength(1)
    expect(t.writes[0].map((o) => o.type)).toEqual([
      'upsertLessons',
      'upsertItems',
      'upsertItems',
      'upsertCards',
      'upsertCards',
      'saveSettings',
      'addStudyTime',
    ])
    const [, plainOp, patOp, plainCards, patCards] = t.writes[0]
    expect(plainOp.type === 'upsertItems' && plainOp.items.map((i) => i.id)).toEqual(['I1', 'I2'])
    expect(patOp.type === 'upsertItems' && patOp.items.map((i) => i.id)).toEqual(['P1'])
    expect(plainCards.type === 'upsertCards' && plainCards.cards.map((c) => c.id).sort()).toEqual(['C2', 'gen-I1'])
    expect(patCards.type === 'upsertCards' && patCards.cards.map((c) => c.id)).toEqual(['gen-P1'])
    expect(r).toMatchObject({ lessons: { add: 1, update: 0 }, items: { add: 3, update: 0 }, cards: { add: 3, update: 0 }, studyDays: 1, settings: true })
    expect(t.state.snapshot.settings.daily_goal_min).toBe(30)
    await t.finishWrite()
    expect(t.loads).toEqual([])
  })

  it('supabase offline hoặc còn pending → reject với câu riêng, không ghi', async () => {
    for (const o of [{ online: false }, { pending: 2 }]) {
      const t = setup('supabase', o)
      await expect(runImport(FILE, { includeSettings: false }, t.deps)).rejects.toThrow(IMPORT_BLOCKED_MESSAGE)
      expect(t.writes).toEqual([])
      expect(t.actions).toEqual([])
    }
  })

  it('supabase: tải lại nền trước khi lập lại kế hoạch; item mới xuất hiện từ server → không sinh trùng thẻ', async () => {
    const t = setup('supabase', {
      // server đã có I1 kèm thẻ, và pattern p-1 ở item khác
      onLoad: (s) => {
        s.snapshot = snap({ items: [item('I1'), item('PX', { pattern_id: 'p-1' })], cards: [card('CS', 'I1'), card('CX', 'PX')] })
      },
    })
    const r = await runImport(FILE, { includeSettings: false }, t.deps)
    expect(t.loads).toEqual(['background'])
    const cards = t.writes[0].flatMap((o) => (o.type === 'upsertCards' ? o.cards.map((c) => c.id) : []))
    expect(cards).toEqual(['C2'])
    expect(t.writes[0].some((o) => o.type === 'upsertItems' && o.items.some((i) => i.id === 'P1'))).toBe(false)
    expect(r.items).toEqual({ add: 1, update: 1 })
    expect(r.cards).toEqual({ add: 1, update: 0 })
    expect(r.settings).toBe(false)
  })

  it('kế hoạch lần hai có item cần thẻ mà chưa có draft → sinh thêm', async () => {
    const t = setup('supabase', {
      // lần đọc đầu: I2 đã có thẻ cục bộ nên không cần draft; sau reload thẻ đó biến mất và tệp cũng không còn thẻ C2
      onLoad: (s) => {
        s.snapshot = snap()
      },
    })
    t.state.snapshot = snap({ items: [item('I2')], cards: [card('C-I2', 'I2')] })
    const file: ImportFile = { ...FILE, cards: [] }
    await runImport(file, { includeSettings: false }, t.deps)
    expect(t.deps.createCard).toHaveBeenCalledTimes(3)
    const ids = t.writes[0].flatMap((o) => (o.type === 'upsertCards' ? o.cards.map((c) => c.id) : []))
    expect(ids.sort()).toEqual(['gen-I1', 'gen-I2', 'gen-P1'])
  })

  it('supabase: reload sau khi ghi chỉ khi hàng đợi rỗng', async () => {
    const a = setup('supabase')
    await runImport(FILE, { includeSettings: false }, a.deps)
    await a.finishWrite()
    expect(a.loads).toEqual(['background', 'background'])

    const b = setup('supabase')
    await runImport(FILE, { includeSettings: false }, b.deps)
    b.setPending(3)
    await b.finishWrite()
    expect(b.loads).toEqual(['background'])
  })

  it('kế hoạch rỗng, không tick cài đặt → không ghi gì', async () => {
    const t = setup('local')
    await runImport({ lessons: [], items: [], cards: [], studyDays: [], settings: null }, { includeSettings: true }, t.deps)
    expect(t.writes).toEqual([])
  })
})
