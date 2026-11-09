import { asLanguage, asStudyLanguage } from '../domain/languageCore'
import type { Card, Item, Lesson, Settings, Snapshot, StudyDay } from '../domain/types'
import type { ImportPlan } from '../domain/importSnapshot'
import type { PendingOpPayload, StudyTimeDelta } from '../repo/types'

export type DataStatus = 'loading' | 'ready' | 'error'

export interface DataState {
  status: DataStatus
  snapshot: Snapshot | null
}

export const initialDataState: DataState = { status: 'loading', snapshot: null }

export type DataAction =
  | { type: 'load/start' }
  | { type: 'load/success'; snapshot: Snapshot }
  | { type: 'load/error' }
  | { type: 'lesson/upsert'; lesson: Lesson }
  | { type: 'lessons/upsert'; lessons: Lesson[] }
  | { type: 'lesson/delete'; lessonId: string }
  | { type: 'items/upsert'; items: Item[] }
  | { type: 'item/delete'; itemId: string }
  | { type: 'cards/upsert'; cards: Card[] }
  | { type: 'studyTime/add'; userId: string; day: string; delta: StudyTimeDelta }
  | { type: 'settings/save'; settings: Settings }
  /** Áp toàn bộ kế hoạch nhập (6.13-B) trong một lần; `plan.cards` đã gồm thẻ en_vi sinh thêm. */
  | { type: 'import/apply'; plan: ImportPlan; includeSettings: boolean }

/** Upsert theo id: thay bản cùng id tại chỗ, id mới nối cuối. */
export function upsertById<T extends { id: string }>(list: readonly T[], incoming: readonly T[]): T[] {
  if (incoming.length === 0) return list.slice()
  const byId = new Map(incoming.map((r) => [r.id, r]))
  const out = list.map((r) => {
    const next = byId.get(r.id)
    if (!next) return r
    byId.delete(r.id)
    return next
  })
  return [...out, ...byId.values()]
}

/** Gỡ items theo id + cards của chúng (cascade trong state). */
function removeItems(s: Snapshot, itemIds: ReadonlySet<string>): Snapshot {
  if (itemIds.size === 0) return s
  return {
    ...s,
    items: s.items.filter((i) => !itemIds.has(i.id)),
    cards: s.cards.filter((c) => !itemIds.has(c.item_id)),
  }
}

export function addStudyDelta(
  days: readonly StudyDay[],
  userId: string,
  day: string,
  delta: StudyTimeDelta,
): StudyDay[] {
  const seconds = Math.max(0, delta.seconds ?? 0)
  const reviews = Math.max(0, delta.reviews ?? 0)
  const shadowing = Math.max(0, delta.shadowing ?? 0)
  let found = false
  const out = days.map((d) => {
    if (d.day !== day) return d
    found = true
    return {
      ...d,
      seconds: d.seconds + seconds,
      reviews: d.reviews + reviews,
      shadowing_count: d.shadowing_count + shadowing,
    }
  })
  if (!found) out.push({ user_id: userId, day, seconds, reviews, shadowing_count: shadowing })
  return out
}

function applyToSnapshot(s: Snapshot, action: DataAction): Snapshot {
  switch (action.type) {
    case 'lesson/upsert':
      return { ...s, lessons: upsertById(s.lessons, [action.lesson]) }
    case 'lessons/upsert':
      return { ...s, lessons: upsertById(s.lessons, action.lessons) }
    case 'lesson/delete': {
      const itemIds = new Set(s.items.filter((i) => i.lesson_id === action.lessonId).map((i) => i.id))
      const rest = removeItems(s, itemIds)
      return { ...rest, lessons: rest.lessons.filter((l) => l.id !== action.lessonId) }
    }
    case 'items/upsert':
      return { ...s, items: upsertById(s.items, action.items) }
    case 'item/delete':
      return removeItems(s, new Set([action.itemId]))
    case 'cards/upsert':
      return { ...s, cards: upsertById(s.cards, action.cards) }
    case 'studyTime/add':
      return { ...s, studyDays: addStudyDelta(s.studyDays, action.userId, action.day, action.delta) }
    case 'settings/save':
      return { ...s, settings: action.settings }
    case 'import/apply': {
      const { plan } = action
      let studyDays = s.studyDays
      for (const d of plan.studyDeltas) studyDays = addStudyDelta(studyDays, plan.userId, d.day, d.delta)
      return {
        lessons: upsertById(s.lessons, plan.lessons),
        items: upsertById(s.items, plan.items),
        cards: upsertById(s.cards, plan.cards),
        studyDays,
        settings: action.includeSettings && plan.settings ? plan.settings : s.settings,
      }
    }
    default:
      return s
  }
}

export function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'load/start':
      return { status: 'loading', snapshot: null }
    case 'load/success':
      return { status: 'ready', snapshot: action.snapshot }
    case 'load/error':
      return { status: 'error', snapshot: null }
    default:
      if (!state.snapshot) return state
      return { ...state, snapshot: applyToSnapshot(state.snapshot, action) }
  }
}

/** (T20) Op lưu từ trước T20 có thể thiếu `language` → chuẩn hoá để state luôn đủ trường. */
function normLesson(l: Lesson): Lesson {
  return { ...l, language: asLanguage(l.language) }
}

/**
 * Op trong hàng đợi → action state tương ứng (để áp op chưa đồng bộ lên snapshot vừa tải).
 * (T20) Chuẩn hoá `lesson.language` / `settings.study_language` của op cũ (thiếu → 'en' / 'all').
 */
export function opToAction(op: PendingOpPayload, userId: string): DataAction | null {
  switch (op.type) {
    case 'upsertLesson':
      return { type: 'lesson/upsert', lesson: normLesson(op.lesson) }
    case 'upsertLessons':
      return { type: 'lessons/upsert', lessons: op.lessons.map(normLesson) }
    case 'deleteLesson':
      return { type: 'lesson/delete', lessonId: op.lessonId }
    case 'upsertItems':
      return { type: 'items/upsert', items: op.items }
    case 'deleteItem':
      return { type: 'item/delete', itemId: op.itemId }
    case 'upsertCards':
      return { type: 'cards/upsert', cards: op.cards }
    case 'addStudyTime':
      return { type: 'studyTime/add', userId, day: op.day, delta: op.delta }
    case 'saveSettings':
      return { type: 'settings/save', settings: { ...op.settings, study_language: asStudyLanguage(op.settings.study_language) } }
    case 'addReviewLog':
      // snapshot không chứa review_logs
      return null
    default:
      return null
  }
}

/** Áp các op chưa đồng bộ (FIFO) lên snapshot từ server, để state không lùi về bản cũ. */
export function applyPendingOps(snapshot: Snapshot, ops: readonly PendingOpPayload[], userId: string): Snapshot {
  let s = snapshot
  for (const op of ops) {
    const action = opToAction(op, userId)
    if (action) s = applyToSnapshot(s, action)
  }
  return s
}
