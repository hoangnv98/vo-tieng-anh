import { describe, expect, it } from 'vitest'
import { blankPattern, fillPattern, PATTERN_COUNT, SITUATIONS } from './patterns'

const KEY = /\{([a-zA-Z0-9_]+)\}/g
const keysOf = (s: string) => [...s.matchAll(KEY)].map((m) => m[1])

describe('seed mẫu câu', () => {
  it('có 9 tình huống, mỗi tình huống 8-10 mẫu câu', () => {
    expect(SITUATIONS).toHaveLength(9)
    for (const s of SITUATIONS) {
      expect(s.patterns.length, s.id).toBeGreaterThanOrEqual(8)
      expect(s.patterns.length, s.id).toBeLessThanOrEqual(10)
    }
    expect(PATTERN_COUNT).toBe(SITUATIONS.reduce((n, s) => n + s.patterns.length, 0))
  })

  it('mọi {key} trong en/vi khớp slots; fillPattern không còn "{"', () => {
    for (const s of SITUATIONS)
      for (const p of s.patterns) {
        const slotKeys = new Set((p.slots ?? []).map((x) => x.key))
        for (const k of [...keysOf(p.en), ...keysOf(p.vi)]) expect(slotKeys.has(k), `${p.id} {${k}}`).toBe(true)
        for (const slot of p.slots ?? []) expect(slot.examples.length, `${p.id} ${slot.key}`).toBeGreaterThan(0)
        expect(fillPattern(p, 0).en, p.id).not.toContain('{')
        expect(fillPattern(p, 0).vi, p.id).not.toContain('{')
        expect(blankPattern(p.en), p.id).not.toContain('{')
      }
  })

  it('id không trùng; en/vi/ipa không rỗng', () => {
    const ids = new Set<string>()
    for (const s of SITUATIONS)
      for (const p of s.patterns) {
        expect(ids.has(p.id), `trùng ${p.id}`).toBe(false)
        ids.add(p.id)
        expect(p.id.startsWith(`${s.id}-`)).toBe(true)
        expect(p.en.trim(), p.id).not.toBe('')
        expect(p.vi.trim(), p.id).not.toBe('')
        expect(p.ipa.trim(), p.id).not.toBe('')
      }
  })

  it('IPA có dạng /…/; tập key en == vi == slots; key slot không trùng', () => {
    for (const s of SITUATIONS)
      for (const p of s.patterns) {
        expect(p.ipa, p.id).toMatch(/^\/[^/]+\/$/)
        const en = [...new Set(keysOf(p.en))].sort()
        const vi = [...new Set(keysOf(p.vi))].sort()
        const slots = (p.slots ?? []).map((x) => x.key)
        expect(new Set(slots).size, `${p.id} key trùng`).toBe(slots.length)
        expect(en, p.id).toEqual(vi)
        expect(en, p.id).toEqual([...slots].sort())
      }
  })
})
