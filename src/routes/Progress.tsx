import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../components/Button.css'
import { buttonClass } from '../components/buttonClass'
import { PageTitle } from '../components/PageTitle'
import { asStudyLanguage, itemLanguageResolver, LANGUAGE_LABELS } from '../domain/language'
import type { Card } from '../domain/types'
import { calendarWeeks, cardStats, streak, todaySeconds, weekMinutes, type CalendarCell } from '../domain/stats'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatDateVi, localDay, weekdayShortVi } from '../lib/dates'
import { useData } from '../state/useData'
import './Progress.css'

/** Dấu tick bút tím, nét hơi lệch như viết tay (không dùng icon Check vuông vắn). */
function PenTick() {
  return (
    <svg className="cal-tick" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <path d="M6.5 14.8c1.7 1.1 3.2 2.6 4.5 4.9 2.6-5.6 6-9.7 10.6-12.9" />
    </svg>
  )
}

function cellText(c: CalendarCell, full: boolean): string {
  const head = formatDateVi(c.day)
  if (c.status === 'future') return `${head}: ngày tới`
  if (c.seconds === 0) return `${head}: chưa học`
  const min = c.seconds < 60 ? 'dưới 1 phút' : `${Math.floor(c.seconds / 60)} phút`
  return full ? `${head}: ${min} · ${c.reviews} thẻ · ${c.shadowing} bản ghi` : `${head}: ${min}`
}

export default function Progress() {
  usePageTitle('Tiến độ')
  const { snapshot } = useData()
  const [today, setToday] = useState(() => localDay(new Date()))

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setToday(localDay(new Date()))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const view = useMemo(() => {
    if (!snapshot) return null
    const secs = todaySeconds(snapshot.studyDays, today)
    // (T20) Chỉ khối "Thẻ ôn" lọc theo ngôn ngữ đang học; chuỗi/phút/lịch luôn tính chung (4.5).
    const filter = asStudyLanguage(snapshot.settings.study_language)
    const language = filter === 'all' ? undefined : filter
    const itemLang = itemLanguageResolver(snapshot.lessons)
    const itemById = new Map(snapshot.items.map((i) => [i.id, i]))
    const langOf = (c: Card) => {
      const item = itemById.get(c.item_id)
      return item ? itemLang(item) : 'en'
    }
    return {
      language,
      minutes: Math.floor(secs / 60),
      goal: snapshot.settings.daily_goal_min,
      streak: streak(snapshot.studyDays, today),
      week: weekMinutes(snapshot.studyDays, today),
      weeks: calendarWeeks(snapshot.studyDays, today),
      stats: cardStats(snapshot.cards, snapshot.lessons, { language, langOf }),
      hasAny: snapshot.studyDays.some((d) => d.seconds > 0),
    }
  }, [snapshot, today])

  if (!view) return null

  const { minutes, goal, stats, language } = view
  const now = Math.min(minutes, goal)
  const rows: [string, number][] = [
    ['Tổng số thẻ', stats.total],
    ['Đã thuộc (ổn định ≥ 3 tuần)', stats.mastered],
    ['Đang ôn', stats.review - stats.mastered],
    ['Đang học', stats.learning],
    ['Chưa bắt đầu', stats.new],
    ['Buổi học đã ghi', stats.lessonsCount],
  ]

  return (
    <section className="progress" aria-labelledby="progress-title">
      <PageTitle id="progress-title">Tiến độ</PageTitle>

      <div className="progress-layout">
        <section className="card progress-block progress-goal-block" aria-labelledby="progress-today">
          <h2 id="progress-today" className="progress-h2">
            Hôm nay
          </h2>
          <p className="progress-big">
            {minutes} / {goal} phút
          </p>
          <div
            className="progress-bar"
            role="progressbar"
            aria-label="Tiến độ hôm nay"
            aria-valuemin={0}
            aria-valuenow={now}
            aria-valuemax={goal}
            aria-valuetext={`${minutes} trên ${goal} phút`}
          >
            <div className="progress-fill" style={{ width: `${goal > 0 ? (now / goal) * 100 : 0}%` }} />
          </div>
          <p className="progress-mute">
            chuỗi hiện tại {view.streak.current} ngày · dài nhất {view.streak.best} ngày · tuần này {view.week} phút
          </p>
          {!view.hasAny && <p className="progress-mute">Học 1 phút là ngày đó được tính vào chuỗi.</p>}
          <Link to="/settings" className={buttonClass('ghost', 'md', 'progress-goal')}>
            Đổi mục tiêu
          </Link>
        </section>

        <section className="card progress-block progress-cal-block" aria-labelledby="progress-cal">
          <h2 id="progress-cal" className="progress-h2">
            8 tuần gần nhất
          </h2>
          <div className="cal" role="table" aria-labelledby="progress-cal">
            <div className="cal-row cal-headrow" role="row">
              {weekdayShortVi.map((w) => (
                <span key={w} className="cal-head" role="columnheader">
                  {w}
                </span>
              ))}
            </div>
            <div className="cal-body" role="rowgroup">
              {view.weeks.map((row) => (
                <div key={row[0].day} className="cal-row" role="row">
                  {row.map((c) => (
                    <span
                      key={c.day}
                      role="cell"
                      className={`cal-cell cal-${c.status}${c.isToday ? ' cal-today' : ''}`}
                      title={cellText(c, true)}
                      aria-label={cellText(c, true)}
                    >
                      {c.status === 'done' && <PenTick />}
                      {c.status === 'partial' && <span className="cal-dot" />}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card progress-block progress-stats-block" aria-labelledby="progress-cards">
          <h2 id="progress-cards" className="progress-h2">
            {language ? `Thẻ ôn · ${LANGUAGE_LABELS[language]}` : 'Thẻ ôn'}
          </h2>
          <dl className="stat-list">
            {rows.map(([k, v]) => (
              <div key={k} className="stat-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {language && <p className="progress-note">Chuỗi ngày và phút học tính chung mọi ngôn ngữ.</p>}
        </section>
      </div>
    </section>
  )
}
