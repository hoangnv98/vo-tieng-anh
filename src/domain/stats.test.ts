import { describe, expect, it } from 'vitest'
import { weekdayIndexMondayFirst } from '../lib/dates'
import {
  calendarWeeks,
  cardStats,
  goalReached,
  pickRemark,
  streak,
  todaySeconds,
  weekMinutes,
} from './stats'
import type { Card, Lesson, StudyDay } from './types'

const TODAY = '2026-11-12' // Thứ Năm

function sd(day: string, seconds: number, reviews = 0, shadowing_count = 0): StudyDay {
  return { user_id: 'u', day, seconds, reviews, shadowing_count }
}

function card(state: Card['state'], stability = 1): Card {
  return {
    id: Math.random().toString(36),
    user_id: 'u',
    item_id: 'i',
    direction: 'en_vi',
    due: '2026-11-12T00:00:00.000Z',
    state,
    reps: 0,
    lapses: 0,
    first_reviewed_at: null,
    suspended: false,
    fsrs: { difficulty: 5, stability, dueAt: '2026-11-12T00:00:00.000Z', lastReviewAt: null },
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
  }
}

function lesson(id: string): Lesson {
  return {
    id,
    user_id: 'u',
    number: 1,
    date: '2026-11-01',
    topic: 't',
    notes: '',
    questions: '',
    mistakes: '',
    created_at: '',
    updated_at: '',
  }
}

describe('todaySeconds / goalReached', () => {
  it('lấy giây của hôm nay, 0 khi chưa có', () => {
    expect(todaySeconds([sd('2026-11-11', 300), sd(TODAY, 125)], TODAY)).toBe(125)
    expect(todaySeconds([sd('2026-11-11', 300)], TODAY)).toBe(0)
    expect(todaySeconds([sd('2026-11-13', 300)], TODAY)).toBe(0)
  })

  it('đạt mục tiêu khi giây ≥ phút × 60', () => {
    expect(goalReached(899, 15)).toBe(false)
    expect(goalReached(900, 15)).toBe(true)
  })
})

describe('streak', () => {
  it('học hôm qua và hôm nay → 2', () => {
    expect(streak([sd('2026-11-11', 60), sd(TODAY, 120)], TODAY)).toEqual({
      current: 2,
      best: 2,
      todayDone: true,
    })
  })

  it('học hôm qua, hôm nay chưa → 1, todayDone = false', () => {
    expect(streak([sd('2026-11-11', 600), sd(TODAY, 59)], TODAY)).toEqual({
      current: 1,
      best: 1,
      todayDone: false,
    })
  })

  it('bỏ hôm qua → 0 nếu hôm nay chưa học, bắt đầu lại 1 nếu hôm nay đã học', () => {
    const past = [sd('2026-11-09', 600), sd('2026-11-10', 600)]
    expect(streak(past, TODAY).current).toBe(0)
    expect(streak([...past, sd(TODAY, 60)], TODAY).current).toBe(1)
  })

  it('ngày dưới 60 giây không tính', () => {
    expect(streak([sd('2026-11-11', 59), sd(TODAY, 30)], TODAY).current).toBe(0)
  })

  it('best = chuỗi dài nhất trong dữ liệu, không phụ thuộc thứ tự', () => {
    const days = [
      sd('2026-10-03', 60),
      sd('2026-10-01', 60),
      sd('2026-10-02', 60),
      sd('2026-10-04', 100),
      sd('2026-10-05', 10), // đứt
      sd('2026-10-06', 60),
      sd('2026-11-11', 60),
      sd(TODAY, 60),
    ]
    expect(streak(days, TODAY)).toEqual({ current: 2, best: 4, todayDone: true })
  })

  it('best bỏ qua ngày sau today', () => {
    const days = [sd('2026-11-13', 60), sd('2026-11-14', 60), sd('2026-11-15', 60), sd(TODAY, 60)]
    expect(streak(days, TODAY)).toEqual({ current: 1, best: 1, todayDone: true })
  })

  it('chuỗi qua ranh giới tháng', () => {
    const days = [sd('2026-10-30', 60), sd('2026-10-31', 60), sd('2026-11-01', 60)]
    expect(streak(days, '2026-11-01')).toEqual({ current: 3, best: 3, todayDone: true })
  })

  it('không có dữ liệu → 0', () => {
    expect(streak([], TODAY)).toEqual({ current: 0, best: 0, todayDone: false })
  })
})

