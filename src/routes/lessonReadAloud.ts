import type { Language } from '../domain/types'
import type { TtsLang } from '../lib/tts'

export interface ReadAloudStep {
  itemId: string
  lang: TtsLang
  text: string
}

/** Bỏ dấu `*` (cú pháp `*từ*`), gộp khoảng trắng nhưng giữ xuống dòng (lib tự chia đoạn). */
export function plainSpeech(s: string): string {
  return s
    .replace(/\*/g, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Chuỗi đọc "cả trang": từng mục theo thứ tự, câu đích rồi VI. Bỏ chuỗi trống;
 * `includeVi` false → chỉ câu đích. (T20) Bước câu đích đọc bằng `language` của buổi.
 */
export function buildReadAloudSteps(
  items: ReadonlyArray<{ id: string; en: string; vi: string }>,
  includeVi: boolean,
  language: Language = 'en',
): ReadAloudStep[] {
  const steps: ReadAloudStep[] = []
  for (const it of items) {
    const en = plainSpeech(it.en)
    if (en) steps.push({ itemId: it.id, lang: language, text: en })
    if (includeVi) {
      const vi = plainSpeech(it.vi)
      if (vi) steps.push({ itemId: it.id, lang: 'vi', text: vi })
    }
  }
  return steps
}

export type ReadAloudOutcome =
  | { status: 'done' }
  | { status: 'stopped' }
  | { status: 'interrupted' }
  | { status: 'autoplay'; index: number }
  | { status: 'error' }

export interface ReadAloudDeps {
  speak: (step: ReadAloudStep) => Promise<{ interrupted: boolean }>
  /** true khi người dùng bấm Dừng / rời trang. */
  isStopped: () => boolean
  /** true khi một nguồn phát khác (loa từng mục...) đang giữ lượt: không chiếm lại. */
  isTakenByOther: () => boolean
  wait: (ms: number) => Promise<void>
  onStep?: (step: ReadAloudStep, index: number) => void
}

export const PAUSE_SAME_ITEM_MS = 400
export const PAUSE_NEXT_ITEM_MS = 600

/** Chạy chuỗi từ bước `from`. `autoplay` trả về chỉ số bước dở để "Tiếp tục nghe". */
export async function runReadAloud(
  steps: readonly ReadAloudStep[],
  from: number,
  deps: ReadAloudDeps,
): Promise<ReadAloudOutcome> {
  for (let i = from; i < steps.length; i++) {
    if (deps.isStopped()) return { status: 'stopped' }
    if (i > from && deps.isTakenByOther()) return { status: 'interrupted' }
    const st = steps[i]
    deps.onStep?.(st, i)
    let result: { interrupted: boolean }
    try {
      result = await deps.speak(st)
    } catch (e) {
      if (deps.isStopped()) return { status: 'stopped' }
      return (e as { kind?: string })?.kind === 'autoplay' ? { status: 'autoplay', index: i } : { status: 'error' }
    }
    if (deps.isStopped()) return { status: 'stopped' }
    if (result.interrupted) return { status: 'interrupted' }
    const next = steps[i + 1]
    if (next) {
      await deps.wait(next.itemId === st.itemId ? PAUSE_SAME_ITEM_MS : PAUSE_NEXT_ITEM_MS)
    }
  }
  return { status: 'done' }
}
