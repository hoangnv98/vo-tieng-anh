import { describe, expect, it } from 'vitest'
import {
  PASSWORD_ERROR_TEXT,
  PASSWORD_MAX,
  PASSWORD_MIN,
  isValidEmail,
  validateNewPassword,
  validatePasswordLogin,
} from './password'

describe('(T21) validateNewPassword', () => {
  it('7 ký tự → too_short; 8 → hợp lệ', () => {
    expect(validateNewPassword('abcdefg', 'abcdefg')).toEqual({ password: 'too_short' })
    expect(validateNewPassword('abcdefgh', 'abcdefgh')).toBeNull()
  })

  it('72 hợp lệ; 73 → too_long', () => {
    const p72 = 'a'.repeat(PASSWORD_MAX)
    const p73 = 'a'.repeat(PASSWORD_MAX + 1)
    expect(validateNewPassword(p72, p72)).toBeNull()
    expect(validateNewPassword(p73, p73)).toEqual({ password: 'too_long' })
  })

  it('không khớp → mismatch chỉ ở confirm', () => {
    expect(validateNewPassword('abcdefgh', 'abcdefgi')).toEqual({ confirm: 'mismatch' })
    expect(validateNewPassword('abc', 'xyz')).toEqual({ password: 'too_short', confirm: 'mismatch' })
  })

  it('không trim khoảng trắng đầu/cuối', () => {
    expect(' abcdefg'.length).toBe(PASSWORD_MIN)
    expect(validateNewPassword(' abcdefg', ' abcdefg')).toBeNull()
    expect(validateNewPassword('abcdefgh', 'abcdefgh ')).toEqual({ confirm: 'mismatch' })
    expect(validateNewPassword('       ', '       ')).toEqual({ password: 'too_short' })
  })

  it('không yêu cầu loại ký tự', () => {
    expect(validateNewPassword('cụm từ dễ nhớ', 'cụm từ dễ nhớ')).toBeNull()
  })
})

describe('(T21) validatePasswordLogin', () => {
  it('email sai → invalid', () => {
    expect(validatePasswordLogin('lan@vidu', 'x')).toEqual({ email: 'invalid' })
    expect(validatePasswordLogin('', 'x')).toEqual({ email: 'invalid' })
  })

  it('mật khẩu rỗng → required', () => {
    expect(validatePasswordLogin('lan@vidu.com', '')).toEqual({ password: 'required' })
  })

  it('cả hai lỗi → cả hai khoá', () => {
    expect(validatePasswordLogin('sai', '')).toEqual({ email: 'invalid', password: 'required' })
  })

  it('hợp lệ → null; không kiểm tra độ dài mật khẩu', () => {
    expect(validatePasswordLogin('lan@vidu.com', 'p')).toBeNull()
    expect(validatePasswordLogin('lan@vidu.com', ' ')).toBeNull()
  })

  it('email quá 254 ký tự → invalid', () => {
    const long = `${'a'.repeat(250)}@vidu.com`
    expect(isValidEmail(long)).toBe(false)
    expect(validatePasswordLogin(long, 'p')).toEqual({ email: 'invalid' })
  })
})

describe('(T21) PASSWORD_ERROR_TEXT', () => {
  it('đúng microcopy', () => {
    expect(PASSWORD_ERROR_TEXT).toEqual({
      too_short: 'Mật khẩu cần ít nhất 8 ký tự.',
      too_long: 'Mật khẩu tối đa 72 ký tự.',
      mismatch: 'Hai mật khẩu chưa giống nhau.',
      invalid: 'Email chưa đúng. Kiểm tra lại giúp mình nhé.',
      required: 'Nhập mật khẩu.',
    })
  })
})
