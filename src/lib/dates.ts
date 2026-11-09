/** Mọi phép tính "ngày học" dùng múi giờ cố định, không dùng múi giờ thiết bị. */
export const TZ = 'Asia/Ho_Chi_Minh'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const viDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
  timeZone: TZ,
})

/** Ngày địa phương (Asia/Ho_Chi_Minh) của một thời điểm, dạng 'YYYY-MM-DD'. */
export function localDay(d: Date): string {
  return dayFormatter.format(d)
}

/** 00:00:00.000 giờ VN của ngày 'YYYY-MM-DD'. */
export function startOfLocalDay(day: string): Date {
  return new Date(day + 'T00:00:00+07:00')
}

/** 23:59:59.999 giờ VN của ngày 'YYYY-MM-DD'. */
export function endOfLocalDay(day: string): Date {
  return new Date(startOfLocalDay(addDays(day, 1)).getTime() - 1)
}

function parseDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Cộng n ngày vào chuỗi 'YYYY-MM-DD' (tính theo UTC trên chuỗi). */
export function addDays(day: string, n: number): string {
  return new Date(parseDay(day) + n * DAY_MS).toISOString().slice(0, 10)
}

/** "Thứ Bảy, 7/11" */
export function formatDateVi(day: string): string {
  const s = viDateFormatter.format(startOfLocalDay(day))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Nhãn ngắn các thứ, tuần bắt đầu Thứ Hai. */
export const weekdayShortVi = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const

/** Chỉ số thứ trong tuần của ngày 'YYYY-MM-DD': 0 = Thứ Hai … 6 = Chủ Nhật. */
export function weekdayIndexMondayFirst(day: string): number {
  return (new Date(parseDay(day)).getUTCDay() + 6) % 7
}

/** Khoảng thời gian tương đối: "<10 phút", "{n} phút", "1 ngày", "{n} ngày", "{n} tuần", "{n} tháng". */
export function formatRelative(ms: number): string {
  if (ms < 10 * MINUTE_MS) return '<10 phút'
  if (ms < HOUR_MS) return `${Math.round(ms / MINUTE_MS)} phút`
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)} giờ`
  const days = Math.round(ms / DAY_MS)
  if (days >= 60) return `${Math.round(days / 30)} tháng`
  if (days >= 14) return `${Math.round(days / 7)} tuần`
  return `${days} ngày`
}
