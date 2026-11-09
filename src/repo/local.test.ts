import { describe, expect, it } from 'vitest'
import type { Card, Item, Lesson, ReviewLogEntry } from '../domain/types'
import { LOCAL_KEYS, LocalAuth, corruptKey, LocalRepository, STORAGE_FULL_MESSAGE } from './local'
import { MemoryStorage } from './memoryStorage.test-util'

const NOW = new Date('2026-11-09T10:00:00+07:00')
const TS = '2026-11-09T03:00:00.000Z'

function lesson(id: string, topic = 'Chào hỏi'): Lesson {
  return { id, user_id: 'local', number: 1, date: '2026-11-09', topic, notes: '', questions: '', mistakes: '', language: 'en', created_at: TS, updated_at: TS }
}
function item(id: string, lessonId: string | null): Item {
  return { id, user_id: 'local', lesson_id: lessonId, kind: 'phrase', en: 'hello', vi: 'xin chào', ipa: '', note: '', pattern_id: null, position: 0, created_at: TS, updated_at: TS }
}
function card(id: string, itemId: string): Card {
  return { id, user_id: 'local', item_id: itemId, direction: 'en_vi', due: TS, state: 0, reps: 0, lapses: 0, first_reviewed_at: null, suspended: false, fsrs: {}, created_at: TS, updated_at: TS }
}
function log(id: string, cardId: string): ReviewLogEntry {
  return { id, user_id: 'local', card_id: cardId, rating: 3, reviewed_at: TS, duration_ms: 1000, revlog: {} }
}

function setup() {
  const storage = new MemoryStorage()
  const repo = new LocalRepository(storage, { now: () => NOW })
  const logs = () => JSON.parse(storage.getItem(LOCAL_KEYS.reviewLogs) ?? '[]') as ReviewLogEntry[]
  return { storage, repo, logs }
}

async function seed(repo: LocalRepository) {
  await repo.upsertLesson(lesson('L1'))
  await repo.upsertLesson(lesson('L2'))
  await repo.upsertItems([item('I1', 'L1'), item('I2', 'L1'), item('I3', 'L2'), item('I4', null)])
  await repo.upsertCards([card('C1', 'I1'), card('C2', 'I2'), card('C3', 'I3'), card('C4', 'I4')])
  for (const [l, c] of [['R1', 'C1'], ['R2', 'C2'], ['R3', 'C3'], ['R4', 'C4']]) await repo.addReviewLog(log(l, c))
}

