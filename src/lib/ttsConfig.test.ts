import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyHost,
  DEFAULT_TTS_CONFIG,
  isMixedContentBlocked,
  normalizeBaseUrl,
  readTtsConfig,
  subscribeTtsConfig,
  TTS_CONFIG_KEY,
  URL_ERRORS,
  URL_HINT_V1,
  writeTtsConfig,
} from './ttsConfig'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

let win: EventTarget
beforeEach(() => {
  win = new EventTarget()
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('window', win)
})
afterEach(() => vi.unstubAllGlobals())

describe('readTtsConfig / writeTtsConfig', () => {
  it('rỗng, JSON hỏng hoặc v lạ → mặc định', () => {
    expect(readTtsConfig()).toEqual(DEFAULT_TTS_CONFIG)
    localStorage.setItem(TTS_CONFIG_KEY, '{oops')
    expect(readTtsConfig()).toEqual(DEFAULT_TTS_CONFIG)
    localStorage.setItem(TTS_CONFIG_KEY, JSON.stringify({ v: 2, vi: { enabled: true } }))
    expect(readTtsConfig()).toEqual(DEFAULT_TTS_CONFIG)
  })
  it('thiếu/sai kiểu trường → merge mặc định; speed ngoài tập → 1', () => {
    localStorage.setItem(TTS_CONFIG_KEY, JSON.stringify({ v: 1, vi: { enabled: true, speed: 1.7, voice: 3 }, en: 'x' }))
    const c = readTtsConfig()
    expect(c.vi).toEqual({ ...DEFAULT_TTS_CONFIG.vi, enabled: true })
    expect(c.en).toEqual(DEFAULT_TTS_CONFIG.en)
  })
  it('baseUrl lưu không hợp lệ → mặc định; hợp lệ → chuẩn hoá', () => {
    localStorage.setItem(TTS_CONFIG_KEY, JSON.stringify({ v: 1, vi: { baseUrl: 'localhost:8000' }, en: { baseUrl: 'http://localhost:8880/v1/' } }))
    const c = readTtsConfig()
    expect(c.vi.baseUrl).toBe(DEFAULT_TTS_CONFIG.vi.baseUrl)
    expect(c.en.baseUrl).toBe('http://localhost:8880')
  })
  it('ghi rồi đọc lại; subscriber cùng tab được gọi', () => {
    const cb = vi.fn()
    const off = subscribeTtsConfig(cb)
    const next = { ...DEFAULT_TTS_CONFIG, vi: { ...DEFAULT_TTS_CONFIG.vi, enabled: true, speed: 0.8 } }
    writeTtsConfig(next)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(readTtsConfig()).toEqual(next)
    off()
  })
  it('subscriber nhận sự kiện storage từ tab khác (chỉ đúng khoá)', () => {
    const cb = vi.fn()
    const off = subscribeTtsConfig(cb)
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'khac' }))
    expect(cb).not.toHaveBeenCalled()
    win.dispatchEvent(Object.assign(new Event('storage'), { key: TTS_CONFIG_KEY }))
    expect(cb).toHaveBeenCalledTimes(1)
    off()
  })
})

describe('normalizeBaseUrl', () => {
  it('bỏ / cuối', () => expect(normalizeBaseUrl(' http://localhost:8000/ ')).toEqual({ ok: true, value: 'http://localhost:8000' }))
  it('cắt /v1 cuối + hint', () =>
    expect(normalizeBaseUrl('http://192.168.1.5:8000/v1/')).toEqual({ ok: true, value: 'http://192.168.1.5:8000', hint: URL_HINT_V1 }))
  it('thiếu protocol hoặc protocol lạ → lỗi', () => {
    expect(normalizeBaseUrl('localhost:8000')).toEqual({ ok: false, error: URL_ERRORS.protocol })
    expect(normalizeBaseUrl('ftp://host')).toEqual({ ok: false, error: URL_ERRORS.protocol })
    expect(normalizeBaseUrl('http://')).toEqual({ ok: false, error: URL_ERRORS.protocol })
  })
  it('có ? hoặc # → lỗi', () => {
    expect(normalizeBaseUrl('http://localhost:8000?x=1')).toEqual({ ok: false, error: URL_ERRORS.query })
    expect(normalizeBaseUrl('http://localhost:8000/#a')).toEqual({ ok: false, error: URL_ERRORS.query })
  })
  it('có tên đăng nhập → lỗi', () => {
    expect(normalizeBaseUrl('http://u:p@host')).toEqual({ ok: false, error: URL_ERRORS.credentials })
    expect(normalizeBaseUrl('https://user@tts.example.com')).toEqual({ ok: false, error: URL_ERRORS.credentials })
  })
  it('> 200 ký tự → lỗi', () =>
    expect(normalizeBaseUrl(`http://h.com/${'a'.repeat(200)}`)).toEqual({ ok: false, error: URL_ERRORS.length }))
  it('giữ path prefix (reverse proxy)', () =>
    expect(normalizeBaseUrl('http://host:8080/tts/')).toEqual({ ok: true, value: 'http://host:8080/tts' }))
  it('chấp nhận https public (Tailscale / Cloudflare Tunnel)', () => {
    expect(normalizeBaseUrl('https://laptop.tail1234.ts.net/')).toEqual({ ok: true, value: 'https://laptop.tail1234.ts.net' })
    expect(normalizeBaseUrl('https://abc-def.trycloudflare.com/v1')).toEqual({
      ok: true,
      value: 'https://abc-def.trycloudflare.com',
      hint: URL_HINT_V1,
    })
  })
  it('chấp nhận http LAN', () => expect(normalizeBaseUrl('http://10.0.0.4:8000')).toEqual({ ok: true, value: 'http://10.0.0.4:8000' }))
})

describe('classifyHost / isMixedContentBlocked', () => {
  it('loopback', () => {
    for (const u of ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://[::1]:8000', 'localhost', 'http://tts.localhost:8000']) expect(classifyHost(u)).toBe('loopback')
  })
  it('private', () => {
    for (const u of ['http://10.1.2.3', 'http://172.20.0.1', 'http://192.168.0.9:8000', 'http://mac.local:8000', 'http://169.254.1.1', 'http://nas.home.arpa', 'http://[fd12:3456::1]:8000', 'http://[fc00::1]', 'http://[fe80::1]'])
      expect(classifyHost(u)).toBe('private')
  })
  it('public', () => {
    for (const u of ['https://tts.example.com', 'http://8.8.8.8', 'http://172.32.0.1', 'https://x.ts.net', 'https://a.trycloudflare.com', 'http://[2001:db8::1]'])
      expect(classifyHost(u)).toBe('public')
  })
  it('mixed content chỉ chặn http không-loopback trên trang https', () => {
    expect(isMixedContentBlocked('http://192.168.1.5:8000', 'https:')).toBe(true)
    expect(isMixedContentBlocked('http://localhost:8000', 'https:')).toBe(false)
    expect(isMixedContentBlocked('https://laptop.tail1234.ts.net', 'https:')).toBe(false)
    expect(isMixedContentBlocked('http://192.168.1.5:8000', 'http:')).toBe(false)
  })
})
