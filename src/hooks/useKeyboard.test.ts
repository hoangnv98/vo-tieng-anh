import { describe, expect, it } from 'vitest'
import { keyName, shouldIgnoreKey, type KeyEventLike } from './useKeyboard'

/** Phần tử giả: `closest(sel)` khớp khi sel chứa một trong các `matches`. */
function el(...matches: string[]): EventTarget {
  return {
    closest: (sel: string) => (matches.some((m) => sel.split(',').map((x) => x.trim()).includes(m)) ? {} : null),
  } as unknown as EventTarget
}

function ev(key: string, over: Partial<KeyEventLike> = {}): KeyEventLike {
  return {
    key,
    target: el(),
    defaultPrevented: false,
    isComposing: false,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...over,
  }
}

describe('keyName', () => {
  it('chuẩn hoá Space, chữ thường, giữ phím đặc biệt', () => {
    expect(keyName({ key: ' ' })).toBe('Space')
    expect(keyName({ key: 'Spacebar' })).toBe('Space')
    expect(keyName({ key: 'S' })).toBe('s')
    expect(keyName({ key: '3' })).toBe('3')
    expect(keyName({ key: 'Enter' })).toBe('Enter')
    expect(keyName({ key: 'Escape' })).toBe('Escape')
  })
})

describe('shouldIgnoreKey', () => {
  it('xử lý phím thường trên vùng không tương tác', () => {
    expect(shouldIgnoreKey(ev(' '))).toBe(false)
    expect(shouldIgnoreKey(ev('1'))).toBe(false)
    expect(shouldIgnoreKey(ev('1', { target: null }))).toBe(false)
  })

  it('bỏ qua Space/Enter trên button/link (trình duyệt tự kích hoạt), nhưng vẫn nhận phím số', () => {
    expect(shouldIgnoreKey(ev(' ', { target: el('button') }))).toBe(true)
    expect(shouldIgnoreKey(ev('Enter', { target: el('a[href]') }))).toBe(true)
    expect(shouldIgnoreKey(ev('2', { target: el('button') }))).toBe(false)
  })

  it('bỏ qua mọi phím khi focus trong ô nhập hoặc dialog', () => {
    expect(shouldIgnoreKey(ev('1', { target: el('input') }))).toBe(true)
    expect(shouldIgnoreKey(ev(' ', { target: el('textarea') }))).toBe(true)
    expect(shouldIgnoreKey(ev('s', { target: el('dialog') }))).toBe(true)
  })

  it('bỏ qua khi đang gõ IME, giữ lặp, có phím bổ trợ hoặc đã preventDefault', () => {
    expect(shouldIgnoreKey(ev('1', { isComposing: true }))).toBe(true)
    expect(shouldIgnoreKey(ev(' ', { repeat: true }))).toBe(true)
    expect(shouldIgnoreKey(ev('s', { ctrlKey: true }))).toBe(true)
    expect(shouldIgnoreKey(ev('s', { metaKey: true }))).toBe(true)
    expect(shouldIgnoreKey(ev('1', { altKey: true }))).toBe(true)
    expect(shouldIgnoreKey(ev('1', { defaultPrevented: true }))).toBe(true)
  })
})
