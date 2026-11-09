import { Mic, Pencil, Plus, Repeat, Square, Trash2, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { buttonClass } from '../components/buttonClass'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MistakesNote } from '../components/MistakesNote'
import { NotebookPage } from '../components/NotebookPage'
import { SpeakButton, TtsUnsupportedNote } from '../components/SpeakButton'
import { StatusMark } from '../components/StatusMark'
import { cardStatus } from '../domain/lessons'
import { LANG_TAG, LANGUAGE_LABELS, languagesInUse, lessonLanguage, ROMAN_TAG } from '../domain/language'
import type { Card } from '../domain/types'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDateVi } from '../lib/dates'
import { useTts } from '../hooks/useTts'
import { cancel as cancelTts, currentOwner, speakResult } from '../lib/tts'
import { MSG_WRITE_ERROR } from '../state/messages'
import { useData } from '../state/useData'
import { buildReadAloudSteps, plainSpeech, runReadAloud } from './lessonReadAloud'
import NotFound from './NotFound'
import './LessonView.css'

function CardMark({ card }: { card: Card | undefined }) {
  if (!card) return null
  const s = cardStatus(card)
  if (s.variant === 'mastered') return <StatusMark variant="learning">đã thuộc</StatusMark>
  return <StatusMark variant={s.variant} lapses={s.lapses} />
}

