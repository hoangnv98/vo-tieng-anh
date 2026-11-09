import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '../components/Button'
import { buttonClass } from '../components/buttonClass'
import { EmptyState } from '../components/EmptyState'
import { NotebookPage } from '../components/NotebookPage'
import { MistakesNote } from '../components/MistakesNote'
import { StatusMark } from '../components/StatusMark'
import { buildQueue, estimateMinutes, hardestCards, hiddenListenCount } from '../domain/review'
import { goalReached, pickRemark, streak, todaySeconds } from '../domain/stats'
import { usePageTitle } from '../hooks/usePageTitle'
import { useTts } from '../hooks/useTts'
import { formatDateVi, localDay } from '../lib/dates'
import { situationOfPattern } from '../data/patterns'
import {
  asStudyLanguage,
  itemLanguageResolver,
  LANG_TAG,
  languageNameInSentence,
  latestLessonOf,
  lessonLanguage,
} from '../domain/language'
import { filterSuffix, noCardsInLanguageText } from '../domain/languageUi'
import type { Language } from '../domain/types'
import { useData } from '../state/useData'
import './Today.css'

const MAX_ENTRIES = 6

export default function Today() {
  usePageTitle('Hôm nay')
  const { snapshot, saveSettings, notify } = useData()
  const { supported: ttsSupported, speakable: voices } = useTts()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [snapshot, tick])

  const view = useMemo(() => {
    if (!snapshot) return null
    const { cards, items, lessons, studyDays, settings } = snapshot
    const today = localDay(now)
    // (T20) Thẻ nghe của ngôn ngữ chưa có giọng bị ẩn; `en` giữ điều kiện cũ (Web Speech).
    const langOf = itemLanguageResolver(lessons)
    const speakable = (l: Language) => (l === 'en' ? ttsSupported : ttsSupported && voices[l])
    // (T20) Bộ lọc "Ngôn ngữ đang học": hàng đợi, thẻ khó nhất, thẻ nghe ẩn, buổi gần nhất.
    const filter = asStudyLanguage(settings.study_language)
    const language = filter === 'all' ? undefined : filter
    const langOpts = { ttsSupported, langOf, speakable, language }
    const queue = buildQueue(cards, items, settings, now, langOpts)
    const latest = latestLessonOf(lessons, filter)
    const itemById = new Map(items.map((i) => [i.id, i]))
    const langCardCount =
      language === undefined
        ? cards.length
        : cards.filter((c) => {
            const item = itemById.get(c.item_id)
            return item !== undefined && langOf(item) === language
          }).length
    const fromLatest = latest ? queue.filter((c) => itemById.get(c.item_id)?.lesson_id === latest.id).length : 0
    const latestItems = latest
      ? items.filter((i) => i.lesson_id === latest.id).sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? -1 : 1))
      : []
    const secs = todaySeconds(studyDays, today)
    const st = streak(studyDays, today)
    const reached = goalReached(secs, settings.daily_goal_min)
    return {
      now,
      queue,
      latest,
      latestItems,
      fromLatest,
      hard: hardestCards(cards, items, 3, langOpts).map((h) => ({ ...h, lang: langOf(h.item) })),
      hiddenListen: hiddenListenCount(cards, items, settings, now, langOpts),
      minutes: Math.floor(secs / 60),
      st,
      remark: pickRemark({ todayDone: st.todayDone, goalReached: reached, streakCurrent: st.current }),
      goal: settings.daily_goal_min,
      cardCount: cards.length,
      langCardCount,
      filter,
      settings,
    }
  }, [snapshot, ttsSupported, voices, now])

  if (!view) return null
  const { queue, latest, latestItems, fromLatest, hard, hiddenListen } = view
  const n = queue.length
  const mins = estimateMinutes(n)
  const { filter } = view
  const noCards = view.cardCount === 0
  /** Đang lọc một ngôn ngữ mà vở chưa có thẻ ngôn ngữ đó (vở có thẻ ngôn ngữ khác). */
  const noLangCards = !noCards && filter !== 'all' && view.langCardCount === 0
  const allDone = !noCards && !noLangCards && n === 0

  const studyAll = () => {
    saveSettings({ ...view.settings, study_language: 'all' }).then(
      () => notify('Đã lưu.'),
      () => {
        /* lỗi ghi đã báo bằng toast chung */
      },
    )
  }

  let sub: string
  if (noCards) sub = 'Chưa có thẻ nào. Ghi lại buổi học đầu tiên để bắt đầu.'
  else if (noLangCards) sub = noCardsInLanguageText(filter)
  else if (allDone) sub = 'Hôm nay bạn đã ôn xong. Mai quay lại nhé.'
  else {
    const parts: string[] = []
    if (mins > 0) parts.push(`khoảng ${mins} phút`)
    if (fromLatest > 0 && latest) parts.push(`${fromLatest} thẻ từ buổi ${latest.number}`)
    sub = parts.join(' · ')
  }
  if (hiddenListen > 0 && !noCards && !noLangCards) sub += `${sub ? ' · ' : ''}${hiddenListen} thẻ nghe tạm ẩn`

  const hardHref = (itemLessonId: string | null, patternId: string | null) => {
    if (itemLessonId) return `/lessons/${itemLessonId}`
    const sid = patternId ? situationOfPattern(patternId) : undefined
    if (sid) return `/patterns/${sid}`
    return '/patterns'
  }

  return (
    <div className="today">
      <h1 className="visually-hidden">Hôm nay</h1>

      <div className="today-grid">
        <section className="today-due card" aria-labelledby="today-due-title">
          <h2 id="today-due-title" className="today-due-title">
            <span className="today-count">{n}</span>
            <span className="today-count-text">thẻ đến hạn hôm nay</span>
          </h2>
          {sub && <p className="today-sub">{sub}</p>}
          <div className="today-actions">
            {noCards ? (
              <>
                <Link to="/lessons/new" className={buttonClass('primary', 'lg')}>
                  Ghi buổi học đầu tiên
                </Link>
                <Link to="/patterns" className={buttonClass('ghost')}>
                  Xem mẫu câu
                </Link>
              </>
            ) : noLangCards ? (
              <>
                <Link to="/lessons/new" className={buttonClass('primary', 'lg')}>
                  Ghi buổi học
                </Link>
                <Button variant="ghost" onClick={studyAll}>
                  Học tất cả ngôn ngữ
                </Button>
              </>
            ) : allDone ? (
              <>
                <Link to="/shadowing" className={buttonClass('primary', 'lg')}>
                  Shadowing vài câu
                </Link>
                {latest && (
                  <Link to={`/review?lesson=${latest.id}`} className={buttonClass('ghost')}>
                    Ôn thêm buổi gần nhất
                  </Link>
                )}
              </>
            ) : (
              <Link to="/review" className={buttonClass('primary', 'lg')}>
                Ôn ngay
              </Link>
            )}
          </div>
          <p className="today-progress">
            Hôm nay: {view.minutes}/{view.goal} phút{filterSuffix(filter)}
          </p>

          {hard.length > 0 && (
            <div className="today-hard">
              <h2 className="today-hard-title">Thẻ khó nhất</h2>
              <ul className="today-hard-list">
                {hard.map((h) => (
                  <li key={h.card.id}>
                    <Link to={hardHref(h.item.lesson_id, h.item.pattern_id)} className="today-hard-row">
                      <span className="today-hard-en" lang={LANG_TAG[h.lang]}>
                        {h.item.en}
                      </span>
                      <StatusMark variant={h.tone === 'red' ? 'forgot' : 'learning'} lapses={h.card.lapses}>
                        {h.label}
                      </StatusMark>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="today-page">
          {latest ? (
            <>
              <NotebookPage
                dateLine={`Buổi ${latest.number} · ${formatDateVi(latest.date)}`}
                title={latest.topic}
                remark={view.remark}
              >
                {latestItems.slice(0, MAX_ENTRIES).map((it) => (
                  <div className="entry" key={it.id}>
                    <span className="en" lang={LANG_TAG[lessonLanguage(latest)]}>
                      {it.en}
                    </span>
                    <span className="vi">{it.vi}</span>
                  </div>
                ))}
                {latestItems.length === 0 && <p className="today-muted">Buổi này chưa có mục nào.</p>}
                <MistakesNote text={latest.mistakes} inline />
              </NotebookPage>
              {latestItems.length > MAX_ENTRIES && (
                <Link to={`/lessons/${latest.id}`} className={buttonClass('ghost')}>
                  + {latestItems.length - MAX_ENTRIES} mục nữa · Xem cả trang
                </Link>
              )}
              {latestItems.length === 0 && (
                <Link to={`/lessons/${latest.id}/edit`} className={buttonClass('ghost')}>
                  Thêm mục
                </Link>
              )}
              <div className="today-page-actions">
                <Link to="/lessons/new" className={buttonClass('ghost')}>
                  <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
                  Ghi buổi mới
                </Link>
              </div>
            </>
          ) : (
            <NotebookPage remark={view.remark}>
              <EmptyState
                title={filter === 'all' ? 'Trang vở còn trống.' : `Chưa có buổi ${languageNameInSentence(filter)} nào.`}
                description={
                  filter === 'all'
                    ? 'Sau buổi học đầu tiên, ghi lại từ và mẫu câu ở đây. Mỗi mục sẽ tự thành thẻ ôn.'
                    : 'Ghi buổi học đầu tiên của ngôn ngữ này, hoặc chọn "Tất cả" trong Cài đặt để xem cả vở.'
                }
                action={
                  <Link to="/lessons/new" className={buttonClass('primary')}>
                    Ghi buổi học
                  </Link>
                }
              />
            </NotebookPage>
          )}
        </div>
      </div>
    </div>
  )
}
