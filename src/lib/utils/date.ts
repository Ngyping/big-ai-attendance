import { format, parseISO, isWeekend, addDays, isSameDay } from 'date-fns'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import type { PublicHoliday } from '@/lib/types/database'

export const KL_TZ = 'Asia/Kuala_Lumpur'

/** Get current KL time as a Date object */
export function nowKL(): Date {
  return toZonedTime(new Date(), KL_TZ)
}

/** Format a UTC Date/string in KL timezone */
export function formatKL(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(d, KL_TZ, fmt)
}

/** Convert a KL local date+time string to UTC Date for storage */
export function klToUtc(klDateStr: string): Date {
  return fromZonedTime(klDateStr, KL_TZ)
}

/** Format duration in hours to "Xh Ym" */
export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Count working days between two date strings (client-side estimate, excludes weekends + provided holidays) */
export function countWorkingDays(
  startDateStr: string,
  endDateStr: string,
  holidays: PublicHoliday[],
  employeeState: string,
  halfDay?: 'morning' | 'afternoon'
): number {
  if (halfDay) return 0.5

  const holidayDates = holidays
    .filter(h => h.state === null || h.state === employeeState)
    .map(h => h.date)

  let count = 0
  let current = parseISO(startDateStr)
  const end = parseISO(endDateStr)

  while (current <= end) {
    if (!isWeekend(current)) {
      const dateStr = format(current, 'yyyy-MM-dd')
      if (!holidayDates.includes(dateStr)) {
        count++
      }
    }
    current = addDays(current, 1)
  }

  return count
}

/** Check if a given date is a public holiday for the state */
export function isPublicHoliday(
  date: Date,
  holidays: PublicHoliday[],
  state: string
): boolean {
  const dateStr = format(date, 'yyyy-MM-dd')
  return holidays.some(
    h => h.date === dateStr && (h.state === null || h.state === state)
  )
}

/** Get today's date string in KL timezone (YYYY-MM-DD) */
export function todayKL(): string {
  return formatInTimeZone(new Date(), KL_TZ, 'yyyy-MM-dd')
}

/** Format a date string for display */
export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM yyyy')
}

/** Format a datetime string in KL time */
export function formatDateTime(dateTimeStr: string): string {
  return formatInTimeZone(parseISO(dateTimeStr), KL_TZ, 'dd MMM yyyy, HH:mm')
}

/** Format just the time in KL timezone */
export function formatTime(dateTimeStr: string): string {
  return formatInTimeZone(parseISO(dateTimeStr), KL_TZ, 'HH:mm')
}

/** Get the year from a KL-timezone date */
export function currentYearKL(): number {
  return parseInt(formatInTimeZone(new Date(), KL_TZ, 'yyyy'), 10)
}

/** Get month name */
export function monthName(date: Date): string {
  return format(date, 'MMMM yyyy')
}
