import { ArrowLeft, Check, Mic, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import '../components/Button.css'
import { Button } from '../components/Button'
import { buttonClass } from '../components/buttonClass'
import { NotebookPage } from '../components/NotebookPage'
import { PageTitle } from '../components/PageTitle'
import { SpeakButton, TtsUnsupportedNote } from '../components/SpeakButton'
import { fillPattern, findSituation, splitPattern, blankPattern, type Pattern } from '../data/patterns'
import type { Item } from '../domain/types'
import { usePageTitle } from '../hooks/usePageTitle'
import { isTtsSupported } from '../lib/speech'
import { newId } from '../lib/ids'
import { MSG_WRITE_ERROR } from '../state/messages'
import { useData } from '../state/useData'
import { plainSpeech } from './lessonReadAloud'
import NotFound from './NotFound'
import './PatternSituation.css'

/** Ngoài component để lint purity không báo; gọi trong event handler. */
function nowIso(): string {
  return new Date().toISOString()
}

export default function PatternSituation() {
  const { situationId = '' } = useParams()
  const situation = findSituation(situationId)
  usePageTitle(situation ? situation.nameVi : 'Không có trang này')
  if (!situation) return <NotFound />
  return <SituationView key={situation.id} situationId={situation.id} />
}

function SituationView({ situationId }: { situationId: string }) {
  const situation = findSituation(situationId)!
  const { snapshot, addPatternItems, notify } = useData()
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const focusTarget = useRef<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(() => new Set())
  const ttsOk = isTtsSupported()

  const added = useMemo(() => {
    const s = new Set<string>()
    for (const i of snapshot?.items ?? []) if (i.pattern_id) s.add(i.pattern_id)
    return s
  }, [snapshot?.items])

  useEffect(() => {
    const t = focusTarget.current
    if (!t) return
    const el = document.getElementById(t === 'all' ? 'pattern-all-done' : `pattern-added-${t}`)
    focusTarget.current = null
    el?.focus()
  }, [added])

  const missing = situation.patterns.filter((p) => !added.has(p.id))
  const k = missing.length

  function toItem(p: Pattern, now: string): Item {
    const filled = fillPattern(p, 0)
    return {
      id: newId(),
      user_id: '',
      lesson_id: null,
      kind: 'pattern',
      en: filled.en,
      vi: filled.vi,
      ipa: p.ipa,
      note: p.note ?? '',
      pattern_id: p.id,
      position: situation.patterns.indexOf(p),
      created_at: now,
      updated_at: now,
    }
  }

  function add(list: Pattern[]) {
    if (list.length === 0 || busy.size > 0) return
    const ids = list.map((p) => p.id)
    setBusy((prev) => new Set([...prev, ...ids]))
    const now = nowIso()
    focusTarget.current = list.length === 1 ? list[0].id : 'all'
    addPatternItems(list.map((p) => toItem(p, now)))
      .then(
        (n) => {
          if (n === 0 || (n < list.length && list.length > 1)) focusTarget.current = null
          if (n > 0) notify(n === 1 ? 'Đã thêm vào thẻ ôn.' : `Đã thêm ${n} mẫu câu vào thẻ ôn.`)
        },
        () => {
          focusTarget.current = null
          notify(MSG_WRITE_ERROR, 'error')
        },
      )
      .finally(() =>
        setBusy((prev) => {
          const next = new Set(prev)
          for (const id of ids) next.delete(id)
          return next
        }),
      )
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="pattern-situation" aria-labelledby="situation-title">
      <Link to="/patterns" className={buttonClass('ghost', 'md', 'pattern-back')}>
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        Mẫu câu
      </Link>
      <header className="pattern-situation-head">
        <div className="pattern-situation-title">
          <PageTitle id="situation-title">{situation.nameVi}</PageTitle>
          <span className="pattern-situation-en" lang="en">
            {situation.nameEn}
          </span>
        </div>
        <p className="pattern-intro">{situation.intro}</p>
        <div className="pattern-pron-row">
          <p className="pattern-intro">
            <span className="pron-label">Lưu ý phát âm:</span> {situation.pronunciationFocus}
          </p>
          <SpeakButton lang="vi" text={plainSpeech(situation.pronunciationFocus)} label="Nghe lưu ý phát âm" />
        </div>
        {!ttsOk && <TtsUnsupportedNote />}
        {k > 0 ? (
          <Button variant="secondary" className="pattern-add-all" aria-disabled={busy.size > 0} onClick={() => add(missing)}>
            <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
            Thêm cả tình huống ({k} câu)
          </Button>
        ) : (
          <p className="pattern-all-done" id="pattern-all-done" tabIndex={-1}>Đã thêm cả tình huống.</p>
        )}
      </header>

      <NotebookPage>
        <ul className="pattern-blocks">
          {situation.patterns.map((p) => {
            const isAdded = added.has(p.id)
            const slots = p.slots ?? []
            const openSlots = slots.filter((s) => open.has(`${p.id}:${s.key}`))
            return (
              <li key={p.id} className="pattern-block entry">
                <span hidden lang="en" id={`pattern-say-${p.id}`}>
                  {fillPattern(p, 0).en}
                </span>
                <div className="pattern-line">
                  <p className="pattern-text">
                    <span className="en" id={`pattern-en-${p.id}`} lang="en">
                      {splitPattern(p.en).map((part, i) => {
                        if (part.type === 'text') return <span key={i}>{part.value}</span>
                        const slot = slots.find((s) => s.key === part.key)
                        const id = `${p.id}:${part.key}`
                        return (
                          <button
                            key={i}
                            type="button"
                            lang="vi"
                            className="pattern-slot"
                            aria-label={`Gợi ý cho ô trống ${slot?.hint ?? ''}`}
                            aria-expanded={open.has(id)}
                            aria-controls={open.has(id) ? `hint-${p.id}-${part.key}` : undefined}
                            onClick={() => toggle(id)}
                          />
                        )
                      })}
                    </span>
                    <span className="vi">{blankPattern(p.vi)}</span>
                  </p>
                  <div className="pattern-actions">
                    <SpeakButton text={fillPattern(p, 0).en} label={`Nghe: ${fillPattern(p, 0).en}`} />
                    {isAdded ? (
                      <span
                        className="pattern-added"
                        id={`pattern-added-${p.id}`}
                        tabIndex={-1}
                        role="img"
                        aria-label="Đã thêm"
                        title="Đã thêm vào thẻ ôn"
                      >
                        <Check size={20} strokeWidth={1.75} aria-hidden="true" />
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        className="pattern-add"
                        aria-label="Thêm vào thẻ ôn"
                        title="Thêm vào thẻ ôn"
                        aria-disabled={busy.has(p.id)}
                        aria-describedby={`pattern-say-${p.id}`}
                        onClick={() => add([p])}
                      >
                        <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    )}
                    <Link
                      to={`/shadowing?pattern=${p.id}`}
                      className={buttonClass('ghost', 'md', 'pattern-shadow')}
                      aria-label="Luyện shadowing"
                      title="Luyện shadowing"
                      aria-describedby={`pattern-say-${p.id}`}
                    >
                      <Mic size={20} strokeWidth={1.75} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
                {openSlots.map((s) => (
                  <p key={s.key} id={`hint-${p.id}-${s.key}`} className="pattern-hint">
                    {s.hint}:{' '}
                    {s.examples.map((ex, i) => (
                      <span key={i}>
                        {i > 0 && ' · '}
                        <span lang="en">{ex.en}</span> — {ex.vi}
                      </span>
                    ))}
                  </p>
                ))}
                <p className="pattern-meta">
                  <span lang="en">{p.ipa}</span> · {p.level}
                  {p.note && (
                    <>
                      {' · '}
                      <span className="pron-label">Lưu ý phát âm:</span> <span className="pattern-note">{p.note}</span>
                    </>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      </NotebookPage>
    </section>
  )
}
