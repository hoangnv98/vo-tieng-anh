import { addDays, weekdayIndexMondayFirst } from '../lib/dates'
import { lessonLanguage } from './languageCore'
import type { Card, Language, Lesson, StudyDay } from './types'

/** Một ngày được tính vào chuỗi khi học ít nhất 60 giây (4.5). */
export const STREAK_MIN_SECONDS = 60
const CALENDAR_WEEKS = 8

/** Gộp study_days theo `day` (phòng trùng bản ghi). */
function byDay(studyDays: StudyDay[]): Map<string, StudyDay> {
  const map = new Map<string, StudyDay>()
  for (const d of studyDays) {
    const prev = map.get(d.day)
    map.set(
      d.day,
      prev
        ? {
            ...prev,
            seconds: prev.seconds + d.seconds,
            reviews: prev.reviews + d.reviews,
            shadowing_count: prev.shadowing_count + d.shadowing_count,
          }
        : d,
    )
  }
  return map
}

function isDone(seconds: number): boolean {
  return seconds >= STREAK_MIN_SECONDS
}

/** Số giây đã học trong đúng ngày `today` ('YYYY-MM-DD'). */
export function todaySeconds(studyDays: StudyDay[], today: string): number {
  return byDay(studyDays).get(today)?.seconds ?? 0
}

/**
 * Chuỗi ngày (4.5): hôm nay chưa đạt thì đếm lùi từ hôm qua.
 * `best` = chuỗi dài nhất trong dữ liệu, chỉ xét ngày `<= today` (bỏ ngày tương lai do lệch đồng hồ).
 */
export function streak(
  studyDays: StudyDay[],
  today: string,
): { current: number; best: number; todayDone: boolean } {
  const days = byDay(studyDays)
  const done = (day: string) => isDone(days.get(day)?.seconds ?? 0)

  const todayDone = done(today)
  let current = 0
  let cursor = todayDone ? today : addDays(today, -1)
  while (done(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  const doneDays = [...days.values()]
    .filter((d) => d.day <= today && isDone(d.seconds))
    .map((d) => d.day)
    .sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of doneDays) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }

  return { current, best: Math.max(best, current), todayDone }
}

/** Mục tiêu ngày đạt khi `todaySeconds >= daily_goal_min * 60`. */
export function goalReached(todaySecs: number, daily_goal_min: number): boolean {
  return todaySecs >= daily_goal_min * 60
}

export type CalendarStatus = 'done' | 'partial' | 'none' | 'future'

export interface CalendarCell {
  day: string
  status: CalendarStatus
  isToday: boolean
  seconds: number
  reviews: number
  shadowing: number
}

function mondayOf(day: string): string {
  return addDays(day, -weekdayIndexMondayFirst(day))
}

/** Lịch 8 tuần (6.10): 8 hàng × 7 ô, cột đầu Thứ Hai, hàng cuối là tuần chứa `today`. */
export function calendarWeeks(studyDays: StudyDay[], today: string): CalendarCell[][] {
  const days = byDay(studyDays)
  const start = addDays(mondayOf(today), -7 * (CALENDAR_WEEKS - 1))
  const weeks: CalendarCell[][] = []
  for (let w = 0; w < CALENDAR_WEEKS; w++) {
    const row: CalendarCell[] = []
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, w * 7 + i)
      const rec = days.get(day)
      const seconds = rec?.seconds ?? 0
      let status: CalendarStatus
      if (day > today) status = 'future'
      else if (isDone(seconds)) status = 'done'
      else if (seconds > 0) status = 'partial'
      else status = 'none'
      row.push({
        day,
        status,
        isToday: day === today,
        seconds,
        reviews: rec?.reviews ?? 0,
        shadowing: rec?.shadowing_count ?? 0,
      })
    }
    weeks.push(row)
  }
  return weeks
}

/** Ngưỡng "Đã thuộc": state 2 và stability ≥ 21 ngày (6.10). */
export const MASTERED_STABILITY_DAYS = 21

/**
 * Thống kê thẻ (6.10); `new + learning + review = total`.
 * (T20) `language` có → chỉ đếm thẻ có `langOf(card) === language` và buổi có `lesson.language === language`.
 * `langOf` nhận **thẻ** (stats không có danh sách item): caller ghép `itemLanguageResolver(lessons)` với tra item theo
 * `card.item_id`; thiếu → mọi thẻ coi là 'en'. Chuỗi ngày/phút/lịch không có tham số ngôn ngữ (4.5 bất biến).
 */
export function cardStats(
  cards: Card[],
  lessons: Lesson[],
  options: { language?: Language; langOf?: (card: Card) => Language } = {},
): {
  total: number
  new: number
  learning: number
  review: number
  mastered: number
  lessonsCount: number
} {
  let fresh = 0
  let learning = 0
  let review = 0
  let mastered = 0
  const { language } = options
  const langOf = options.langOf ?? (() => 'en' as const)
  const counted = language === undefined ? cards : cards.filter((c) => langOf(c) === language)
  const lessonsCount =
    language === undefined ? lessons.length : lessons.filter((l) => lessonLanguage(l) === language).length
  for (const c of counted) {
    if (c.state === 0) fresh += 1
    else if (c.state === 2) {
      review += 1
      const s = c.fsrs.stability
      if (typeof s === 'number' && s >= MASTERED_STABILITY_DAYS) mastered += 1
    } else learning += 1
  }
  return {
    total: counted.length,
    new: fresh,
    learning,
    review,
    mastered,
    lessonsCount,
  }
}

/** Tổng phút (làm tròn xuống) của tuần hiện tại, từ Thứ Hai đến `today`. */
export function weekMinutes(studyDays: StudyDay[], today: string): number {
  const monday = mondayOf(today)
  let seconds = 0
  for (const d of byDay(studyDays).values()) {
    if (d.day >= monday && d.day <= today) seconds += d.seconds
  }
  return Math.floor(seconds / 60)
}

/** Lời nhận xét Charm duy nhất trên Hôm nay (6.3). */
export function pickRemark(args: {
  todayDone: boolean
  goalReached: boolean
  streakCurrent: number
}): 'Tốt lắm!' | 'Đều đặn lắm!' | null {
  if (args.todayDone && args.goalReached) return 'Tốt lắm!'
  if (args.streakCurrent >= 7) return 'Đều đặn lắm!'
  return null
}
