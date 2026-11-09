import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Toast, type ToastData } from '../components/Toast'
import type { ImportFile } from '../domain/importSnapshot'
import { MAX_DURATION_MS, missingSiblingDirections, planUnlock, shouldRequeue, shouldUnlockSiblings } from '../domain/review'
import type { Card, Direction, Grade, Item, Lesson, Settings, Snapshot } from '../domain/types'
import { localDay } from '../lib/dates'
import { createCardRecord, gradeCard as fsrsGradeCard } from '../lib/fsrs'
import { newId } from '../lib/ids'
import { setNotifier as setTtsNotifier } from '../lib/tts'
import type { StudyTimeDelta } from '../repo/types'
import { createPatternGate } from './patternGate'
import {
  DataContext,
  type DataContextValue,
  type GradeResult,
  type ImportResult,
} from './dataContext'
import { runImport } from './importRunner'
import { dataReducer, initialDataState, type DataAction } from './dataReducer'
import { services } from './services'
import { SyncEngine, type PendingInfo, type ToastTone } from './syncEngine'
import { useAuth } from './useAuth'

const EMPTY_PENDING: PendingInfo = { size: 0, persistFailed: false, overloaded: false }
export function DataProvider({ children }: { children: ReactNode }) {
  const { repo, auth } = services()
  const { user, mode } = useAuth()
  const userId = user?.id ?? null

  const [state, rawDispatch] = useReducer(dataReducer, initialDataState)
  // Bản đồng bộ của state để action đọc ngay sau khi dispatch (không chờ render).
  const stateRef = useRef(state)
  const dispatch = useCallback((a: DataAction) => {
    stateRef.current = dataReducer(stateRef.current, a)
    rawDispatch(a)
  }, [])

  const [pending, setPending] = useState<PendingInfo>(EMPTY_PENDING)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [toasts, setToasts] = useState<ToastData[]>([])
  const engineRef = useRef<SyncEngine | null>(null)

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    setToasts((list) => (list.some((t) => t.message === message) ? list : [...list, { id: newId(), message, tone }]))
  }, [])
  const dismissToast = useCallback(() => setToasts((list) => list.slice(1)), [])

  // Toast info 1 lần/phiên của router giọng đọc (T19).
  useEffect(() => {
    setTtsNotifier(notify)
    return () => setTtsNotifier(undefined)
  }, [notify])

  useEffect(() => {
    if (!userId) {
      dispatch({ type: 'load/start' })
      return
    }
    const engine = new SyncEngine({
      repo,
      userId,
      mode,
      refreshSession: () => auth.getSession(),
      callbacks: {
        notify,
        onSnapshot: (snapshot) => dispatch({ type: 'load/success', snapshot }),
        onLoadError: () => dispatch({ type: 'load/error' }),
        onPending: setPending,
      },
    })
    engineRef.current = engine
    const stop = engine.start()
    dispatch({ type: 'load/start' })
    void engine.load('initial')
    return () => {
      stop()
      engine.dispose()
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [repo, auth, userId, mode, notify, dispatch])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const ready = useCallback((): { snapshot: Snapshot; engine: SyncEngine; userId: string } => {
    const snapshot = stateRef.current.snapshot
    const engine = engineRef.current
    if (!snapshot || !engine || !userId) throw new Error('Dữ liệu chưa sẵn sàng')
    return { snapshot, engine, userId }
  }, [userId])

  const retry = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    dispatch({ type: 'load/start' })
    void engine.load('initial')
  }, [dispatch])

  const createLesson = useCallback(
    async (l: Lesson) => {
      const { engine } = ready()
      dispatch({ type: 'lesson/upsert', lesson: l })
      void engine.write([{ type: 'upsertLesson', lesson: l }])
    },
    [ready, dispatch],
  )

  const deleteLesson = useCallback(
    async (id: string) => {
      const { engine } = ready()
      dispatch({ type: 'lesson/delete', lessonId: id })
      void engine.write([{ type: 'deleteLesson', lessonId: id }])
    },
    [ready, dispatch],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      const { engine } = ready()
      dispatch({ type: 'item/delete', itemId: id })
      void engine.write([{ type: 'deleteItem', itemId: id }])
    },
    [ready, dispatch],
  )

  const saveItems = useCallback(
    async (items: Item[]) => {
      if (items.length === 0) return
      const { snapshot, userId: uid } = ready()
      const hasEnVi = (s: Snapshot, itemId: string) =>
        s.cards.some((c) => c.item_id === itemId && c.direction === 'en_vi')
      const known = new Set(snapshot.items.map((i) => i.id))
      const now = new Date()
      const drafts = await Promise.all(
        items
          .filter((i) => !known.has(i.id) && !hasEnVi(snapshot, i.id))
          .map((i) => createCardRecord({ id: newId(), user_id: uid, item_id: i.id, direction: 'en_vi', now })),
      )
      // sau await: state có thể đã đổi (gọi chồng) → kiểm lại để không sinh trùng thẻ
      const { snapshot: cur, engine } = ready()
      const cards = drafts.filter((c) => !hasEnVi(cur, c.item_id))
      dispatch({ type: 'items/upsert', items })
      if (cards.length > 0) dispatch({ type: 'cards/upsert', cards })
      void engine.write([
        { type: 'upsertItems', items },
        ...(cards.length > 0 ? [{ type: 'upsertCards' as const, cards }] : []),
      ])
    },
    [ready, dispatch],
  )

  const patternGate = useRef(createPatternGate()).current
  const addPatternItems = useCallback(
    async (items: Item[]): Promise<number> => {
      const { snapshot, userId: uid } = ready()
      const have = new Set(snapshot.items.map((i) => i.pattern_id).filter((p): p is string => p !== null))
      const fresh = patternGate.claim(items, have).map((i) => ({ ...i, user_id: uid }))
      if (fresh.length === 0) return 0
      try {
        await saveItems(fresh)
      } finally {
        patternGate.release(fresh)
      }
      return fresh.length
    },
    [ready, saveItems, patternGate],
  )

  const gradeCard = useCallback(
    async (cardId: string, grade: Grade, durationMs: number, timesShown: number): Promise<GradeResult> => {
      const { snapshot, userId: uid } = ready()
      const card = snapshot.cards.find((c) => c.id === cardId)
      if (!card) throw new Error('Không tìm thấy thẻ')
      const now = new Date()
      const { card: next, log } = await fsrsGradeCard(card, grade, now)
      const duration = Math.min(Math.max(0, Math.round(durationMs) || 0), MAX_DURATION_MS)

      let siblings: Card[] = []
      if (shouldUnlockSiblings(card, grade, now)) {
        const dirs: Direction[] = missingSiblingDirections(card.item_id, ready().snapshot.cards)
        siblings = await Promise.all(
          dirs.map((direction) => createCardRecord({ id: newId(), user_id: uid, item_id: card.item_id, direction, now })),
        )
      }
      const { snapshot: cur, engine } = ready()
      siblings = planUnlock(card.item_id, siblings, cur.cards)

      const day = localDay(now)
      const delta: StudyTimeDelta = { seconds: Math.round(duration / 1000), reviews: 1 }
      const cards = [next, ...siblings]
      dispatch({ type: 'cards/upsert', cards })
      dispatch({ type: 'studyTime/add', userId: uid, day, delta })
      void engine.write([
        { type: 'upsertCards', cards },
        { type: 'addReviewLog', log: { ...log, duration_ms: duration } },
        { type: 'addStudyTime', day, delta },
      ])
      return { card: next, requeue: shouldRequeue(next, now, timesShown), unlocked: siblings.length }
    },
    [ready, dispatch],
  )

  const addStudyTime = useCallback(
    async (delta: StudyTimeDelta) => {
      const { engine, userId: uid } = ready()
      const day = localDay(new Date())
      dispatch({ type: 'studyTime/add', userId: uid, day, delta })
      void engine.write([{ type: 'addStudyTime', day, delta }])
    },
    [ready, dispatch],
  )

  const saveSettings = useCallback(
    async (s: Settings) => {
      const { engine } = ready()
      dispatch({ type: 'settings/save', settings: s })
      void engine.write([{ type: 'saveSettings', settings: s }])
    },
    [ready, dispatch],
  )

  const importSnapshot = useCallback(
    (file: ImportFile, opts: { includeSettings: boolean }): Promise<ImportResult> =>
      runImport(file, opts, {
        mode,
        online: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
        ready,
        dispatch,
        createCard: ({ userId: uid, itemId, now }) =>
          createCardRecord({ id: newId(), user_id: uid, item_id: itemId, direction: 'en_vi', now }),
      }),
    [ready, dispatch, mode],
  )

  const value = useMemo<DataContextValue>(
    () => ({
      mode,
      status: state.status,
      snapshot: state.snapshot,
      pending,
      online,
      retry,
      createLesson,
      updateLesson: createLesson,
      deleteLesson,
      saveItems,
      deleteItem,
      addPatternItems,
      gradeCard,
      addStudyTime,
      saveSettings,
      importSnapshot,
      notify,
    }),
    [
      mode,
      state,
      pending,
      online,
      retry,
      createLesson,
      deleteLesson,
      saveItems,
      deleteItem,
      addPatternItems,
      gradeCard,
      addStudyTime,
      saveSettings,
      importSnapshot,
      notify,
    ],
  )

  return (
    <DataContext.Provider value={value}>
      {children}
      <Toast toast={toasts[0] ?? null} onDismiss={dismissToast} />
    </DataContext.Provider>
  )
}
