/** Cấu hình giọng đọc lưu trên thiết bị (localStorage `vta:v1:tts`), không đồng bộ Supabase. */

/** (T20) Ngôn ngữ đọc được: tiếng Việt + 4 ngôn ngữ học. `zh/ja/ko` luôn đi giọng trình duyệt. */
export type TtsLang = 'en' | 'vi' | 'zh' | 'ja' | 'ko'
/** Ngôn ngữ có server local (T19). `TtsConfig` chỉ có hai khối này. */
export type ServerLang = 'en' | 'vi'
export function isServerLang(x: unknown): x is ServerLang {
  return x === 'en' || x === 'vi'
}
export interface TtsServerConfig {
  baseUrl: string
  voice: string
}
export interface TtsConfig {
  v: 1
  vi: TtsServerConfig & { enabled: boolean; speed: number; deviceFallback: boolean }
  en: TtsServerConfig & { useServer: boolean }
}

export const TTS_CONFIG_KEY = 'vta:v1:tts'
export const VI_SPEEDS = [0.8, 0.9, 1, 1.1, 1.2] as const
export const MAX_BASE_URL = 200
export const MAX_VOICE = 60

export const DEFAULT_TTS_CONFIG: TtsConfig = {
  v: 1,
  vi: { enabled: false, baseUrl: 'http://localhost:8000', voice: '', speed: 1, deviceFallback: false },
  en: { useServer: false, baseUrl: 'http://localhost:8880', voice: '' },
}

function cloneDefault(): TtsConfig {
  return { v: 1, vi: { ...DEFAULT_TTS_CONFIG.vi }, en: { ...DEFAULT_TTS_CONFIG.en } }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
function bool(x: unknown, d: boolean): boolean {
  return typeof x === 'boolean' ? x : d
}
function str(x: unknown, d: string, max: number): string {
  return typeof x === 'string' && x.length <= max ? x : d
}
/** baseUrl lưu không hợp lệ → mặc định; hợp lệ → dạng đã chuẩn hoá. */
function url(x: unknown, d: string): string {
  if (typeof x !== 'string') return d
  const n = normalizeBaseUrl(x)
  return n.ok ? n.value : d
}

export function normalizeSpeed(x: unknown): number {
  if (typeof x !== 'number') return 1
  const hit = VI_SPEEDS.find((s) => Math.abs(s - x) < 1e-6)
  return hit ?? 1
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Parse an toàn: rỗng/JSON hỏng/`v` lạ → mặc định; thiếu hoặc sai kiểu từng trường → lấy mặc định của trường đó. */
export function readTtsConfig(): TtsConfig {
  const d = cloneDefault()
  let raw: string | null = null
  try {
    raw = storage()?.getItem(TTS_CONFIG_KEY) ?? null
  } catch {
    return d
  }
  if (!raw) return d
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return d
  }
  if (!isObj(parsed) || parsed.v !== 1) return d
  const vi = isObj(parsed.vi) ? parsed.vi : {}
  const en = isObj(parsed.en) ? parsed.en : {}
  return {
    v: 1,
    vi: {
      enabled: bool(vi.enabled, d.vi.enabled),
      baseUrl: url(vi.baseUrl, d.vi.baseUrl),
      voice: str(vi.voice, d.vi.voice, MAX_VOICE),
      speed: normalizeSpeed(vi.speed),
      deviceFallback: bool(vi.deviceFallback, d.vi.deviceFallback),
    },
    en: {
      useServer: bool(en.useServer, d.en.useServer),
      baseUrl: url(en.baseUrl, d.en.baseUrl),
      voice: str(en.voice, d.en.voice, MAX_VOICE),
    },
  }
}

const listeners = new Set<() => void>()
let storageAttached = false

function emit() {
  for (const cb of [...listeners]) cb()
}

function onStorage(e: StorageEvent) {
  if (e.key === TTS_CONFIG_KEY || e.key === null) emit()
}

export function writeTtsConfig(c: TtsConfig): void {
  try {
    storage()?.setItem(TTS_CONFIG_KEY, JSON.stringify(c))
  } catch {
    // Hết quota / chế độ riêng tư: bỏ qua, cấu hình vẫn có hiệu lực tới khi đọc lại.
  }
  emit()
}

/** Dùng với useSyncExternalStore; nghe cả thay đổi cùng tab và tab khác (sự kiện `storage`). */
export function subscribeTtsConfig(cb: () => void): () => void {
  listeners.add(cb)
  if (!storageAttached && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', onStorage)
    storageAttached = true
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && storageAttached && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
      storageAttached = false
    }
  }
}

