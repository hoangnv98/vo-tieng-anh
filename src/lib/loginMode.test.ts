import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../repo/memoryStorage.test-util'
import { LOGIN_MODE_KEY, readLoginMode, writeLoginMode } from './loginMode'

describe('(T21) loginMode', () => {
  it('storage rỗng → link', () => {
    expect(readLoginMode(new MemoryStorage())).toBe('link')
  })

  it('giá trị lạ → link', () => {
    const s = new MemoryStorage()
    s.setItem(LOGIN_MODE_KEY, 'x')
    expect(readLoginMode(s)).toBe('link')
  })

  it('write rồi read', () => {
    const s = new MemoryStorage()
    writeLoginMode('password', s)
    expect(s.getItem(LOGIN_MODE_KEY)).toBe('password')
    expect(readLoginMode(s)).toBe('password')
    writeLoginMode('link', s)
    expect(readLoginMode(s)).toBe('link')
  })

  it('setItem ném → write không ném', () => {
    const s = new MemoryStorage()
    s.failWith = new DOMException('quota', 'QuotaExceededError')
    expect(() => writeLoginMode('password', s)).not.toThrow()
    expect(readLoginMode(s)).toBe('link')
  })

  it('getItem ném → link', () => {
    const s = new MemoryStorage()
    s.getItem = () => {
      throw new Error('denied')
    }
    expect(readLoginMode(s)).toBe('link')
  })

  it('storage null → read link, write không ném', () => {
    expect(readLoginMode(null)).toBe('link')
    expect(() => writeLoginMode('password', null)).not.toThrow()
  })

  it('khoá có tiền tố vta:v1: (bị xoá cùng dữ liệu cục bộ)', () => {
    expect(LOGIN_MODE_KEY.startsWith('vta:v1:')).toBe(true)
  })
})
