import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../components/Button.css'
import { buttonClass } from '../components/buttonClass'
import { EmptyState } from '../components/EmptyState'
import { PageTitle } from '../components/PageTitle'
import { LANGUAGE_LABELS, languagesInUse, lessonLanguage } from '../domain/language'
import { lessonCounts, sortLessons } from '../domain/lessons'
import { usePageTitle } from '../hooks/usePageTitle'
import { useTts } from '../hooks/useTts'
import { formatDateVi, localDay } from '../lib/dates'
import { useData } from '../state/useData'
import './Lessons.css'

export default function Lessons() {
  usePageTitle('Nhật ký buổi học')
  const { snapshot } = useData()
  const { supported: ttsSupported } = useTts()
  const [today, setToday] = useState(() => localDay(new Date()))

  // quay lại tab sau nửa đêm → tính lại "hôm nay"
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setToday(localDay(new Date()))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const lessons = useMemo(() => sortLessons(snapshot?.lessons ?? []), [snapshot?.lessons])
  // (T20) Nhật ký không lọc theo "Ngôn ngữ đang học"; chỉ gắn nhãn khi vở có hơn một ngôn ngữ.
  const showLanguage = useMemo(() => languagesInUse(lessons).length > 1, [lessons])
  const counts = useMemo(
    () => lessonCounts(snapshot?.items ?? [], snapshot?.cards ?? [], today, { ttsSupported }),
    [snapshot?.items, snapshot?.cards, today, ttsSupported],
  )

  return (
    <section className="lessons" aria-labelledby="lessons-title">
      <header className="lessons-head">
        <PageTitle id="lessons-title">Nhật ký buổi học</PageTitle>
        {lessons.length > 0 && (
          <Link to="/lessons/new" className={buttonClass('primary', 'md', 'lessons-new')}>
            <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
            Ghi buổi mới
          </Link>
        )}
      </header>

      {lessons.length === 0 ? (
        <div className="card lessons-empty">
          <EmptyState
            title="Chưa có buổi học nào."
            description="Mỗi buổi học là một trang vở. Ghi lại từ, cụm và mẫu câu giáo viên dạy; chúng sẽ tự thành thẻ ôn."
            action={
              <Link to="/lessons/new" className={buttonClass('primary')}>
                Ghi buổi học đầu tiên
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="card lesson-list">
          {lessons.map((l) => {
            const c = counts.get(l.id) ?? { items: 0, due: 0 }
            return (
              <li key={l.id}>
                <Link to={`/lessons/${l.id}`} className="lesson-row">
                  <span className="lesson-row-when">
                    <span className="lesson-row-number">Buổi {l.number}</span>{' '}
                    <span className="lesson-row-date">{formatDateVi(l.date)}</span>
                    {showLanguage && (
                      <>
                        {' '}
                        <span className="lesson-row-lang">{LANGUAGE_LABELS[lessonLanguage(l)]}</span>
                      </>
                    )}
                  </span>{' '}
                  <span className="lesson-row-topic">{l.topic}</span>{' '}
                  <span className="lesson-row-count">
                    {c.items} mục
                    {c.due > 0 && ` · ${c.due} đến hạn`}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
