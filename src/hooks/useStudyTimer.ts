import { useEffect, useRef, useState } from 'react'
import { useData } from '../state/useData'

export const FLUSH_EVERY_SECONDS = 30

/** Môi trường trình duyệt mà bộ đếm cần (tách ra để test bằng fake timers, không cần DOM). */
export interface TimerEnv {
  isVisible(): boolean
  /** Gọi `onHide` khi tab bị ẩn / trang sắp đóng; trả hàm huỷ đăng ký. */
  onHide(onHide: () => void): () => void
}

export interface StudyTimer {
  setActive(active: boolean): void
  /** Ghi phần đã gom ngay (nếu có). */
  flush(): void
  dispose(): void
}

/**
 * Bộ đếm thời gian học (4.5): +1 giây mỗi giây khi `active` và tab đang hiện.
 * Gom lại và chỉ gọi `onFlush(seconds)` khi đủ 30 giây, khi tab ẩn, khi ngừng active và khi dispose.
 */
export function createStudyTimer(opts: {
  env: TimerEnv
  onSecond(): void
  onFlush(seconds: number): void
}): StudyTimer {
  const { env, onSecond, onFlush } = opts
  let pending = 0
  let interval: ReturnType<typeof setInterval> | null = null
  let disposed = false

  const flush = () => {
    if (pending <= 0) return
    const s = pending
    pending = 0
    onFlush(s)
  }

  const tick = () => {
    if (!env.isVisible()) return
    pending += 1
    onSecond()
    if (pending >= FLUSH_EVERY_SECONDS) flush()
  }

  const unsubscribe = env.onHide(flush)

  return {
    setActive(active) {
      if (disposed) return
      if (active && interval === null) {
        interval = setInterval(tick, 1000)
      } else if (!active && interval !== null) {
        clearInterval(interval)
        interval = null
        flush()
      }
    },
    flush,
    dispose() {
      if (disposed) return
      disposed = true
      if (interval !== null) clearInterval(interval)
      interval = null
      unsubscribe()
      flush()
    },
  }
}

const browserEnv: TimerEnv = {
  isVisible: () => typeof document === 'undefined' || document.visibilityState === 'visible',
  onHide(onHide) {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') onHide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
    }
  },
}

/**
 * Đếm giây học khi `active` và tab hiện; ghi `addStudyTime({ seconds })` theo lô 30 giây
 * và khi ẩn tab/unmount. Trả số giây đã đếm trong lần mount này.
 */
export function useStudyTimer(active: boolean): { seconds: number } {
  const { addStudyTime } = useData()
  const [seconds, setSeconds] = useState(0)
  const addRef = useRef(addStudyTime)
  const timerRef = useRef<StudyTimer | null>(null)

  useEffect(() => {
    addRef.current = addStudyTime
  }, [addStudyTime])

  useEffect(() => {
    const timer = createStudyTimer({
      env: browserEnv,
      onSecond: () => setSeconds((s) => s + 1),
      onFlush: (s) => {
        addRef.current({ seconds: s }).catch(() => {})
      },
    })
    timerRef.current = timer
    return () => {
      timer.dispose()
      if (timerRef.current === timer) timerRef.current = null
    }
  }, [])

  useEffect(() => {
    timerRef.current?.setActive(active)
  }, [active])

  return { seconds }
}