export const URL_ERRORS = {
  protocol: 'Địa chỉ phải bắt đầu bằng http:// hoặc https://.',
  query: 'Địa chỉ không được chứa ? hoặc #.',
  credentials: 'Địa chỉ không được chứa tên đăng nhập.',
  length: 'Địa chỉ tối đa 200 ký tự.',
} as const
export const URL_HINT_V1 = 'Đã bỏ /v1 ở cuối — app tự thêm.'

export function normalizeBaseUrl(raw: string): { ok: true; value: string; hint?: string } | { ok: false; error: string } {
  const s = raw.trim()
  if (s.length > MAX_BASE_URL) return { ok: false, error: URL_ERRORS.length }
  if (!/^https?:\/\//i.test(s)) return { ok: false, error: URL_ERRORS.protocol }
  if (s.includes('?') || s.includes('#')) return { ok: false, error: URL_ERRORS.query }
  if (/^https?:\/\/[^/]*@/i.test(s)) return { ok: false, error: URL_ERRORS.credentials }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return { ok: false, error: URL_ERRORS.protocol }
  }
  if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname) return { ok: false, error: URL_ERRORS.protocol }
  if (u.username || u.password) return { ok: false, error: URL_ERRORS.credentials }
  let path = u.pathname.replace(/\/+$/, '')
  let hint: string | undefined
  if (/\/v1$/i.test(path)) {
    path = path.slice(0, -3).replace(/\/+$/, '')
    hint = URL_HINT_V1
  }
  const value = `${u.protocol}//${u.host}${path}`
  return hint ? { ok: true, value, hint } : { ok: true, value }
}

function hostOf(url: string): string | null {
  const s = url.trim()
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `http://${s}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

function ipv4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  return parts.every((n) => n <= 255) ? parts : null
}

/** `loopback` = localhost/127.0.0.0/8/[::1]; `private` = RFC1918, link-local, .local/.lan/.home.arpa/.internal; còn lại `public`. */
export function classifyHost(url: string): 'loopback' | 'private' | 'public' {
  const host = hostOf(url)
  if (!host) return 'public'
  if (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '::1') return 'loopback'
  if (host.startsWith('[')) {
    // IPv6: fc00::/7 (ULA) và fe80::/10 (link-local) → private.
    const h = host.slice(1, -1)
    return /^f[cd][0-9a-f]{0,2}:/.test(h) || /^fe[89ab][0-9a-f]?:/.test(h) ? 'private' : 'public'
  }
  const ip = ipv4(host)
  if (ip) {
    const [a, b] = ip
    if (a === 127) return 'loopback'
    if (a === 10) return 'private'
    if (a === 172 && b >= 16 && b <= 31) return 'private'
    if (a === 192 && b === 168) return 'private'
    if (a === 169 && b === 254) return 'private'
    return 'public'
  }
  if (['.local', '.lan', '.home.arpa', '.internal'].some((suf) => host.endsWith(suf))) return 'private'
  return 'public'
}

/** Trang https gọi http không phải loopback → trình duyệt chặn (mixed content). */
export function isMixedContentBlocked(
  url: string,
  pageProtocol: string = typeof location === 'undefined' ? 'http:' : location.protocol,
): boolean {
  if (pageProtocol !== 'https:') return false
  if (!/^http:\/\//i.test(url.trim())) return false
  return classifyHost(url) !== 'loopback'
}