export default function LessonView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { snapshot, deleteLesson, notify } = useData()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { supported: tts, viAvailable, canSpeakLang } = useTts()
  const [readingId, setReadingId] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [resumeAt, setResumeAt] = useState<number | null>(null)
  const runRef = useRef(0)
  const ownerRef = useRef<object>({})
  const voiceName = snapshot?.settings?.voice_name ?? null

  const lesson = snapshot?.lessons.find((l) => l.id === id)
  /** (T20) Ngôn ngữ của trang: câu đích, phiên âm, giọng đọc. */
  const L = lessonLanguage(lesson)
  /** `en` giữ điều kiện cũ (Web Speech); ngôn ngữ khác cần giọng thiết bị. */
  const canSpeakTarget = tts && (L === 'en' || canSpeakLang(L))
  /** Hậu tố ngôn ngữ ở dateLine chỉ khi vở có hơn một ngôn ngữ (6.5 (9)). */
  const multiLanguage = useMemo(() => languagesInUse(snapshot?.lessons ?? []).length > 1, [snapshot?.lessons])
  const items = useMemo(
    () =>
      (snapshot?.items ?? [])
        .filter((i) => i.lesson_id === id)
        .sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? -1 : 1)),
    [snapshot?.items, id],
  )
  const enViByItem = useMemo(() => {
    const m = new Map<string, Card>()
    for (const c of snapshot?.cards ?? []) if (c.direction === 'en_vi') m.set(c.item_id, c)
    return m
  }, [snapshot?.cards])

  const stopReading = useCallback(() => {
    runRef.current++
    cancelTts(ownerRef.current)
    setReading(false)
    setReadingId(null)
    setResumeAt(null)
  }, [])

  useEffect(
    () => () => {
      runRef.current++
      cancelTts(ownerRef.current)
    },
    [],
  )

  const startReading = (from = 0) => {
    const steps = buildReadAloudSteps(items, true, L)
    if (steps.length === 0) return
    const run = ++runRef.current
    const owner = {}
    ownerRef.current = owner
    cancelTts()
    setReading(true)
    setResumeAt(null)
    void runReadAloud(steps, from, {
      isStopped: () => runRef.current !== run,
      isTakenByOther: () => {
        const cur = currentOwner()
        return cur !== null && cur !== owner
      },
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      onStep: (st) => setReadingId(st.itemId),
      speak: (st) => {
        return speakResult({ text: st.text, lang: st.lang, owner, voiceName })
      },
    }).then((out) => {
      if (runRef.current !== run) return
      setReading(false)
      setReadingId(null)
      setResumeAt(out.status === 'autoplay' ? out.index : null)
    })
  }

  usePageTitle(lesson ? `Buổi ${lesson.number}` : 'Không có trang này')

  if (!lesson) return deleting ? null : <NotFound />

  const onDelete = async () => {
    setConfirmOpen(false)
    const n = lesson.number
    setDeleting(true)
    try {
      await deleteLesson(lesson.id)
    } catch {
      setDeleting(false)
      notify(MSG_WRITE_ERROR, 'error')
      return
    }
    navigate('/lessons')
    notify(`Đã xoá buổi ${n}.`)
  }

  return (
    <article className="lesson-view">
      <h1 className="visually-hidden">
        Buổi {lesson.number}: {lesson.topic}
      </h1>

      <div className="lesson-view-actions">
        <Link to={`/review?lesson=${lesson.id}`} className={buttonClass('secondary')}>
          <Repeat size={20} strokeWidth={1.75} aria-hidden="true" />
          Ôn buổi này
        </Link>
        <Link to={`/shadowing?lesson=${lesson.id}`} className={buttonClass('secondary')}>
          <Mic size={20} strokeWidth={1.75} aria-hidden="true" />
          Shadowing
        </Link>
        {canSpeakTarget && viAvailable && items.length > 0 && (
          <Button variant="secondary" onClick={reading ? stopReading : () => startReading(resumeAt ?? 0)}>
            {reading ? (
              <Square size={20} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Volume2 size={20} strokeWidth={1.75} aria-hidden="true" />
            )}
            {reading ? 'Dừng' : resumeAt !== null ? 'Tiếp tục nghe' : 'Nghe cả trang'}
          </Button>
        )}
        <Link to={`/lessons/${lesson.id}/edit`} className={buttonClass('primary')}>
          <Pencil size={20} strokeWidth={1.75} aria-hidden="true" />
          Sửa
        </Link>
      </div>

      {!tts && items.length > 0 && <TtsUnsupportedNote />}
      {tts && !canSpeakTarget && items.length > 0 && <TtsUnsupportedNote lang={L} />}

      <NotebookPage
        dateLine={`Buổi ${lesson.number} · ${formatDateVi(lesson.date)}${multiLanguage ? ` · ${LANGUAGE_LABELS[L]}` : ''}`}
        title={lesson.topic}
        remark={null}
        className="lesson-page"
      >
        {items.length === 0 ? (
          <div className="lesson-page-empty">
            <p className="lesson-page-muted">Chưa có mục nào.</p>
            <Link to={`/lessons/${lesson.id}/edit`} className={buttonClass('ghost')}>
              <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
              Thêm mục
            </Link>
          </div>
        ) : (
          <ol className="lesson-entries">
            {items.map((item) => {
              const card = enViByItem.get(item.id)
              const hasMeta = Boolean(item.ipa || item.note || card)
              return (
                <li
                  key={item.id}
                  className="entry lesson-entry"
                  aria-current={readingId === item.id ? 'true' : undefined}
                >
                  <div className="lesson-entry-main">
                    <p className="lesson-entry-text">
                      <span className="en" lang={LANG_TAG[L]}>
                        <span className={readingId === item.id ? 'is-reading' : undefined}>{item.en}</span>
                      </span>
                      <span className="vi">
                        <span className={readingId === item.id ? 'is-reading' : undefined}>{item.vi}</span>
                      </span>
                    </p>
                    <SpeakButton lang={L} text={item.en} label={`Nghe: ${item.en}`} />
                  </div>
                  {hasMeta && (
                    <p className="lesson-entry-meta">
                      {item.ipa && <span lang={ROMAN_TAG[L]}>{item.ipa}</span>}
                      {item.note && <span>{item.note}</span>}
                      {card && <CardMark card={card} />}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </NotebookPage>

      {(lesson.questions.trim() || lesson.mistakes.trim() || lesson.notes.trim()) && (
        <div className="lesson-extras">
          {lesson.questions.trim() && (
            <section className="lesson-block">
              <div className="lesson-block-head">
                <h2 className="lesson-block-label">Hỏi giáo viên</h2>
                <SpeakButton lang="vi" text={plainSpeech(lesson.questions)} label="Nghe phần hỏi giáo viên" />
              </div>
              <p className="lesson-block-text">{lesson.questions}</p>
            </section>
          )}
          {lesson.mistakes.trim() && (
            <section className="lesson-block">
              <div className="lesson-block-head">
                <MistakesNote text={lesson.mistakes} className="lesson-block-text lesson-mistakes" />
                <SpeakButton lang="vi" text={plainSpeech(lesson.mistakes)} label="Nghe lỗi hay gặp" />
              </div>
            </section>
          )}
          {lesson.notes.trim() && (
            <section className="lesson-block">
              <h2 className="lesson-block-label">Ghi chú</h2>
              <p className="lesson-block-text">{lesson.notes}</p>
            </section>
          )}
        </div>
      )}

      <div className="lesson-view-danger">
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
          Xoá buổi học
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Xoá buổi ${lesson.number}?`}
        description={`Buổi học, ${items.length} mục và toàn bộ thẻ ôn của chúng sẽ bị xoá. Không hoàn tác được.`}
        confirmLabel="Xoá buổi học"
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </article>
  )
}
