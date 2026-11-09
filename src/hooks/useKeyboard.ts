import { useEffect, useRef } from 'react'

/** Tên phím chuẩn hoá: ' ' → 'Space', chữ cái → chữ thường, còn lại giữ `e.key` ('Enter', 'Escape', '1'…). */
export function keyName(e: Pick<KeyboardEvent, 'key'>): string {
  if (e.key === ' ' || e.key === 'Spacebar') return 'Space'
  return e.key.length === 1 ? e.key.toLowerCase() : e.key
}

const TYPING_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], dialog'
const ACTIVATABLE_SELECTOR = 'button, a[href], summary, [role="button"], [role="link"]'

/**
 * Bỏ qua phím tắt khi: có phím bổ trợ, phím giữ lặp, focus trong ô nhập/dialog;
 * Space/Enter trên nút/link để trình duyệt tự kích hoạt (tránh chạy 2 lần).
 */
export type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'defaultPrevented' | 'isComposing' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey'
> & { target: EventTarget | null }

function asElement(t: EventTarget | null): Pick<Element, 'closest'> | null {
  return t !== null && typeof (t as Partial<Element>).closest === 'function' ? (t as Element) : null
}

export function shouldIgnoreKey(e: KeyEventLike): boolean {
  if (e.defaultPrevented || e.isComposing || e.repeat) return true
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  const target = asElement(e.target)
  if (!target) return false
  if (target.closest(TYPING_SELECTOR)) return true
  const name = keyName(e)
  return (name === 'Space' || name === 'Enter') && target.closest(ACTIVATABLE_SELECTOR) !== null
}

export type KeyBindings = Partial<Record<string, () => void>>

/**
 * Phím tắt toàn trang (6.7): `bindings` theo `keyName` (vd. `{ Space, Enter, '1', s, Escape }`).
 * Phím có binding được `preventDefault()` (Space không cuộn trang). `enabled=false` tạm tắt.
 */
export function useKeyboard(bindings: KeyBindings, enabled = true): void {
  const ref = useRef(bindings)
  useEffect(() => {
    ref.current = bindings
  })

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKey(e)) return
      const fn = ref.current[keyName(e)]
      if (!fn) return
      e.preventDefault()
      fn()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
