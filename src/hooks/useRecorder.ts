import { useCallback, useEffect, useRef, useState } from 'react'
import {
  classifyRecorderError,
  createRecorder,
  isRecorderSupported,
  MAX_RECORD_SECONDS,
  requestMicStream,
  stopStream,
  type RecorderErrorKind,
} from '../lib/recorder'

export type MicPermission = 'unknown' | 'granted' | 'denied'
type Status = 'idle' | 'starting' | 'recording'

export interface UseRecorderOptions {
  /** Gọi khi một bản ghi hoàn tất (đã có `blobUrl`), kèm thời lượng ms. */
  onComplete?(durationMs: number): void
  maxSeconds?: number
}

export interface Recorder {
  supported: boolean
  permission: MicPermission
  /** Lỗi không phải do bị chặn quyền: không có micro / lỗi khác. */
  error: Exclude<RecorderErrorKind, 'denied'> | null
  /** Đang xin quyền / mở micro. */
  starting: boolean
  recording: boolean
  /** Số giây đã ghi của lần ghi hiện tại. */
  seconds: number
  /** ObjectURL của bản ghi gần nhất (chỉ trong bộ nhớ). */
  blobUrl: string | null
  /** Thời lượng bản ghi gần nhất (giây). */
  duration: number
  start(): void
  stop(): void
  /** Huỷ bản ghi (và lần ghi đang chạy), revoke URL. */
  reset(): void
}

interface EngineState {
  status: Status
  permission?: MicPermission
  error: Recorder['error']
  seconds: number
  blobUrl: string | null
  duration: number
}

interface EngineEvents {
  update(patch: Partial<EngineState>): void
  complete(durationMs: number): void
}

/**
 * Phần mutable của bộ ghi (MediaRecorder, stream, URL, hẹn giờ) tách khỏi React.
 * Mỗi `start()` mở một "phiên"; `reset()`/`dispose()` vô hiệu phiên cũ.
 */
function createEngine(maxSeconds: number, events: EngineEvents) {
  let status: Status = 'idle'
  let rec: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let url: string | null = null
  let session = 0
  let disposed = false
  let tick: ReturnType<typeof setInterval> | undefined
  let auto: ReturnType<typeof setTimeout> | undefined

  const setStatus = (s: Status, extra: Partial<EngineState> = {}) => {
    status = s
    events.update({ status: s, ...extra })
  }
  const clearTimers = () => {
    clearInterval(tick)
    clearTimeout(auto)
    tick = auto = undefined
  }
  const revoke = () => {
    if (url) URL.revokeObjectURL(url)
    url = null
  }
  /** Dừng recorder (nếu đang chạy) và tắt micro. */
  const release = () => {
    clearTimers()
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop()
      } catch {
        /* bỏ qua */
      }
    }
    stopStream(stream)
    stream = null
    rec = null
  }

  function stop() {
    if (!rec || rec.state === 'inactive') return
    try {
      rec.stop() // onstop tạo bản ghi
    } catch {
      release()
      setStatus('idle', { error: 'other' })
    }
  }

  function start() {
    if (disposed || status !== 'idle') return
    const mine = ++session
    const stale = () => disposed || mine !== session
    setStatus('starting', { error: null })

    requestMicStream().then(
      (s) => {
        if (stale()) {
          stopStream(s)
          return
        }
        let r: MediaRecorder
        try {
          r = createRecorder(s)
        } catch {
          stopStream(s)
          setStatus('idle', { permission: 'granted', error: 'other' })
          return
        }
        stream = s
        rec = r
        const chunks: Blob[] = []
        let startedAt = Date.now()
        /** Phiên này gặp lỗi recorder → bỏ bản ghi, giữ `error`. */
        let failed = false
        let lastSeconds = 0

        r.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data)
        }
        r.onstop = () => {
          clearTimers()
          stopStream(s)
          if (stream === s) stream = null
          if (rec === r) rec = null
          if (stale()) return
          if (failed) {
            setStatus('idle')
            return
          }
          const ms = Math.min(Date.now() - startedAt, maxSeconds * 1000)
          const blob = new Blob(chunks, { type: r.mimeType || chunks[0]?.type || '' })
          if (blob.size === 0) {
            setStatus('idle', { error: 'other' })
            return
          }
          // Tối đa 1 bản ghi: bản mới thay bản cũ.
          revoke()
          url = URL.createObjectURL(blob)
          setStatus('idle', { blobUrl: url, duration: ms / 1000, seconds: Math.round(ms / 1000), error: null })
          events.complete(ms)
        }
        r.onerror = () => {
          if (stale()) return
          failed = true
          events.update({ error: 'other' })
          stop()
        }

        try {
          r.start()
        } catch {
          release()
          setStatus('idle', { permission: 'granted', error: 'other' })
          return
        }
        startedAt = Date.now()
        setStatus('recording', { permission: 'granted', seconds: 0 })
        tick = setInterval(() => {
          const sec = Math.min(maxSeconds, Math.floor((Date.now() - startedAt) / 1000))
          if (sec === lastSeconds) return
          lastSeconds = sec
          events.update({ seconds: sec })
        }, 250)
        auto = setTimeout(stop, maxSeconds * 1000)
      },
      (e: unknown) => {
        if (stale()) return
        const kind = classifyRecorderError(e)
        if (kind === 'denied') setStatus('idle', { permission: 'denied' })
        else setStatus('idle', { error: kind })
      },
    )
  }

  function reset() {
    session++
    release()
    revoke()
    setStatus('idle', { blobUrl: null, duration: 0, seconds: 0, error: null })
  }

  function dispose() {
    disposed = true
    session++
    release()
    revoke()
    status = 'idle'
  }

  return { start, stop, reset, dispose }
}

