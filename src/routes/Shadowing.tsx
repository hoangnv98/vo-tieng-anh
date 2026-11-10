import { ChevronLeft, ChevronRight, CircleAlert, Info, Mic, Play, Repeat, RotateCcw, Square, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { PageTitle } from '../components/PageTitle'
import { Segmented } from '../components/Segmented'
import { TtsUnsupportedNote } from '../components/SpeakButton'
import { Spinner } from '../components/Spinner'
import { asStudyLanguage, LANG_TAG, LANGUAGE_LABELS, missingVoiceText, ROMAN_TAG } from '../domain/languageCore'
import type { Snapshot } from '../domain/types'
import { APP_NAME, usePageTitle } from '../hooks/usePageTitle'
import { useRecorder } from '../hooks/useRecorder'
import { useStudyTimer } from '../hooks/useStudyTimer'
import { useTts } from '../hooks/useTts'
import { formatClock, MIN_COUNTED_MS } from '../lib/recorder'
import { useData } from '../state/useData'
import { lessonSourceLabel, resolveSource, sourceSentences, type ShadowSource, type SourceKind } from './shadowingSource'
import { selectSituationGroups, type SituationGroup } from './situationGroups'
import './Shadowing.css'

const RATES = [0.5, 0.75, 1] as const
type Rate = (typeof RATES)[number]
const RATE_KEY = 'vta:shadowing:rate'
const DEFAULT_RATE: Rate = 0.75
/** `active` của bộ đếm thời gian: có bấm nghe/ghi trong 120 giây gần nhất (4.5). */
const IDLE_MS = 120_000

const MSG = {
  desc: 'Nghe câu mẫu, nói theo thật to, ghi âm rồi nghe lại để so.',
  denied: 'Trình duyệt đã chặn micro. Mở cài đặt trang để cho phép, rồi tải lại.',
  notFound: 'Không tìm thấy micro trên thiết bị này.',
  recError: 'Không ghi âm được. Thử lại hoặc dùng Chrome/Edge.',
  recUnsupported: 'Trình duyệt này chưa hỗ trợ ghi âm. Bạn vẫn có thể nghe mẫu và nói theo.',
  ttsUnsupported: 'Trình duyệt này không đọc được câu mẫu. Hãy thử Chrome hoặc Edge. Bạn vẫn có thể ghi âm và nghe lại.',
  privacy: 'Bản ghi chỉ lưu tạm trên thiết bị này trong lúc luyện và không được tải lên.',
  missingVoiceTail: 'Bạn vẫn có thể ghi âm và nghe lại.',
}

function readRate(): Rate {
  try {
    const v = Number(sessionStorage.getItem(RATE_KEY))
    return (RATES as readonly number[]).includes(v) ? (v as Rate) : DEFAULT_RATE
  } catch {
    return DEFAULT_RATE
  }
}

function writeRate(r: Rate): void {
  try {
    sessionStorage.setItem(RATE_KEY, String(r))
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
}

export default function Shadowing() {
  usePageTitle('Shadowing')
  const { snapshot } = useData()
  const [params] = useSearchParams()
  // Shell chỉ render route khi dữ liệu đã `ready`; nhánh này chỉ để thu hẹp kiểu.
  if (!snapshot) {
    return (
      <div className="sh">
        <Spinner />
      </div>
    )
  }
  return <ShadowingScreen key={params.toString()} snapshot={snapshot} params={params} />
}

/** Một nhóm → option phẳng (như trước T20); nhiều nhóm → `<optgroup>` theo ngôn ngữ. */
function situationOptions(groups: SituationGroup[]): ReactNode {
  const option = (s: SituationGroup['situations'][number]) => (
    <option key={s.id} value={s.id}>
      {s.nameVi}
    </option>
  )
  if (groups.length === 1) return groups[0].situations.map(option)
  return groups.map((g) => (
    <optgroup key={g.language} label={LANGUAGE_LABELS[g.language]}>
      {g.situations.map(option)}
    </optgroup>
  ))
}

type Playing = null | 'model' | 'mine' | 'sequence'

function ShadowingScreen({ snapshot, params }: { snapshot: Snapshot; params: URLSearchParams }) {
  const { addStudyTime } = useData()
  const tts = useTts()
  const filter = asStudyLanguage(snapshot.settings.study_language)

  const [src, setSrc] = useState<ShadowSource>(() =>
    resolveSource(
      snapshot.lessons,
      snapshot.items,
      {
        lesson: params.get('lesson'),
        item: params.get('item'),
        pattern: params.get('pattern'),
      },
      filter,
    ),
  )
  const sentences = useMemo(
    () => sourceSentences(src, snapshot.items, snapshot.lessons),
    [src, snapshot.items, snapshot.lessons],
  )
  const index = Math.min(src.index, Math.max(0, sentences.length - 1))
  const sentence = sentences[index]
  const hasLessons = snapshot.lessons.length > 0 && src.lessonId !== null

  const [rate, setRate] = useState<Rate>(readRate)
  const [playing, setPlaying] = useState<Playing>(null)
  /** "Nghe lần lượt": trình duyệt chặn audio.play() sau TTS → cho bấm "Phát bản ghi". */
  const [needTap, setNeedTap] = useState(false)
  const playIdRef = useRef(0)
  /** Lượt phát đang dùng thẻ <audio>; sự kiện pause/ended của lượt cũ bị bỏ qua. */
  const audioIdRef = useRef(-1)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Bộ đếm thời gian học: active khi có bấm nghe/ghi trong 120 giây gần nhất.
  const [active, setActive] = useState(false)
  const idleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const touch = useCallback(() => {
    setActive(true)
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => setActive(false), IDLE_MS)
  }, [])
  useEffect(() => () => clearTimeout(idleRef.current), [])
  useStudyTimer(active)

  const onComplete = useCallback(
    (ms: number) => {
      touch()
      if (ms >= MIN_COUNTED_MS) addStudyTime({ shadowing: 1 }).catch(() => {})
    },
    [addStudyTime, touch],
  )
  const rec = useRecorder({ onComplete })
  const recSupported = rec.supported
  const ttsSupported = tts.supported
  /** Ngôn ngữ câu đang luyện; `en` giữ nguyên điều kiện cũ (Web Speech), ngôn ngữ khác cần có giọng thiết bị. */
  const lang = sentence?.language ?? 'en'
  const canModel = ttsSupported && (lang === 'en' || tts.canSpeakLang(lang))

  const stopPlayback = useCallback(() => {
    playIdRef.current++
    tts.cancel()
    const a = audioRef.current
    if (a && !a.paused) a.pause()
    setPlaying(null)
  }, [tts])

  /** Chuyển câu/nguồn: huỷ bản ghi hiện tại, dừng mọi âm thanh, không hỏi. */
  function changeSource(next: ShadowSource) {
    stopPlayback()
    rec.reset()
    setNeedTap(false)
    setSrc(next)
  }
  const goTo = (i: number) => changeSource({ ...src, index: i })
  const setKind = (kind: SourceKind) => {
    if (kind !== src.kind) changeSource({ ...src, kind, index: 0 })
  }

  function chooseRate(r: Rate) {
    setRate(r)
    writeRate(r)
  }

  function playModel() {
    if (!sentence) return
    if (playing === 'model') return stopPlayback()
    stopPlayback()
    touch()
    const id = ++playIdRef.current
    setPlaying('model')
    setNeedTap(false)
    // Gọi đồng bộ trong handler click (iOS Safari).
    tts.speak(sentence.en, { rate, lang: sentence.language }).then(
      () => playIdRef.current === id && setPlaying(null),
      () => playIdRef.current === id && setPlaying(null),
    )
  }

  function playAudio(id: number, mode: 'mine' | 'sequence') {
    const a = audioRef.current
    if (!a) {
      setPlaying(null)
      return
    }
    audioIdRef.current = id
    a.currentTime = 0
    a.play().catch(() => {
      if (playIdRef.current !== id) return
      setPlaying(null)
      if (mode === 'sequence') setNeedTap(true)
    })
  }

  function playMine() {
    if (playing === 'mine') return stopPlayback()
    stopPlayback()
    touch()
    setNeedTap(false)
    const id = ++playIdRef.current
    setPlaying('mine')
    playAudio(id, 'mine')
  }

  function playSequence() {
    if (!sentence) return
    if (playing === 'sequence') return stopPlayback()
    stopPlayback()
    touch()
    setNeedTap(false)
    const id = ++playIdRef.current
    setPlaying('sequence')
    tts.speak(sentence.en, { rate, lang: sentence.language }).then(
      () => {
        if (playIdRef.current === id) playAudio(id, 'sequence')
      },
      () => playIdRef.current === id && setPlaying(null),
    )
  }

  function onAudioDone() {
    if (audioIdRef.current === playIdRef.current) setPlaying(null)
  }

  function toggleRecord() {
    if (rec.recording) {
      rec.stop()
      return
    }
    stopPlayback()
    setNeedTap(false)
    touch()
    rec.start()
  }

  const situationSelect = src.kind === 'patterns' && (
    <Field
      as="select"
      label="Tình huống"
      className="sh-select"
      value={src.situationId}
      onChange={(e) => changeSource({ ...src, situationId: e.target.value, index: 0 })}
    >
      {situationOptions(selectSituationGroups(filter, src.situationId))}
    </Field>
  )

  const sourcePicker = (
    <div className="sh-source">
      {hasLessons && (
        <Segmented
          label="Nguồn câu"
          value={src.kind}
          onChange={setKind}
          options={[
            { value: 'lesson', label: lessonSourceLabel(snapshot.lessons, src.lessonId, filter) },
            { value: 'patterns', label: 'Mẫu câu' },
          ]}
        />
      )}
      {situationSelect}
    </div>
  )

  const head = (
    <header className="sh-head">
      <PageTitle>Shadowing</PageTitle>
      <p className="sh-desc">{MSG.desc}</p>
    </header>
  )

  if (!recSupported && !ttsSupported) {
    return (
      <div className="sh">
        {head}
        <EmptyState
          title="Trình duyệt này chưa hỗ trợ nghe và ghi âm."
          description={`Hãy mở ${APP_NAME} bằng Chrome hoặc Edge để luyện shadowing.`}
        />
      </div>
    )
  }

  if (!sentence) {
    return (
      <div className="sh">
        {head}
        {sourcePicker}
        <EmptyState
          title="Buổi này chưa có câu nào."
          description="Chọn 'Mẫu câu' để luyện."
          action={
            <Button variant="primary" onClick={() => setKind('patterns')}>
              Luyện mẫu câu
            </Button>
          }
        />
      </div>
    )
  }

  const hasTake = rec.blobUrl !== null && !rec.recording
  const busyPlaying = playing !== null
  const canRecord = recSupported && rec.permission !== 'denied'
  const total = sentences.length

  const modelBtn = canModel && (
    <Button
      variant="secondary"
      size="lg"
      onClick={playModel}
      disabled={rec.recording || (busyPlaying && playing !== 'model')}
    >
      {playing === 'model' ? <Square size={20} strokeWidth={1.75} aria-hidden="true" /> : <Volume2 size={20} strokeWidth={1.75} aria-hidden="true" />}
      {playing === 'model' ? 'Dừng' : 'Nghe mẫu'}
    </Button>
  )

  let recordArea: ReactNode = null
  if (!recSupported) {
    recordArea = <InfoLine>{MSG.recUnsupported}</InfoLine>
  } else if (!canRecord) {
    recordArea = <InfoLine>{MSG.denied}</InfoLine>
  }

  return (
    <div className="sh">
      {head}
      {sourcePicker}

      <div className="sh-body">
        <nav className="sh-list card" aria-label="Danh sách câu">
          <ol>
            {sentences.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  className="sh-list-row"
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => i !== index && goTo(i)}
                >
                  <span className="sh-list-en" lang={LANG_TAG[s.language]}>
                    {s.en}
                  </span>
                  {s.vi && <span className="sh-list-vi">{s.vi}</span>}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="sh-main">
          <div className="sh-pick">
            <Field
              as="select"
              label="Câu đang luyện"
              className="sh-select"
              value={index}
              onChange={(e) => goTo(Number(e.target.value))}
            >
              {sentences.map((s, i) => (
                <option key={s.key} value={i} lang={LANG_TAG[s.language]}>
                  {`${i + 1}. ${s.en}`}
                </option>
              ))}
            </Field>
          </div>

          <section className="sh-practice card" aria-label="Khu luyện">
            <div className="sh-text">
              <p className="sh-en" lang={LANG_TAG[lang]}>
                {sentence.en}
              </p>
              {sentence.vi && <p className="sh-vi">{sentence.vi}</p>}
              {sentence.ipa && (
                <p className="sh-ipa" lang={ROMAN_TAG[lang]}>
                  {sentence.ipa}
                </p>
              )}
            </div>

            {canModel && (
              <div className="sh-rate">
                <span className="sh-rate-label" id="sh-rate-label">
                  Tốc độ
                </span>
                <Segmented
                  labelledBy="sh-rate-label"
                  value={rate}
                  onChange={chooseRate}
                  options={RATES.map((r) => ({ value: r, label: `${r}x` }))}
                />
              </div>
            )}

            {lang === 'en' && tts.enServer && <p className="sh-voice-note">Giọng mẫu: server local.</p>}

            {!ttsSupported && <TtsUnsupportedNote>{MSG.ttsUnsupported}</TtsUnsupportedNote>}
            {ttsSupported && !canModel && (
              <TtsUnsupportedNote>{missingVoiceText(lang, MSG.missingVoiceTail)}</TtsUnsupportedNote>
            )}

            {hasTake && canRecord ? (
              <div className="sh-actions">
                {modelBtn}
                <Button variant="secondary" size="lg" onClick={playMine} disabled={busyPlaying && playing !== 'mine'}>
                  {playing === 'mine' ? <Square size={20} strokeWidth={1.75} aria-hidden="true" /> : <Play size={20} strokeWidth={1.75} aria-hidden="true" />}
                  {playing === 'mine' ? 'Dừng' : 'Nghe giọng bạn'}
                </Button>
                {canModel && (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={playSequence}
                    disabled={busyPlaying && playing !== 'sequence'}
                  >
                    {playing === 'sequence' ? <Square size={20} strokeWidth={1.75} aria-hidden="true" /> : <Repeat size={20} strokeWidth={1.75} aria-hidden="true" />}
                    {playing === 'sequence' ? 'Dừng' : 'Nghe lần lượt'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={toggleRecord}
                  disabled={rec.starting}
                  aria-busy={rec.starting || undefined}
                >
                  <RotateCcw size={20} strokeWidth={1.75} aria-hidden="true" />
                  Ghi lại
                </Button>
              </div>
            ) : (
              <div className="sh-actions">
                {modelBtn}
                {canRecord && (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={toggleRecord}
                    disabled={rec.starting}
                    aria-busy={rec.starting || undefined}
                  >
                    {rec.recording ? <Square size={20} strokeWidth={1.75} aria-hidden="true" /> : <Mic size={20} strokeWidth={1.75} aria-hidden="true" />}
                    {rec.recording ? 'Dừng ghi' : 'Ghi âm'}
                  </Button>
                )}
              </div>
            )}

            {recordArea}

            {canRecord && (
              <p className="sh-status" role="status">
                {rec.recording ? (
                  <>
                    <span className="sh-dot" aria-hidden="true" />
                    <span className="visually-hidden">Đang ghi</span>
                    <span aria-hidden="true">
                      Đang ghi… <span className="sh-clock">{formatClock(rec.seconds)}</span>
                    </span>
                  </>
                ) : hasTake ? (
                  <span>
                    Bản ghi của bạn · <span className="sh-clock">{formatClock(rec.duration)}</span>
                  </span>
                ) : null}
              </p>
            )}

            {needTap && hasTake && (
              <Button variant="ghost" className="sh-tap" onClick={playMine}>
                <Play size={20} strokeWidth={1.75} aria-hidden="true" />
                Phát bản ghi
              </Button>
            )}

            {canRecord && rec.error === 'notfound' && <InfoLine>{MSG.notFound}</InfoLine>}
            {canRecord && rec.error === 'other' && (
              <p className="sh-error" role="alert">
                <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
                <span>{MSG.recError}</span>
              </p>
            )}

            <div className="sh-nav">
              <Button variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
                Câu trước
              </Button>
              <span className="sh-pos">
                {index + 1}/{total}
              </span>
              <Button variant="ghost" onClick={() => goTo(index + 1)} disabled={index >= total - 1}>
                Câu tiếp
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
              </Button>
            </div>
          </section>

          <p className="sh-privacy">{MSG.privacy}</p>
        </div>
      </div>

      {rec.blobUrl && (
        <audio
          ref={audioRef}
          src={rec.blobUrl}
          preload="auto"
          hidden
          onEnded={onAudioDone}
          onPause={onAudioDone}
          onError={onAudioDone}
        />
      )}
    </div>
  )
}

function InfoLine({ children }: { children: ReactNode }) {
  return (
    <p className="sh-info">
      <Info size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
