import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearVoiceCache, pickVoiceFor, speakTimeoutMs, WebSpeechProvider, type VoiceLike } from './webSpeech'

interface FakeVoice extends VoiceLike {
  name: string
}
function v(lang: string, extra: Partial<FakeVoice> = {}): FakeVoice {
  return { name: `${lang}${extra.localService ? '-local' : ''}${extra.default ? '-default' : ''}`, lang, localService: false, default: false, ...extra }
}

describe('pickVoiceFor', () => {
  it('zh: [zh-TW, zh-CN] → zh-CN (khớp đúng zh-CN trước)', () => {
    expect(pickVoiceFor('zh', [v('zh-TW'), v('zh-CN')])?.lang).toBe('zh-CN')
  })
  it('zh: [zh-HK, zh-TW] → zh-TW (tránh giọng Quảng Đông)', () => {
    expect(pickVoiceFor('zh', [v('zh-HK'), v('zh-TW')])?.lang).toBe('zh-TW')
  })
  it('zh: [yue-HK] → yue-HK (bậc cuối, vẫn hơn không có)', () => {
    expect(pickVoiceFor('zh', [v('yue-HK')])?.lang).toBe('yue-HK')
  })
  it('zh: Phổ thông giản thể khác (zh-SG, cmn-Hans-CN) trước phồn thể', () => {
    expect(pickVoiceFor('zh', [v('zh-TW'), v('cmn-Hans-CN')])?.lang).toBe('cmn-Hans-CN')
    expect(pickVoiceFor('zh', [v('zh-HK'), v('zh-SG'), v('zh-TW')])?.lang).toBe('zh-SG')
    expect(pickVoiceFor('zh', [v('zh-Hant-TW'), v('zh-HK')])?.lang).toBe('zh-Hant-TW')
  })
  it('ja: [ja_JP] → khớp (chuẩn hoá _ và chữ hoa)', () => {
    expect(pickVoiceFor('ja', [v('en-US'), v('ja_JP')])?.lang).toBe('ja_JP')
  })
  it('ko/vi: khớp đúng trước, rồi tiền tố; không khớp nhầm tiền tố khác', () => {
    expect(pickVoiceFor('ko', [v('ko'), v('ko-KR')])?.lang).toBe('ko-KR')
    expect(pickVoiceFor('ko', [v('ko')])?.lang).toBe('ko')
    expect(pickVoiceFor('vi', [v('vi'), v('vi-VN')])?.lang).toBe('vi-VN')
    expect(pickVoiceFor('ja', [v('jv-ID')])).toBeUndefined()
  })
  it('[] hoặc không có giọng ngôn ngữ đó → undefined', () => {
    expect(pickVoiceFor('zh', [])).toBeUndefined()
    expect(pickVoiceFor('ko', [v('en-US'), v('ja-JP')])).toBeUndefined()
  })
  it('cùng bậc: localService trước, rồi default, rồi thứ tự gốc', () => {
    const remote = v('ja-JP')
    const local = v('ja-JP', { localService: true })
    expect(pickVoiceFor('ja', [remote, local])).toBe(local)
    const def = v('ko-KR', { default: true })
    expect(pickVoiceFor('ko', [v('ko-KR'), def])).toBe(def)
    expect(pickVoiceFor('ko', [def, v('ko-KR', { localService: true })])?.localService).toBe(true)
    const a = { ...v('zh-CN'), name: 'a' }
    const b = { ...v('zh-CN'), name: 'b' }
    expect(pickVoiceFor('zh', [a, b])).toBe(a)
  })
  it('vi: không xét localService (giữ thứ tự T19), default vẫn xét', () => {
    const remote = v('vi-VN')
    const local = v('vi-VN', { localService: true })
    expect(pickVoiceFor('vi', [remote, local])).toBe(remote)
    expect(pickVoiceFor('vi', [local, remote])).toBe(local)
    expect(pickVoiceFor('vi', [v('vi', { localService: true }), v('vi-VN')])?.lang).toBe('vi-VN')
  })
  it('bậc ưu tiên mạnh hơn localService', () => {
    expect(pickVoiceFor('zh', [v('zh-TW', { localService: true }), v('zh-CN')])?.lang).toBe('zh-CN')
  })
})

describe('speakTimeoutMs', () => {
  it('vi giữ công thức T19; CJK 400 ms/ký tự, tối thiểu 3 s', () => {
    expect(speakTimeoutMs('vi', 10, 1)).toBe(1200 + 5000)
    expect(speakTimeoutMs('zh', 2, 1)).toBe(3000 + 5000)
    expect(speakTimeoutMs('ja', 20, 0.5)).toBe(8000 / 0.5 + 5000)
  })
})

