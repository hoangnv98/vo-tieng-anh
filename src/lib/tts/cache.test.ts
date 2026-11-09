import { describe, expect, it } from 'vitest'
import { AudioCache, CACHE_MAX_BYTES, cacheKey } from './cache'

const MB = 1024 * 1024
const blob = (size: number) => ({ size }) as Blob
const k = (text: string, rate = 1) => cacheKey({ providerId: 'server-vi', baseUrl: 'http://localhost:8000', voice: 'Hải Đăng', rate, text })

describe('AudioCache', () => {
  it('khoá phân biệt rate', () => expect(k('a', 1)).not.toBe(k('a', 0.8)))
  it('vượt 50 mục → đuổi mục cũ nhất; get làm mới thứ tự', () => {
    const c = new AudioCache()
    for (let i = 0; i < 50; i++) c.set(k(`t${i}`), 'vi', blob(10))
    c.get(k('t0'))
    c.set(k('t50'), 'vi', blob(10))
    expect(c.size).toBe(50)
    expect(c.has(k('t0'))).toBe(true)
    expect(c.has(k('t1'))).toBe(false)
  })
  it('tổng > 20 MB → đuổi tới khi ≤ 20 MB; mục > 20 MB không cache; rỗng không cache', () => {
    const c = new AudioCache()
    c.set(k('a'), 'vi', blob(8 * MB))
    c.set(k('b'), 'vi', blob(8 * MB))
    c.set(k('c'), 'vi', blob(8 * MB))
    expect(c.has(k('a'))).toBe(false)
    expect(c.bytes).toBeLessThanOrEqual(CACHE_MAX_BYTES)
    c.set(k('huge'), 'vi', blob(21 * MB))
    c.set(k('empty'), 'vi', blob(0))
    expect(c.has(k('huge'))).toBe(false)
    expect(c.has(k('empty'))).toBe(false)
  })
  it('clear(lang) chỉ xoá ngôn ngữ đó', () => {
    const c = new AudioCache()
    c.set('vi1', 'vi', blob(5))
    c.set('en1', 'en', blob(5))
    c.clear('vi')
    expect(c.has('vi1')).toBe(false)
    expect(c.has('en1')).toBe(true)
    expect(c.bytes).toBe(5)
  })
})