const INITIAL: EngineState = { status: 'idle', error: null, seconds: 0, blobUrl: null, duration: 0 }

/**
 * Ghi âm một bản/lần (6.9). Xin quyền micro chỉ khi gọi `start()`; tự dừng sau `maxSeconds`;
 * tắt track micro sau khi dừng; revoke ObjectURL khi ghi lại, `reset()` và unmount.
 * Không tải bản ghi lên đâu cả.
 */
export function useRecorder({ onComplete, maxSeconds = MAX_RECORD_SECONDS }: UseRecorderOptions = {}): Recorder {
  const [supported] = useState(isRecorderSupported)
  const [permission, setPermission] = useState<MicPermission>('unknown')
  const [state, setState] = useState<EngineState>(INITIAL)
  const onCompleteRef = useRef(onComplete)
  const [engine, setEngine] = useState<ReturnType<typeof createEngine> | null>(null)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Tạo engine khi mount, huỷ khi unmount (rời trang: dừng ghi, tắt micro, revoke URL).
  useEffect(() => {
    const e = createEngine(maxSeconds, {
      update: ({ permission: p, ...patch }) => {
        if (p) setPermission(p)
        setState((s) => ({ ...s, ...patch }))
      },
      complete: (ms) => onCompleteRef.current?.(ms),
    })
    setEngine(e)
    return () => {
      e.dispose()
      setEngine(null)
      setState(INITIAL)
    }
  }, [maxSeconds])

  // Đọc trạng thái quyền sẵn có (không hiện hộp xin quyền); Firefox không hỗ trợ 'microphone' → bỏ qua.
  useEffect(() => {
    if (!supported || typeof navigator === 'undefined' || !navigator.permissions?.query) return
    let alive = true
    let ps: PermissionStatus | null = null
    const apply = (st: PermissionState) => {
      if (alive) setPermission(st === 'denied' ? 'denied' : st === 'granted' ? 'granted' : 'unknown')
    }
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then(
      (st) => {
        if (!alive) return
        ps = st
        apply(st.state)
        st.onchange = () => apply(st.state)
      },
      () => {},
    )
    return () => {
      alive = false
      if (ps) ps.onchange = null
    }
  }, [supported])

  const start = useCallback(() => {
    if (supported) engine?.start()
  }, [engine, supported])
  const stop = useCallback(() => engine?.stop(), [engine])
  const reset = useCallback(() => engine?.reset(), [engine])

  return {
    supported,
    permission,
    error: state.error,
    starting: state.status === 'starting',
    recording: state.status === 'recording',
    seconds: state.seconds,
    blobUrl: state.blobUrl,
    duration: state.duration,
    start,
    stop,
    reset,
  }
}
