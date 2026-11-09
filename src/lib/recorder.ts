/**
 * Ghi âm bằng MediaRecorder. Bản ghi chỉ nằm trong bộ nhớ trình duyệt (Blob + ObjectURL);
 * không tải lên, không localStorage/IndexedDB (8.5).
 */

/** Thứ tự ưu tiên MIME (6.9): Chrome/Firefox → webm/opus; Safari → mp4. */
export const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] as const

/** Giới hạn độ dài một bản ghi. */
export const MAX_RECORD_SECONDS = 15
/** Bản ghi ngắn hơn ngưỡng này không tính vào `shadowing_count`. */
export const MIN_COUNTED_MS = 1000

type RecorderCtor = { isTypeSupported?: (type: string) => boolean } | undefined | null

function getCtor(): typeof MediaRecorder | undefined {
  if (typeof window === 'undefined') return undefined
  const MR = (window as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
  return typeof MR === 'function' ? MR : undefined
}

export function isRecorderSupported(): boolean {
  if (!getCtor()) return false
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/** MIME đầu tiên trình duyệt hỗ trợ; `undefined` → để trình duyệt tự chọn. */
export function pickMimeType(MR: RecorderCtor = getCtor()): string | undefined {
  if (!MR || typeof MR.isTypeSupported !== 'function') return undefined
  return MIME_CANDIDATES.find((t) => {
    try {
      return MR.isTypeSupported!(t)
    } catch {
      return false
    }
  })
}

/** Xin luồng micro. Chỉ gọi khi người dùng bấm "Ghi âm" (không xin khi vào trang). */
export function requestMicStream(): Promise<MediaStream> {
  if (!isRecorderSupported()) return Promise.reject(new DOMException('unsupported', 'NotSupportedError'))
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

/** Tạo MediaRecorder với MIME đã chọn; trình duyệt từ chối MIME → thử lại với mặc định. */
export function createRecorder(stream: MediaStream, mimeType: string | undefined = pickMimeType()): MediaRecorder {
  const MR = getCtor()
  if (!MR) throw new DOMException('unsupported', 'NotSupportedError')
  if (mimeType) {
    try {
      return new MR(stream, { mimeType })
    } catch {
      /* rơi xuống mặc định */
    }
  }
  return new MR(stream)
}

/** Tắt mọi track (đèn báo micro của trình duyệt tắt theo). */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop()
    } catch {
      /* bỏ qua */
    }
  })
}

export type RecorderErrorKind = 'denied' | 'notfound' | 'other'

/** Phân loại lỗi getUserMedia / MediaRecorder để hiện đúng câu (6.9 trạng thái). */
export function classifyRecorderError(e: unknown): RecorderErrorKind {
  const name = (e as { name?: unknown } | null)?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'notfound'
  return 'other'
}

/** Giây → "0:07". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
