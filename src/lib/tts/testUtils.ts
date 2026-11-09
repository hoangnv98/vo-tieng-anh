import { vi } from 'vitest'

/** Chỉ dùng trong test. */
export function fakeSink() {
  return {
    isSupported: () => true,
    prime: vi.fn<() => void>(),
    play: vi.fn<(blob: Blob, rate: number) => Promise<void>>(() => Promise.resolve()),
    stop: vi.fn<() => void>(),
  }
}

export function wav(): Response {
  return new Response(new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/wav' } })
}

export function status(code: number): Response {
  return new Response('x', { status: code })
}

export function json(body: unknown, code = 200): Response {
  return new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } })
}

/** fetch treo cho tới khi bị abort. */
export function hanging(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
}
