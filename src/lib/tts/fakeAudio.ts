import { vi } from 'vitest'

/** `<audio>` giả (gỡ bằng vi.unstubAllGlobals + vi.restoreAllMocks). cho test (chỉ dùng trong test). */
export class FakeAudio {
  static instances: FakeAudio[] = []
  static playImpl: () => Promise<void> = () => Promise.resolve()
  src = ''
  preload = ''
  playbackRate = 1
  defaultPlaybackRate = 1
  webkitPreservesPitch = false
  onloadedmetadata: (() => void) | null = null
  preservesPitch = false
  playsInline = false
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  play = vi.fn(() => FakeAudio.playImpl())
  pause = vi.fn()
  setAttribute = vi.fn()
  constructor() {
    FakeAudio.instances.push(this)
  }
}

export function stubAudio() {
  FakeAudio.instances = []
  FakeAudio.playImpl = () => Promise.resolve()
  let n = 0
  vi.stubGlobal('Audio', FakeAudio)
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:fake/${++n}`)
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return { createObjectURL, revokeObjectURL }
}
