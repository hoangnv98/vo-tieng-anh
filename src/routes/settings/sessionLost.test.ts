import { describe, expect, it, vi } from 'vitest'
import { leaveLostSession } from './sessionLost'

describe('(T21) leaveLostSession', () => {
  it('đăng xuất xong mới điều hướng', async () => {
    const order: string[] = []
    await leaveLostSession(
      async () => {
        order.push('signOut')
      },
      () => order.push('go'),
    )
    expect(order).toEqual(['signOut', 'go'])
  })

  it('signOut lỗi vẫn điều hướng, không ném', async () => {
    const go = vi.fn()
    await expect(leaveLostSession(() => Promise.reject(new Error('403')), go)).resolves.toBeUndefined()
    expect(go).toHaveBeenCalledTimes(1)
  })
})
