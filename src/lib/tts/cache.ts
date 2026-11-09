import type { TtsLang, TtsProviderId } from './types'

export const CACHE_MAX_ENTRIES = 50
export const CACHE_MAX_BYTES = 20 * 1024 * 1024

export interface CacheKeyParts {
  providerId: TtsProviderId
  baseUrl: string
  voice: string
  rate: number
  text: string
}

export interface CacheEntry {
  blob: Blob
  bytes: number
  at: number
  lang: TtsLang
  /** `playbackRate` cần đặt khi phát (≠ 1 khi server không nhận `speed`). */
  playbackRate: number
}

export function cacheKey(p: CacheKeyParts): string {
  return JSON.stringify([p.providerId, p.baseUrl, p.voice, p.rate, p.text])
}

/** LRU chỉ trong bộ nhớ phiên; không bao giờ ghi ra storage. */
export class AudioCache {
  private map = new Map<string, CacheEntry>()
  private total = 0
  private readonly maxEntries: number
  private readonly maxBytes: number

  constructor(maxEntries: number = CACHE_MAX_ENTRIES, maxBytes: number = CACHE_MAX_BYTES) {
    this.maxEntries = maxEntries
    this.maxBytes = maxBytes
  }

  get size(): number {
    return this.map.size
  }
  get bytes(): number {
    return this.total
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  /** Lấy và đánh dấu vừa dùng. */
  get(key: string): CacheEntry | undefined {
    const e = this.map.get(key)
    if (!e) return undefined
    this.map.delete(key)
    e.at = Date.now()
    this.map.set(key, e)
    return e
  }

  set(key: string, lang: TtsLang, blob: Blob, playbackRate = 1): void {
    const bytes = blob.size
    if (bytes <= 0 || bytes > this.maxBytes) return
    this.delete(key)
    while (this.map.size > 0 && (this.map.size >= this.maxEntries || this.total + bytes > this.maxBytes)) {
      const oldest = this.map.keys().next().value as string
      this.delete(oldest)
    }
    this.map.set(key, { blob, bytes, at: Date.now(), lang, playbackRate })
    this.total += bytes
  }

  delete(key: string): void {
    const e = this.map.get(key)
    if (!e) return
    this.map.delete(key)
    this.total -= e.bytes
  }

  /** Xoá theo ngôn ngữ (đổi baseUrl/voice) hoặc tất cả. */
  clear(lang?: TtsLang): void {
    for (const [k, e] of [...this.map]) if (!lang || e.lang === lang) this.delete(k)
  }
}
