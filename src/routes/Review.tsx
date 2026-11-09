import { CircleAlert, Volume2 } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { buttonClass, type ButtonVariant } from '../components/buttonClass'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import '../components/NotebookPage.css'
import { PageTitle } from '../components/PageTitle'
import { useHideBottomBar } from '../components/shellContext'
import { SpeakButton, TtsUnsupportedNote } from '../components/SpeakButton'
import { Spinner } from '../components/Spinner'
import { findSituation, situationOfPattern } from '../data/patterns'
import { sortLessons } from '../domain/lessons'
import { buildQueue, hiddenListenCount } from '../domain/review'
import { streak } from '../domain/stats'
import {
  DIRECTION_LABELS,
  GRADE_LABELS,
  GRADES,
  type Card,
  type Grade,
  type Item,
  type Lesson,
  type Snapshot,
} from '../domain/types'
import { useKeyboard, type KeyBindings } from '../hooks/useKeyboard'
import { usePageTitle } from '../hooks/usePageTitle'
import { useTts } from '../hooks/useTts'
import { localDay } from '../lib/dates'
import { getScheduler, previewIntervals } from '../lib/fsrs'
import { compareAnswer } from '../lib/text'
import { MSG_WRITE_ERROR } from '../state/messages'
import { useData } from '../state/useData'
import {
  applyGrade,
  clampDuration,
  currentCardId,
  isFinished,
  progress,
  sessionDurationLabel,
  skipCurrent,
  skipMissing,
  startSession,
  timesShown,
  type ReviewSession,
} from './reviewSession'
import './Review.css'

type Tts = ReturnType<typeof useTts>
type Answer = ReturnType<typeof compareAnswer>

const GRADE_VARIANT: Record<Grade, ButtonVariant> = {
  1: 'danger',
  2: 'secondary',
  3: 'primary',
  4: 'secondary',
}

/** Dấu bút hiện trên thẻ trước khi sang thẻ kế (khoảnh khắc chuyển động duy nhất của app). */
const MARK_MS = 350
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const SCHEDULER_ERROR = 'Không khởi tạo được bộ lập lịch. Tải lại trang.'

/** Phiên mới mỗi khi đổi `?lesson` (vd. từ trạng thái rỗng bấm "Ôn buổi gần nhất"). */
export default function Review() {
  const [params] = useSearchParams()
  const lessonId = params.get('lesson') || undefined
  return <ReviewScreen key={lessonId ?? ''} lessonId={lessonId} />
}

function ReviewScreen({ lessonId }: { lessonId?: string }) {
  const { snapshot } = useData()
  const lesson = lessonId ? snapshot?.lessons.find((l) => l.id === lessonId) : undefined
  usePageTitle(lesson ? `Ôn buổi ${lesson.number}` : 'Ôn thẻ')

  // Shell chỉ render route khi dữ liệu đã `ready`; nhánh này chỉ để thu hẹp kiểu.
  if (!snapshot) {
    return (
      <div className="review">
        <Spinner label="Đang xếp thẻ…" />
      </div>
    )
  }
  return <ReviewRun snapshot={snapshot} lessonId={lessonId} lesson={lesson} />
}