describe('WebSpeechProvider zh/ja/ko', () => {
  const voices: FakeVoice[] = []
  const synth = { speaking: false, cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => voices as unknown as SpeechSynthesisVoice[]) }
  class Utterance {
    text: string
    lang = ''
    rate = 1
    voice: unknown = null
    onend: (() => void) | null = null
    onerror: ((e: unknown) => void) | null = null
    constructor(t: string) {
      this.text = t
    }
  }
  function setup(list: FakeVoice[]) {
    voices.splice(0, voices.length, ...list)
    synth.speak.mockReset()
    clearVoiceCache()
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
    vi.stubGlobal('window', globalThis)
  }
  afterEach(() => vi.unstubAllGlobals())

  it('supports theo giọng thiết bị', () => {
    setup([v('en-US'), v('ja-JP')])
    const p = new WebSpeechProvider()
    expect(p.supports('en')).toBe(true)
    expect(p.supports('ja')).toBe(true)
    expect(p.supports('zh')).toBe(false)
    expect(p.supports('ko')).toBe(false)
  })
  it('speak zh → utterance lang zh-CN, giọng đã chọn, nối câu không thêm dấu cách', async () => {
    setup([v('zh-TW'), v('zh-CN')])
    const h = new WebSpeechProvider().speak({ text: '你好。再见！', lang: 'zh', rate: 0.75, owner: {} })
    expect(synth.speak).toHaveBeenCalledTimes(1)
    const u = synth.speak.mock.calls[0][0] as Utterance
    expect(u.lang).toBe('zh-CN')
    expect((u.voice as FakeVoice).lang).toBe('zh-CN')
    expect(u.rate).toBe(0.75)
    expect(u.text).toBe('你好。再见！')
    u.onend?.()
    await expect(h.promise).resolves.toBeUndefined()
  })
  it('không có giọng ko → reject unsupported, không gọi speechSynthesis.speak', async () => {
    setup([v('en-US')])
    const h = new WebSpeechProvider().speak({ text: '안녕하세요', lang: 'ko', rate: 1, owner: {} })
    await expect(h.promise).rejects.toMatchObject({ kind: 'unsupported' })
    expect(synth.speak).not.toHaveBeenCalled()
  })
})

describe('pickVoiceFor cache theo ngôn ngữ', () => {
  afterEach(() => vi.unstubAllGlobals())

  function fakeSynth(list: FakeVoice[]) {
    const listeners: (() => void)[] = []
    const synth = {
      speaking: false,
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: vi.fn(() => list as unknown as SpeechSynthesisVoice[]),
      addEventListener: vi.fn((type: string, cb: () => void) => {
        if (type === 'voiceschanged') listeners.push(cb)
      }),
      fire: () => listeners.forEach((cb) => cb()),
    }
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', class {})
    vi.stubGlobal('window', globalThis)
    return synth
  }

  it('gọi getVoices một lần cho mỗi ngôn ngữ khi đã có giọng; voiceschanged xoá cache', () => {
    const list: FakeVoice[] = [v('en-US')]
    const synth = fakeSynth(list)
    expect(pickVoiceFor('ja')).toBeUndefined()
    expect(pickVoiceFor('ja')).toBeUndefined()
    expect(synth.getVoices).toHaveBeenCalledTimes(1)
    pickVoiceFor('ko')
    expect(synth.getVoices).toHaveBeenCalledTimes(2)
    expect(synth.addEventListener).toHaveBeenCalledTimes(1)

    // Chrome nạp giọng trễ: danh sách đổi, sự kiện bắn → đọc lại.
    list.push(v('ja-JP'))
    expect(pickVoiceFor('ja')).toBeUndefined()
    synth.fire()
    expect(pickVoiceFor('ja')?.lang).toBe('ja-JP')
    expect(synth.getVoices).toHaveBeenCalledTimes(3)
  })

  it('danh sách giọng rỗng lúc đầu → không cache, lần sau đọc lại dù không có voiceschanged', () => {
    const list: FakeVoice[] = []
    const synth = fakeSynth(list)
    expect(pickVoiceFor('vi')).toBeUndefined()
    list.push(v('vi-VN'))
    expect(pickVoiceFor('vi')?.lang).toBe('vi-VN')
    expect(synth.getVoices).toHaveBeenCalledTimes(2)
  })

  it('truyền voices → không dùng cache', () => {
    const synth = fakeSynth([])
    pickVoiceFor('zh')
    expect(pickVoiceFor('zh', [v('zh-CN')])?.lang).toBe('zh-CN')
    expect(synth.getVoices).toHaveBeenCalledTimes(1)
  })
})