describe('LocalRepository', () => {
  it('upsertLessons: thêm nhiều buổi, ghi đè theo id, gán user_id local; mảng rỗng không ghi', async () => {
    const { repo, storage } = setup()
    await repo.upsertLessons([])
    expect(storage.getItem(LOCAL_KEYS.lessons)).toBeNull()
    await repo.upsertLesson(lesson('L1', 'A'))
    await repo.upsertLessons([{ ...lesson('L1', 'B'), user_id: 'other' }, { ...lesson('L2', 'C'), user_id: 'other' }])
    const snap = await repo.loadSnapshot()
    expect(snap.lessons.map((l) => [l.id, l.topic, l.user_id])).toEqual([
      ['L1', 'B', 'local'],
      ['L2', 'C', 'local'],
    ])
  })

  it('upsert idempotent: cùng id 2 lần → 1 bản ghi, bản sau thắng', async () => {
    const { repo, logs } = setup()
    await repo.upsertLesson(lesson('L1', 'A'))
    await repo.upsertLesson(lesson('L1', 'B'))
    await repo.upsertItems([item('I1', 'L1')])
    await repo.upsertItems([{ ...item('I1', 'L1'), en: 'hi' }])
    await repo.upsertCards([card('C1', 'I1')])
    await repo.upsertCards([{ ...card('C1', 'I1'), reps: 2 }])
    await repo.addReviewLog(log('R1', 'C1'))
    await repo.addReviewLog(log('R1', 'C1'))
    const s = await repo.loadSnapshot()
    expect(s.lessons).toHaveLength(1)
    expect(s.lessons[0].topic).toBe('B')
    expect(s.items).toHaveLength(1)
    expect(s.items[0].en).toBe('hi')
    expect(s.cards).toHaveLength(1)
    expect(s.cards[0].reps).toBe(2)
    expect(logs()).toHaveLength(1)
  })

  it('deleteLesson cascade items/cards/logs, không đụng dữ liệu khác', async () => {
    const { repo, logs } = setup()
    await seed(repo)
    await repo.deleteLesson('L1')
    const s = await repo.loadSnapshot()
    expect(s.lessons.map((l) => l.id)).toEqual(['L2'])
    expect(s.items.map((i) => i.id)).toEqual(['I3', 'I4'])
    expect(s.cards.map((c) => c.id)).toEqual(['C3', 'C4'])
    expect(logs().map((r) => r.id)).toEqual(['R3', 'R4'])
  })

  it('deleteItem cascade cards + logs', async () => {
    const { repo, logs } = setup()
    await seed(repo)
    await repo.deleteItem('I1')
    const s = await repo.loadSnapshot()
    expect(s.lessons).toHaveLength(2)
    expect(s.items.map((i) => i.id)).toEqual(['I2', 'I3', 'I4'])
    expect(s.cards.map((c) => c.id)).toEqual(['C2', 'C3', 'C4'])
    expect(logs().map((r) => r.id)).toEqual(['R2', 'R3', 'R4'])
  })

  it('addStudyTime tạo mới ngày chưa có và cộng dồn', async () => {
    const { repo } = setup()
    const a = await repo.addStudyTime('2026-11-09', { seconds: 30 })
    expect(a).toEqual({ user_id: 'local', day: '2026-11-09', seconds: 30, reviews: 0, shadowing_count: 0 })
    const b = await repo.addStudyTime('2026-11-09', { seconds: 15, reviews: 2, shadowing: 1 })
    expect(b).toEqual({ user_id: 'local', day: '2026-11-09', seconds: 45, reviews: 2, shadowing_count: 1 })
    const c = await repo.addStudyTime('2026-11-08', { reviews: 1 })
    expect(c.reviews).toBe(1)
    const s = await repo.loadSnapshot()
    expect(s.studyDays).toHaveLength(2)
    expect(s.studyDays.find((d) => d.day === '2026-11-09')?.seconds).toBe(45)
  })

  it('loadSnapshot chỉ trả study_days trong 120 ngày gần nhất', async () => {
    const { repo } = setup()
    await repo.addStudyTime('2026-11-09', { seconds: 1 })
    await repo.addStudyTime('2026-07-12', { seconds: 1 }) // hôm nay − 120
    await repo.addStudyTime('2026-07-11', { seconds: 1 }) // hôm nay − 121
    const s = await repo.loadSnapshot()
    expect(s.studyDays.map((d) => d.day).sort()).toEqual(['2026-07-12', '2026-11-09'])
  })

  it('mốc 120 ngày tính theo giờ VN (now = 2026-11-08T18:00:00Z là 09/11 giờ VN)', async () => {
    const storage = new MemoryStorage()
    const repo = new LocalRepository(storage, { now: () => new Date('2026-11-08T18:00:00Z') })
    await repo.addStudyTime('2026-11-09', { seconds: 1 })
    await repo.addStudyTime('2026-07-12', { seconds: 1 }) // 09/11 − 120
    await repo.addStudyTime('2026-07-11', { seconds: 1 }) // 09/11 − 121 (nhưng = 08/11 − 120 theo UTC)
    const s = await repo.loadSnapshot()
    expect(s.studyDays.map((d) => d.day).sort()).toEqual(['2026-07-12', '2026-11-09'])
  })

  it('JSON hỏng → sao chuỗi gốc sang khoá :corrupt-<timestamp>, trả rỗng', async () => {
    const { repo, storage } = setup()
    storage.setItem(LOCAL_KEYS.lessons, '{not json')
    storage.setItem(LOCAL_KEYS.settings, 'oops')
    const s = await repo.loadSnapshot()
    expect(s.lessons).toEqual([])
    expect(s.settings.daily_goal_min).toBe(15)
    const backup = corruptKey(LOCAL_KEYS.lessons, NOW)
    expect(backup).toBe(`vta:v1:lessons:corrupt-${NOW.getTime()}`)
    expect(storage.getItem(backup)).toBe('{not json')
    expect(storage.getItem(corruptKey(LOCAL_KEYS.settings, NOW))).toBe('oops')
    // ghi tiếp được bình thường
    await repo.upsertLesson(lesson('L1'))
    expect((await repo.loadSnapshot()).lessons).toHaveLength(1)
  })

  it('JSON hỏng mà không sao lưu được (bộ nhớ đầy) → không ghi đè, ném lỗi bộ nhớ đầy', async () => {
    const { repo, storage } = setup()
    storage.setItem(LOCAL_KEYS.items, '[broken')
    storage.failWith = new DOMException('full', 'QuotaExceededError')
    expect((await repo.loadSnapshot()).items).toEqual([])
    await expect(repo.upsertItems([item('I1', null)])).rejects.toThrow(STORAGE_FULL_MESSAGE)
    // hết đầy: lần ghi sau sao lưu được bản hỏng rồi mới ghi
    storage.failWith = null
    expect(storage.getItem(LOCAL_KEYS.items)).toBe('[broken')
    await repo.upsertItems([item('I1', null)])
    expect(storage.getItem(corruptKey(LOCAL_KEYS.items, NOW))).toBe('[broken')
    expect((await repo.loadSnapshot()).items.map((i) => i.id)).toEqual(['I1'])
  })

  it('settings mặc định khi chưa có, và lưu được', async () => {
    const { repo } = setup()
    const s = await repo.loadSnapshot()
    expect(s.settings).toEqual({ user_id: 'local', display_name: '', daily_goal_min: 15, new_cards_per_day: 15, voice_name: null, auto_speak: false, study_language: 'all' })
    expect(s.lessons).toEqual([])
    await repo.saveSettings({ ...s.settings, daily_goal_min: 30 })
    expect((await repo.exportAll()).settings.daily_goal_min).toBe(30)
  })

  it('QuotaExceededError → Error với message bộ nhớ đầy', async () => {
    const { repo, storage } = setup()
    storage.failWith = new DOMException('full', 'QuotaExceededError')
    await expect(repo.upsertLesson(lesson('L1'))).rejects.toThrow(STORAGE_FULL_MESSAGE)
    await expect(repo.addStudyTime('2026-11-09', { seconds: 1 })).rejects.toThrow(
      'Bộ nhớ trình duyệt đầy. Hãy xuất dữ liệu rồi xoá bớt.',
    )
  })

  it('lỗi storage khác được ném nguyên', async () => {
    const { repo, storage } = setup()
    storage.failWith = new Error('boom')
    await expect(repo.upsertLesson(lesson('L1'))).rejects.toThrow('boom')
  })
})

