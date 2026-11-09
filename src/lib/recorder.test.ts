import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyRecorderError, formatClock, isRecorderSupported, pickMimeType } from './recorder'

function fakeRecorder(supported: string[]) {
  return { isTypeSupported: vi.fn((t: string) => supported.includes(t)) }
}

describe('pickMimeType', () => {
  it('ưu tiên audio/webm;codecs=opus', () => {
    expect(pickMimeType(fakeRecorder(['audio/mp4', 'audio/webm', 'audio/webm;codecs=opus']))).toBe(
      'audio/webm;codecs=opus',
    )
  })
  it('không có opus → audio/webm', () => {
    expect(pickMimeType(fakeRecorder(['audio/webm', 'audio/mp4']))).toBe('audio/webm')
  })
  it('Safari → audio/mp4', () => {
    expect(pickMimeType(fakeRecorder(['audio/mp4']))).toBe('audio/mp4')
  })
  it('không MIME nào / không có isTypeSupported / không có MediaRecorder → undefined', () => {
    expect(pickMimeType(fakeRecorder([]))).toBeUndefined()
    expect(pickMimeType({})).toBeUndefined()
    expect(pickMimeType(null)).toBeUndefined()
  })
  it('isTypeSupported ném lỗi → bỏ qua MIME đó', () => {
    const MR = {
      isTypeSupported: (t: string) => {
        if (t.includes('webm')) throw new Error('boom')
        return true
      },
    }
    expect(pickMimeType(MR)).toBe('audio/mp4')
  })
})

describe('isRecorderSupported', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('không có window (node) → false', () => {
    expect(isRecorderSupported()).toBe(false)
  })
  it('có MediaRecorder và getUserMedia → true; thiếu một trong hai → false', () => {
    vi.stubGlobal('window', { MediaRecorder: function MediaRecorder() {} })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.resolve() } })
    expect(isRecorderSupported()).toBe(true)
    vi.stubGlobal('window', { MediaRecorder: undefined })
    expect(isRecorderSupported()).toBe(false)
    vi.stubGlobal('window', { MediaRecorder: function MediaRecorder() {} })
    vi.stubGlobal('navigator', {})
    expect(isRecorderSupported()).toBe(false)
  })
})

describe('classifyRecorderError', () => {
  it('phân loại theo name', () => {
    expect(classifyRecorderError({ name: 'NotAllowedError' })).toBe('denied')
    expect(classifyRecorderError({ name: 'SecurityError' })).toBe('denied')
    expect(classifyRecorderError({ name: 'NotFoundError' })).toBe('notfound')
    expect(classifyRecorderError({ name: 'NotReadableError' })).toBe('other')
    expect(classifyRecorderError(null)).toBe('other')
  })
})

describe('formatClock', () => {
  it('m:ss', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(7.9)).toBe('0:07')
    expect(formatClock(15)).toBe('0:15')
    expect(formatClock(75)).toBe('1:15')
  })
})
