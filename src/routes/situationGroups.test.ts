import { describe, expect, it } from 'vitest'
import { findSituation } from '../data/patterns'
import { selectSituationGroups, situationGroups, situationTargetName } from './situationGroups'

const ids = (g: ReturnType<typeof situationGroups>) => g.map((x) => [x.language, x.situations.map((s) => s.id)])

describe('situationGroups', () => {
  it('Tất cả → 4 nhóm theo thứ tự LANGUAGES, 9/4/4/4 tình huống', () => {
    const g = situationGroups('all')
    expect(g.map((x) => x.language)).toEqual(['en', 'zh', 'ja', 'ko'])
    expect(g.map((x) => x.situations.length)).toEqual([9, 4, 4, 4])
  })
  it('một ngôn ngữ → đúng một nhóm, chỉ tình huống của ngôn ngữ đó', () => {
    const g = situationGroups('ja')
    expect(g).toHaveLength(1)
    expect(g[0].situations.map((s) => s.id)).toEqual(['ja-greetings', 'ja-restaurant', 'ja-shopping', 'ja-directions'])
  })
  it('nguồn không có ngôn ngữ đó → không có nhóm rỗng', () => {
    const en = situationGroups('en')[0].situations
    expect(situationGroups('all', en).map((x) => x.language)).toEqual(['en'])
    expect(situationGroups('ko', en)).toEqual([])
  })
})

describe('selectSituationGroups (select "Tình huống" của Shadowing)', () => {
  it('lọc ko → chỉ tình huống ko', () => {
    const g = selectSituationGroups('ko', 'ko-greetings')
    expect(g).toHaveLength(1)
    expect(g[0].situations.every((s) => s.language === 'ko')).toBe(true)
  })
  it('Tất cả → 4 nhóm (optgroup)', () => {
    expect(selectSituationGroups('all', 'greetings')).toHaveLength(4)
  })
  it('?pattern= khác ngôn ngữ lọc → vẫn có tình huống đang chọn, xếp theo LANGUAGES', () => {
    const g = selectSituationGroups('ko', 'ja-shopping')
    expect(ids(g)).toEqual([
      ['ja', ['ja-shopping']],
      ['ko', ['ko-greetings', 'ko-restaurant', 'ko-shopping', 'ko-directions']],
    ])
  })
  it('id lạ → như situationGroups', () => {
    expect(selectSituationGroups('zh', 'nope')).toEqual(situationGroups('zh'))
  })
})

describe('situationTargetName', () => {
  it('zh/ja/ko dùng nameTarget, en dùng nameEn', () => {
    const ja = findSituation('ja-restaurant')!
    expect(situationTargetName(ja)).toBe(ja.nameTarget)
    const en = findSituation('greetings')!
    expect(situationTargetName(en)).toBe(en.nameEn)
  })
})
