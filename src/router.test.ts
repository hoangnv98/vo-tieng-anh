import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { safeNext } from './router'

beforeAll(() => {
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
})
afterAll(() => {
  vi.unstubAllGlobals()
})

describe('safeNext', () => {
  it.each([
    ['//x', '/'],
    ['/\\x', '/'],
    ['/\t/x', '/'],
    ['https://x', '/'],
    [null, '/'],
    ['', '/'],
  ])('%j → về "/"', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })

  it('giữ đường dẫn nội bộ kèm query', () => {
    expect(safeNext('/lessons?a=1')).toBe('/lessons?a=1')
  })
})