describe('calendarWeeks', () => {
  const weeks = calendarWeeks(
    [sd('2026-11-10', 60, 4, 1), sd('2026-11-11', 30), sd('2026-11-14', 600)],
    TODAY,
  )
  const cells = weeks.flat()

  it('8 hàng × 7 ô = 56 ô', () => {
    expect(weeks).toHaveLength(8)
    for (const row of weeks) expect(row).toHaveLength(7)
    expect(cells).toHaveLength(56)
  })

  it('cột đầu là Thứ Hai, ô cuối là Chủ Nhật tuần hiện tại, ngày liên tiếp', () => {
    for (const row of weeks) expect(weekdayIndexMondayFirst(row[0].day)).toBe(0)
    expect(cells[0].day).toBe('2026-09-21')
    expect(cells[55].day).toBe('2026-11-15')
    expect(weekdayIndexMondayFirst(cells[55].day)).toBe(6)
    expect(weeks[7].map((c) => c.day)).toContain(TODAY)
  })

  it('trạng thái done/partial/none/future và isToday', () => {
    const byDay = new Map(cells.map((c) => [c.day, c]))
    expect(byDay.get('2026-11-10')).toMatchObject({ status: 'done', seconds: 60, reviews: 4, shadowing: 1 })
    expect(byDay.get('2026-11-11')?.status).toBe('partial')
    expect(byDay.get('2026-11-09')?.status).toBe('none')
    expect(byDay.get(TODAY)).toMatchObject({ status: 'none', isToday: true })
    // ngày sau hôm nay luôn future, kể cả có dữ liệu
    expect(byDay.get('2026-11-13')?.status).toBe('future')
    expect(byDay.get('2026-11-14')?.status).toBe('future')
    expect(byDay.get('2026-11-15')?.status).toBe('future')
    expect(cells.filter((c) => c.isToday)).toHaveLength(1)
    expect(cells.filter((c) => c.status === 'future')).toHaveLength(3)
  })

  it('today là Chủ Nhật → không ô future; today là Thứ Hai → 6 ô future', () => {
    expect(calendarWeeks([], '2026-11-15').flat().filter((c) => c.status === 'future')).toHaveLength(0)
    const mon = calendarWeeks([], '2026-11-09')
    expect(mon[7][0].day).toBe('2026-11-09')
    expect(mon.flat().filter((c) => c.status === 'future')).toHaveLength(6)
  })
})

describe('cardStats', () => {
  it('phân loại và cộng lại đúng total', () => {
    const cards = [card(0), card(0), card(1), card(3), card(2, 5), card(2, 21), card(2, 40)]
    const s = cardStats(cards, [lesson('a'), lesson('b')])
    expect(s).toEqual({ total: 7, new: 2, learning: 2, review: 3, mastered: 2, lessonsCount: 2 })
    expect(s.new + s.learning + s.review).toBe(s.total)
  })

  it('rỗng → toàn 0', () => {
    expect(cardStats([], [])).toEqual({ total: 0, new: 0, learning: 0, review: 0, mastered: 0, lessonsCount: 0 })
  })
})

describe('weekMinutes', () => {
  it('tổng phút từ Thứ Hai đến hôm nay, làm tròn xuống', () => {
    const days = [
      sd('2026-11-08', 6000), // Chủ Nhật tuần trước
      sd('2026-11-09', 90),
      sd('2026-11-10', 100),
      sd(TODAY, 50),
    ]
    expect(weekMinutes(days, TODAY)).toBe(4) // 240s
    expect(weekMinutes([], TODAY)).toBe(0)
  })
})

describe('pickRemark', () => {
  it('ưu tiên "Tốt lắm!", rồi "Đều đặn lắm!" khi chuỗi ≥ 7, còn lại null', () => {
    expect(pickRemark({ todayDone: true, goalReached: true, streakCurrent: 10 })).toBe('Tốt lắm!')
    expect(pickRemark({ todayDone: true, goalReached: false, streakCurrent: 7 })).toBe('Đều đặn lắm!')
    expect(pickRemark({ todayDone: false, goalReached: true, streakCurrent: 6 })).toBeNull()
    expect(pickRemark({ todayDone: false, goalReached: false, streakCurrent: 0 })).toBeNull()
  })
})