function ReviewRun({ snapshot, lessonId, lesson }: { snapshot: Snapshot; lessonId?: string; lesson?: Lesson }) {
  const { gradeCard, notify } = useData()
  const tts = useTts()
  const navigate = useNavigate()

  // Hàng đợi tính một lần khi vào phiên để thẻ không nhảy khi snapshot đổi.
  const [start] = useState(() => {
    const now = new Date()
    const { cards, items, settings } = snapshot
    const queue = buildQueue(cards, items, settings, now, { lessonId, ttsSupported: tts.supported })
    const hidden = tts.supported
      ? 0
      : lessonId === undefined
        ? hiddenListenCount(cards, items, settings, now)
        : buildQueue(cards, items, settings, now, { lessonId, ttsSupported: true }).filter(
            (c) => c.direction === 'listen',
          ).length
    return { ids: queue.map((c) => c.id), hidden }
  })
  const [rawSession, setSession] = useState<ReviewSession>(() => startSession(start.ids))
  const [scheduler, setScheduler] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const unlockToastShown = useRef(false)

  useEffect(() => {
    let alive = true
    getScheduler().then(
      () => alive && setScheduler('ready'),
      () => alive && setScheduler('error'),
    )
    return () => {
      alive = false
    }
  }, [])

  const cardById = useMemo(() => new Map(snapshot.cards.map((c) => [c.id, c])), [snapshot.cards])
  const itemById = useMemo(() => new Map(snapshot.items.map((i) => [i.id, i])), [snapshot.items])

  // Thẻ/mục bị xoá ở nơi khác giữa phiên → bỏ qua (suy ra khi render, không cần effect).
  const exists = (id: string) => {
    const c = cardById.get(id)
    return c !== undefined && itemById.has(c.item_id)
  }
  const session = skipMissing(rawSession, exists)
  const currentId = currentCardId(session)
  const card = currentId ? cardById.get(currentId) : undefined
  const item = card ? itemById.get(card.item_id) : undefined
  const finished = isFinished(session)
  const running = session.queue.length > 0 && !finished && scheduler !== 'error'

  useHideBottomBar(running)

  async function grade(g: Grade, durationMs: number) {
    if (savingRef.current || !card || !item) return
    savingRef.current = true
    setSaving(true)
    const shown = timesShown(session)
    try {
      // Ghi ngay; chỉ chuyển thẻ khi dấu bút đã hiện xong (≤ 350ms, không chặn quá 400ms).
      const [{ requeue, unlocked }] = await Promise.all([
        gradeCard(card.id, g, clampDuration(durationMs), shown),
        wait(MARK_MS),
      ])
      setSession(() => applyGrade(session, { grade: g, requeue, durationMs }))
      if (unlocked > 0 && !unlockToastShown.current) {
        unlockToastShown.current = true
        notify(`Đã mở thêm ${unlocked} chiều ôn cho thẻ này.`)
      }
    } catch {
      const schedulerOk = await getScheduler().then(
        () => true,
        () => false,
      )
      if (schedulerOk) {
        notify(MSG_WRITE_ERROR, 'error')
        setSession(() => skipCurrent(session))
      } else {
        setScheduler('error')
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const title = lesson ? `Ôn buổi ${lesson.number}` : 'Ôn thẻ'
  const { i, n } = progress(session)
  const showHiddenNote = start.hidden > 0 && !finished

  let content
  if (scheduler === 'error') {
    content = (
      <section className="card review-card review-card--center">
        <p className="review-error" role="alert">
          <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>{SCHEDULER_ERROR}</span>
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Tải lại trang
        </Button>
      </section>
    )
  } else if (session.queue.length === 0 || (finished && session.reviewed.length === 0)) {
    content = (
      <section className="card review-card review-card--center">
        <ReviewEmpty snapshot={snapshot} lessonId={lessonId} />
      </section>
    )
  } else if (finished) {
    content = <ReviewSummary snapshot={snapshot} session={session} />
  } else {
    content = (
      <section className="card ruled-paper review-card review-paper" aria-label="Thẻ ôn">
        <div className="review-meta">
          <p aria-live="polite" aria-atomic="true">
            Thẻ {i}/{n}
            {card && ` · ${DIRECTION_LABELS[card.direction]}`}
          </p>
          <Link to="/" className={buttonClass('ghost')}>
            Dừng
          </Link>
        </div>
        {scheduler === 'loading' || !card || !item ? (
          <div className="review-loading">
            <Spinner label="Đang xếp thẻ…" />
          </div>
        ) : (
          <CardView
            key={session.index}
            card={card}
            item={item}
            snapshot={snapshot}
            tts={tts}
            autoSpeak={snapshot.settings.auto_speak === true}
            saving={saving}
            onGrade={grade}
            onStop={() => navigate('/')}
          />
        )}
      </section>
    )
  }

  return (
    <div className="review">
      <PageTitle>{title}</PageTitle>
      {showHiddenNote && (
        <TtsUnsupportedNote>
          Đã tạm ẩn {start.hidden} thẻ nghe vì trình duyệt không hỗ trợ đọc. Thử Chrome hoặc Edge.
        </TtsUnsupportedNote>
      )}
      {content}
    </div>
  )
}

function Speak({ text, tts }: { text: string; tts: Tts }) {
  if (!tts.supported) return <p className="review-mute">Trình duyệt này không đọc được.</p>
  return <SpeakButton text={text} />
}

function sourceOf(item: Item, snapshot: Snapshot) {
  if (item.lesson_id) {
    const lesson = snapshot.lessons.find((l) => l.id === item.lesson_id)
    if (lesson) {
      return (
        <Link to={`/lessons/${lesson.id}`} className="review-source-link">
          Buổi {lesson.number} · {lesson.topic}
        </Link>
      )
    }
  }
  if (item.pattern_id) {
    const situationId = situationOfPattern(item.pattern_id)
    const situation = situationId ? findSituation(situationId) : undefined
    if (situation) return <>Mẫu câu · {situation.nameVi}</>
  }
  return null
}

interface CardViewProps {
  card: Card
  item: Item
  snapshot: Snapshot
  tts: Tts
  autoSpeak: boolean
  saving: boolean
  onGrade(g: Grade, durationMs: number): void
  onStop(): void
}

/** Một lần hiện thẻ; remount theo `session.index` nên state (lật, câu gõ, preview) tự reset. */
function CardView({ card, item, snapshot, tts, autoSpeak, saving, onGrade, onStop }: CardViewProps) {
  const uid = useId()
  const [shownAt] = useState(() => Date.now())
  // Bản thẻ lúc hiện mặt trước: snapshot đổi ngay sau khi chấm, không tính lại preview cho trạng thái mới.
  const [frontCard] = useState(card)
  const [flipped, setFlipped] = useState(false)
  const [typed, setTyped] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [played, setPlayed] = useState(false)
  const [mark, setMark] = useState<Grade | null>(null)
  /** `undefined` = đang tải ("…"), `null` = lỗi (ẩn chú thích). */
  const [preview, setPreview] = useState<Record<Grade, string> | null | undefined>(undefined)
  const bodyRef = useRef<HTMLDivElement>(null)
  const listen = card.direction === 'listen'
  const formId = `${uid}-listen`

  // Focus vào vùng thẻ khi hiện thẻ và khi lật (kể cả listen: nghe trước, rồi mới Tab/chạm vào ô gõ
  // — tránh bật bàn phím ảo trước khi nghe).
  useEffect(() => {
    bodyRef.current?.focus({ preventScroll: true })
  }, [flipped])

  // Dự báo khoảng cách tải khi lật (async); "…" trong lúc chờ.
  useEffect(() => {
    if (!flipped) return
    let alive = true
    previewIntervals(frontCard, new Date()).then(
      (p) => alive && setPreview(p),
      () => alive && setPreview(null),
    )
    return () => {
      alive = false
    }
  }, [flipped, frontCard])

  function say() {
    if (tts.supported) tts.speak(item.en).catch(() => {})
  }

  function flip() {
    if (flipped) return
    if (listen) {
      setAnswer(compareAnswer(typed, item.en))
    } else if (autoSpeak) {
      // Gọi đồng bộ trong handler để còn trong user gesture (iOS).
      say()
    }
    setFlipped(true)
  }

  function play() {
    say()
    setPlayed(true)
  }

  function onCheck(e: FormEvent) {
    e.preventDefault()
    flip()
  }

  function choose(g: Grade) {
    if (!flipped || saving || mark !== null) return
    setMark(g)
    onGrade(g, Date.now() - shownAt)
  }

  // Câu EN nằm trên dòng kẻ chính: dời lưới của thẻ (--rule-y) theo baseline đo được.
  useLayoutEffect(() => {
    const body = bodyRef.current
    const paper = body?.closest<HTMLElement>('.review-paper')
    if (!body || !paper) return
    const align = () => {
      const probe = body.querySelector<HTMLElement>('.review-baseline')
      if (!probe) {
        paper.style.removeProperty('--rule-y')
        return
      }
      const top = paper.getBoundingClientRect().top + paper.clientTop
      const y = probe.getBoundingClientRect().bottom - top
      paper.style.setProperty('--rule-y', `${((Math.round(y) % 48) + 48) % 48}px`)
    }
    align()
    let alive = true
    void document.fonts?.ready.then(() => alive && align())
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(align)
    ro?.observe(paper)
    return () => {
      alive = false
      ro?.disconnect()
    }
  }, [flipped, answer])

  const keys: KeyBindings = { Escape: onStop }
  if (!flipped) {
    if (listen) {
      // Enter trong ô gõ submit form; ngoài ô gõ Space/S chỉ phát âm, không kiểm tra.
      keys.Space = play
      keys.s = play
    } else {
      keys.Space = flip
      keys.Enter = flip
      if (card.direction !== 'vi_en') keys.s = say
    }
  } else {
    for (const g of GRADES) keys[String(g)] = () => choose(g)
    keys.s = say
  }
  useKeyboard(keys)

  const source = sourceOf(item, snapshot)
  const side = flipped ? 'Mặt sau' : 'Mặt trước'
  const keyHint = flipped
    ? 'Phím 1–4 để chấm · S để nghe'
    : listen
      ? 'Space để nghe · Tab vào ô gõ, Enter để kiểm tra'
      : card.direction === 'vi_en'
        ? 'Space để lật'
        : 'Space để lật · S để nghe'

  return (
    <>
      <div
        ref={bodyRef}
        className={`review-body${flipped && card.direction === 'en_vi' && tts.viAvailable ? ' review-body--pair' : ''}`}
        tabIndex={-1}
        role="group"
        aria-roledescription="thẻ"
        aria-label={side}
      >
        {!flipped && card.direction === 'en_vi' && (
          <div className="review-en-row">
            <p className="review-en" lang="en">
              <span className="review-baseline" aria-hidden="true" />
              {item.en}
            </p>
            <Speak text={item.en} tts={tts} />
          </div>
        )}

        {!flipped && card.direction === 'vi_en' && (
          <>
            <p className="review-vi-front">{item.vi}</p>
            <p className="review-mute">Nói to câu tiếng Anh rồi lật thẻ</p>
          </>
        )}

        {!flipped && listen && (
          <>
            <Button variant="secondary" size="lg" onClick={play}>
              <Volume2 size={20} strokeWidth={1.75} aria-hidden="true" />
              {played ? 'Nghe lại' : 'Nghe'}
            </Button>
            <form id={formId} className="review-listen-form" onSubmit={onCheck}>
              <Field
                label="Câu bạn nghe được"
                placeholder="Gõ lại câu bạn nghe"
                lang="en"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </form>
          </>
        )}

        {flipped && (
          <>
            <div className="review-en-row">
              <p className="review-en" lang="en">
                <span className="review-baseline" aria-hidden="true" />
                {item.en}
                {mark !== null && <PenMark grade={mark} />}
              </p>
              <Speak text={item.en} tts={tts} />
            </div>
            {listen && answer && <ListenResult answer={answer} typed={typed} expected={item.en} />}
            {item.ipa && (
              <p className="review-ipa" lang="en">
                {item.ipa}
              </p>
            )}
            {card.direction === 'en_vi' ? (
              <>
                <div className="review-vi-row">
                  <p className="review-vi">{item.vi}</p>
                  <SpeakButton lang="vi" text={item.vi} label="Nghe nghĩa tiếng Việt" />
                </div>
                {tts.viAvailable && (
                  <div className="review-speak-pair">
                    <SpeakButton text={item.en} visibleLabel="Anh" label="Nghe câu tiếng Anh" />
                    <SpeakButton lang="vi" text={item.vi} visibleLabel="Việt" label="Nghe nghĩa tiếng Việt" />
                  </div>
                )}
              </>
            ) : (
              <p className="review-vi">{item.vi}</p>
            )}
            {item.note && <p className="review-note">{item.note}</p>}
            {source && <p className="review-source">{source}</p>}
          </>
        )}
      </div>

      <div className="review-actions">
        {!flipped ? (
          listen ? (
            <Button size="lg" type="submit" form={formId} className="review-flip">
              Kiểm tra
            </Button>
          ) : (
            <Button size="lg" className="review-flip" onClick={flip}>
              Lật thẻ
            </Button>
          )
        ) : (
          <div className="review-grades" role="group" aria-label="Chấm mức nhớ">
            {GRADES.map((g) => (
              <div className="review-grade" key={g}>
                <Button
                  variant={GRADE_VARIANT[g]}
                  className="review-grade-btn"
                  aria-keyshortcuts={String(g)}
                  aria-describedby={preview === null ? undefined : `${uid}-g${g}`}
                  // Không làm mờ hàng nút trong lúc dấu bút hiện: chặn bấm lặp bằng guard trong choose()/grade().
                  onClick={() => choose(g)}
                >
                  {GRADE_LABELS[g]}
                </Button>
                {preview !== null && (
                  <span id={`${uid}-g${g}`} className="review-grade-hint">
                    {preview === undefined ? '…' : preview[g]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="review-keys">{keyHint}</p>
      </div>
    </>
  )
}

/**
 * Dấu bút của giáo viên trên câu vừa chấm: Quên = gạch đỏ chéo qua câu, Khó = gạch đỏ ngắn,
 * Nhớ/Dễ = dấu tick tím. Nét được "viết" bằng stroke-dashoffset; reduced-motion → hiện ngay.
 * Chỉ là trang trí (aria-hidden): kết quả đã đọc qua nút vừa bấm.
 */
function PenMark({ grade }: { grade: Grade }) {
  if (grade === 1) {
    return (
      <svg className="pen-mark pen-mark--strike" aria-hidden="true" focusable="false">
        <line x1="-2%" y1="78%" x2="102%" y2="30%" pathLength={1} />
      </svg>
    )
  }
  if (grade === 2) {
    return (
      <svg className="pen-mark pen-mark--dash" aria-hidden="true" focusable="false">
        <line x1="2" y1="9" x2="62" y2="3" pathLength={1} />
      </svg>
    )
  }
  return (
    <svg className="pen-mark pen-mark--tick" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M9 25.5c3 1.8 5.6 4.6 7.8 8.6C21.6 23.4 28.4 15 38.5 8.5" pathLength={1} />
    </svg>
  )
}

function ListenResult({ answer, typed, expected }: { answer: Answer; typed: string; expected: string }) {
  if (answer === 'exact') return <p className="review-result">Đúng rồi.</p>
  return (
    <div className="review-result-block">
      <p className={answer === 'wrong' ? 'review-result review-result--wrong' : 'review-result'}>
        {answer === 'wrong' ? 'Chưa đúng.' : 'Gần đúng.'}
      </p>
      <p className="review-mute">
        Bạn gõ: <span lang="en">{typed.trim() || '(trống)'}</span>
      </p>
      <p className="review-mute">
        Đáp án: <span lang="en">{expected}</span>
      </p>
    </div>
  )
}

function ReviewEmpty({ snapshot, lessonId }: { snapshot: Snapshot; lessonId?: string }) {
  if (snapshot.cards.length === 0) {
    return (
      <EmptyState
        title="Chưa có thẻ nào."
        description="Ghi buổi học hoặc thêm mẫu câu để tạo thẻ."
        action={
          <Link to="/lessons/new" className={buttonClass('primary')}>
            Ghi buổi học
          </Link>
        }
        secondary={
          <Link to="/patterns" className={buttonClass('ghost')}>
            Xem mẫu câu
          </Link>
        }
      />
    )
  }
  const latest = sortLessons(snapshot.lessons)[0]
  return (
    <EmptyState
      title="Không có thẻ nào đến hạn."
      description="Bạn có thể ôn thêm buổi gần nhất, hoặc luyện shadowing."
      action={
        <Link to="/shadowing" className={buttonClass('primary')}>
          Shadowing
        </Link>
      }
      secondary={
        latest && latest.id !== lessonId ? (
          <Link to={`/review?lesson=${latest.id}`} className={buttonClass('ghost')}>
            Ôn buổi gần nhất
          </Link>
        ) : undefined
      }
    />
  )
}

function ReviewSummary({ snapshot, session }: { snapshot: Snapshot; session: ReviewSession }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])
  const [today] = useState(() => localDay(new Date()))
  const streakNow = streak(snapshot.studyDays, today).current
  const forgot = session.againCount

  return (
    <section className="card review-card review-summary" aria-labelledby="review-summary-title">
      <h2 id="review-summary-title" ref={headingRef} tabIndex={-1} className="review-summary-title">
        Xong phiên ôn!
      </h2>
      <ul className="review-stats">
        <li>
          <strong>{session.reviewed.length}</strong> thẻ đã ôn
        </li>
        <li>
          <strong>{sessionDurationLabel(session)}</strong>
        </li>
        <li className={forgot > 0 ? 'review-stat--forgot' : undefined}>
          <strong>{forgot}</strong> thẻ còn quên
        </li>
        <li>
          chuỗi <strong>{streakNow}</strong> ngày
        </li>
      </ul>
      <div className="review-summary-actions">
        <Link to="/" className={buttonClass('primary', 'lg')}>
          Về Hôm nay
        </Link>
        <Link to="/shadowing" className={buttonClass('secondary', 'lg')}>
          Shadowing vài câu
        </Link>
      </div>
    </section>
  )
}
