import { describe, expect, it } from 'vitest'
import type { Item } from '../domain/types'
import { createPatternGate } from './patternGate'

const item = (pattern_id: string | null): Item => ({
  id: pattern_id ?? 'x', user_id: 'u', lesson_id: null, kind: 'pattern', en: 'a', vi: 'b', ipa: '', note: '',
  pattern_id, position: 0, created_at: '', updated_at: '',
})

describe('patternGate', () => {
  it('gọi 2 lần không await chỉ cho qua 1 lần', () => {
    const g = createPatternGate()
    const first = g.claim([item('p1')], new Set())
    const second = g.claim([item('p1')], new Set())
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(0)
    g.release(first)
    expect(g.claim([item('p1')], new Set())).toHaveLength(1)
  })
  it('loại pattern đã có trong state', () => {
    expect(createPatternGate().claim([item('p1'), item('p2')], new Set(['p1']))).toHaveLength(1)
  })
})