describe('LocalAuth', () => {
  it('session local, onChange gọi ngay', async () => {
    const auth = new LocalAuth()
    expect(auth.mode).toBe('local')
    expect(await auth.getSession()).toEqual({ id: 'local', email: null })
    const seen: unknown[] = []
    const off = auth.onChange((u) => seen.push(u))
    expect(seen).toEqual([{ id: 'local', email: null }])
    off()
  })
})

describe('(T20) LocalRepository — dữ liệu trước T20', () => {
  it('vta:v1:lessons cũ không có language → đọc ra en; ghi zh rồi đọc giữ zh', async () => {
    const { repo, storage } = setup()
    const { language: _omit, ...old } = lesson('L1')
    void _omit
    storage.setItem(LOCAL_KEYS.lessons, JSON.stringify([old, { ...lesson('L2'), language: 'fr' }]))
    let snap = await repo.loadSnapshot()
    expect(snap.lessons.map((l) => l.language)).toEqual(['en', 'en'])

    await repo.upsertLesson({ ...lesson('L3'), language: 'zh' })
    snap = await repo.loadSnapshot()
    expect(snap.lessons.find((l) => l.id === 'L3')?.language).toBe('zh')
    // Khoá không đổi.
    expect(JSON.parse(storage.getItem('vta:v1:lessons') ?? '[]')).toHaveLength(3)
  })

  it('settings cũ không có study_language → all; giá trị lạ → all; lưu ja đọc lại ja', async () => {
    const { repo, storage } = setup()
    const old = { user_id: 'local', display_name: 'Lan', daily_goal_min: 20, new_cards_per_day: 10, voice_name: null, auto_speak: true }
    storage.setItem(LOCAL_KEYS.settings, JSON.stringify(old))
    expect((await repo.loadSnapshot()).settings).toEqual({ ...old, study_language: 'all' })

    storage.setItem(LOCAL_KEYS.settings, JSON.stringify({ ...old, study_language: 'xx' }))
    expect((await repo.loadSnapshot()).settings.study_language).toBe('all')

    await repo.saveSettings({ ...old, study_language: 'ja' })
    expect((await repo.loadSnapshot()).settings.study_language).toBe('ja')
  })

  it('không có settings → mặc định study_language all', async () => {
    const { repo } = setup()
    expect((await repo.loadSnapshot()).settings.study_language).toBe('all')
  })
})
