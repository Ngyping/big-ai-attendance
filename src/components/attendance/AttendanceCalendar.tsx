'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AttendanceRecord, AttendanceStatus } from '@/lib/types/database'

interface AttendanceCalendarProps {
  records: AttendanceRecord[]
}

const STATUS_STYLE: Record<AttendanceStatus, { bg: string; label: string }> = {
  present:  { bg: 'bg-green-400',  label: '正常' },
  late:     { bg: 'bg-amber-400',  label: '迟到' },
  absent:   { bg: 'bg-red-400',    label: '缺勤' },
  half_day: { bg: 'bg-blue-300',   label: '半天' },
  on_leave: { bg: 'bg-blue-400',   label: '请假' },
  holiday:  { bg: 'bg-purple-400', label: '假日' },
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function AttendanceCalendar({ records }: AttendanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = startOfMonth(currentDate)
  const lastDay = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: firstDay, end: lastDay })
  const startPadding = getDay(firstDay) // 0=Sunday

  const recordMap = new Map(records.map(r => [r.date, r]))

  function prev() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function next() {
    const now = new Date()
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth())) {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={prev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <p className="text-sm font-semibold text-gray-900">
          {format(currentDate, 'yyyy年 M月', { locale: zhCN })}
        </p>
        <Button variant="ghost" size="icon" onClick={next}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Padding */}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {/* Actual days */}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const record = recordMap.get(dateStr)
          const isWeekendDay = getDay(day) === 0 || getDay(day) === 6
          const status = record?.status
          const style = status ? STATUS_STYLE[status] : null

          return (
            <div
              key={dateStr}
              className={cn(
                'relative flex flex-col items-center justify-start pt-1 h-10 rounded-lg',
                isToday(day) && 'ring-2 ring-blue-400 ring-offset-1',
              )}
            >
              <span className={cn(
                'text-xs font-medium',
                isWeekendDay ? 'text-gray-400' : 'text-gray-700',
                isToday(day) && 'text-blue-600 font-bold',
              )}>
                {format(day, 'd')}
              </span>
              {style && (
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${style.bg}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
        {Object.entries(STATUS_STYLE).slice(0, 4).map(([, val]) => (
          <div key={val.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${val.bg}`} />
            <span className="text-xs text-gray-500">{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
