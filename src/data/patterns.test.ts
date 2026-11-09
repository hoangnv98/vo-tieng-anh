import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../domain/types'
import {
  blankPattern,
  fillPattern,
  firstSituationId,
  languageOfPattern,
  PATTERN_COUNT,
  situationsOf,
  SITUATIONS,
} from './patterns'

const KEY = /\{([a-zA-Z0-9_]+)\}/g
const keysOf = (s: string) => [...s.matchAll(KEY)].map((m) => m[1])

const EN = SITUATIONS.filter((s) => s.language === 'en')
const STARTER = SITUATIONS.filter((s) => s.language !== 'en')

/** Hệ chữ bắt buộc của câu đích. */
const SCRIPT = {
  zh: /\p{Script=Han}/u,
  ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  ko: /\p{Script=Hangul}/u,
} as const

/** Ký tự được phép trong phiên âm (chữ Latin + khoảng trắng + ,.?!'’-). */
const ROMAN = {
  zh: /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ ,.?!'’-]+$/u,
  ja: /^[a-zāīūēō ,.?!'’-]+$/u,
  ko: /^[a-z ,.?!'’-]+$/,
} as const

const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u

/** Một số chữ phồn thể phổ biến không được xuất hiện trong câu zh (giản thể). */
const TRADITIONAL = '這個們麼嗎說話謝請問點錢貴買賣車遠還邊對時會見樣認識興單帳結幫務員碼別機場輛來'

describe('seed mẫu câu', () => {
  it('21 tình huống: 9 en (8–10 mẫu) + 12 khởi đầu zh/ja/ko (đúng 5 mẫu); PATTERN_COUNT = 147', () => {
    expect(SITUATIONS).toHaveLength(21)
    expect(EN).toHaveLength(9)
    for (const lang of ['zh', 'ja', 'ko'] as const)
      expect(SITUATIONS.filter((s) => s.language === lang).map((s) => s.id)).toEqual([
        `${lang}-greetings`,
        `${lang}-restaurant`,
        `${lang}-shopping`,
        `${lang}-directions`,
      ])
    for (const s of SITUATIONS) expect(LANGUAGES, s.id).toContain(s.language)
    for (const s of EN) {
      expect(s.patterns.length, s.id).toBeGreaterThanOrEqual(8)
      expect(s.patterns.length, s.id).toBeLessThanOrEqual(10)
    }
    for (const s of STARTER) expect(s.patterns, s.id).toHaveLength(5)
    expect(PATTERN_COUNT).toBe(147)
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

  it('id tình huống và id mẫu không trùng; en/vi/ipa không rỗng', () => {
    expect(new Set(SITUATIONS.map((s) => s.id)).size).toBe(SITUATIONS.length)
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

  it('tình huống en: IPA dạng /…/; tập key en == vi == slots; key slot không trùng', () => {
    for (const s of EN)
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

describe('bộ khởi đầu zh/ja/ko', () => {
  it('có nameTarget, intro, pronunciationFocus; icon dùng lại icon tình huống en', () => {
    const enIcons = new Set(EN.map((s) => s.icon))
    for (const s of STARTER) {
      expect(s.nameTarget?.trim(), s.id).toBeTruthy()
      expect(s.nameTarget ?? '', s.id).toMatch(SCRIPT[s.language as keyof typeof SCRIPT])
      expect(s.intro.trim(), s.id).not.toBe('')
      expect(s.pronunciationFocus.trim(), s.id).not.toBe('')
      expect(enIcons.has(s.icon), s.id).toBe(true)
    }
  })

  it('mỗi mẫu: id {situationId}-01..05, A1, không slots, câu đúng hệ chữ, phiên âm không có "/"', () => {
    for (const s of STARTER) {
      const lang = s.language as keyof typeof SCRIPT
      expect(s.patterns.map((p) => p.id), s.id).toEqual([1, 2, 3, 4, 5].map((n) => `${s.id}-0${n}`))
      for (const p of s.patterns) {
        expect(p.level, p.id).toBe('A1')
        expect(p.slots, p.id).toBeUndefined()
        expect(p.en, p.id).not.toContain('{')
        expect(p.en, p.id).toMatch(SCRIPT[lang])
        expect(p.ipa, p.id).not.toContain('/')
        expect(p.ipa, p.id).toMatch(ROMAN[lang])
        expect(p.vi.trim(), p.id).not.toBe('')
      }
    }
  })

  it('zh: chữ giản thể (không chứa chữ phồn thể phổ biến); pinyin có dấu thanh', () => {
    for (const s of STARTER.filter((x) => x.language === 'zh')) {
      for (const ch of `${TRADITIONAL}與廳購`) expect(s.nameTarget?.includes(ch), `${s.id} chứa phồn thể ${ch}`).toBe(false)
      for (const p of s.patterns) {
        for (const ch of TRADITIONAL) expect(p.en.includes(ch), `${p.id} chứa phồn thể ${ch}`).toBe(false)
        expect(p.ipa, p.id).toMatch(TONE_MARK)
        expect(p.ipa, p.id).not.toMatch(/[1-5]/)
      }
    }
  })

  it('ja: câu có kana; ko: romanization chỉ ASCII', () => {
    for (const s of STARTER.filter((x) => x.language === 'ja'))
      for (const p of s.patterns) expect(p.en, p.id).toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u)
    for (const s of STARTER.filter((x) => x.language === 'ko'))
      for (const p of s.patterns) expect(p.ipa, p.id).toMatch(/^[\x20-\x7e]+$/)
  })
})

describe('helper theo ngôn ngữ', () => {
  it('situationsOf lọc theo ngôn ngữ, all → toàn bộ', () => {
    expect(situationsOf('all')).toHaveLength(21)
    expect(situationsOf('en')).toHaveLength(9)
    for (const lang of ['zh', 'ja', 'ko'] as const) {
      expect(situationsOf(lang)).toHaveLength(4)
      expect(situationsOf(lang).every((s) => s.language === lang)).toBe(true)
    }
  })

  it('firstSituationId và languageOfPattern', () => {
    expect(firstSituationId('en')).toBe('greetings')
    expect(firstSituationId('zh')).toBe('zh-greetings')
    expect(firstSituationId('ja')).toBe('ja-greetings')
    expect(firstSituationId('ko')).toBe('ko-greetings')
    expect(languageOfPattern('ordering-01')).toBe('en')
    expect(languageOfPattern('ja-restaurant-01')).toBe('ja')
    expect(languageOfPattern('zh-directions-05')).toBe('zh')
    expect(languageOfPattern('ko-greetings-01')).toBe('ko')
    expect(languageOfPattern('khong-co-01')).toBeUndefined()
  })
})
