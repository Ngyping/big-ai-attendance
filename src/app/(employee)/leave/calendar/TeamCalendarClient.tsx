'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, parseISO, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LeaveRequest, PublicHoliday } from '@/lib/types/database'

interface Props {
  leaves: LeaveRequest[]
  holidays: PublicHoliday[]
  currentEmployeeId: string
  department: string
}

const LEAVE_COLORS = ['bg-blue-400', 'bg-purple-400', 'bg-pink-400', 'bg-indigo-400', 'bg-teal-400']
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function TeamCalendarClient({ leaves, holidays, currentEmployeeId }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const firstDay = startOfMonth(currentDate)
  const lastDay = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: firstDay, end: lastDay })
  const startPadding = getDay(firstDay)

  // Unique employees from leaves
  const employeeIds = [...new Set(leaves.map(l => l.employee_id))]
  const colorMap = new Map(employeeIds.map((id, i) => [id, LEAVE_COLORS[i % LEAVE_COLORS.length]]))

  // Build day → leaves map
  const dayLeaveMap = new Map<string, LeaveRequest[]>()
  leaves.forEach(leave => {
    let d = parseISO(leave.start_date)
    const end = parseISO(leave.end_date)
    while (d <= end) {
      const key = format(d, 'yyyy-MM-dd')
      if (!dayLeaveMap.has(key)) dayLeaveMap.set(key, [])
      dayLeaveMap.get(key)!.push(leave)
      d = new Date(d.getTime() + 86400000)
    }
  })

  // Build holiday set
  const holidaySet = new Set(holidays.map(h => h.date))

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const selectedLeaves = selectedDay ? (dayLeaveMap.get(selectedDay) ?? []) : []
  const selectedHoliday = selectedDay ? holidays.find(h => h.date === selectedDay) : null

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-base font-semibold text-gray-900">
          {format(currentDate, 'yyyy年 M月')}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: startPadding }).map((_, i) => <div key={`p${i}`} />)}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayLeaves = dayLeaveMap.get(dateStr) ?? []
            const isHoliday = holidaySet.has(dateStr)
            const isWeekendDay = getDay(day) === 0 || getDay(day) === 6

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                className={cn(
                  'flex flex-col items-center py-1 px-0.5 rounded-lg min-h-[52px] transition-colors',
                  selectedDay === dateStr ? 'bg-blue-50 ring-2 ring-blue-300' : 'hover:bg-gray-50',
                  isHoliday && 'bg-red-50',
                )}
              >
                <span className={cn(
                  'text-xs font-medium mb-1',
                  isToday(day) ? 'text-blue-600 font-bold' : isWeekendDay ? 'text-gray-400' : 'text-gray-700',
                  isHoliday && 'text-red-500',
                )}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-col gap-0.5 w-full">
                  {dayLeaves.slice(0, 2).map(leave => (
                    <div
                      key={leave.id}
                      className={`h-1.5 w-full rounded-full ${colorMap.get(leave.employee_id) ?? 'bg-gray-300'} ${leave.employee_id === currentEmployeeId ? 'opacity-100' : 'opacity-60'}`}
                    />
                  ))}
                  {dayLeaves.length > 2 && (
                    <span className="text-[9px] text-gray-400 text-center">+{dayLeaves.length - 2}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day details */}
      {selectedDay && (selectedLeaves.length > 0 || selectedHoliday) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {format(parseISO(selectedDay), 'd MMM yyyy')} 详情
          </h3>
          {selectedHoliday && (
            <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
              <span className="text-red-500 text-xs font-medium">🎌 公共假期</span>
              <span className="text-red-700 text-sm">{selectedHoliday.name_zh}</span>
            </div>
          )}
          {selectedLeaves.map(leave => (
            <div key={leave.id} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colorMap.get(leave.employee_id)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {(leave.employee as unknown as { full_name: string })?.full_name}
                  {leave.employee_id === currentEmployeeId && (
                    <Badge variant="outline" className="ml-1.5 text-xs text-blue-500 border-blue-200">我</Badge>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {(leave.leave_type as unknown as { name_zh: string })?.name_zh} · {leave.total_days.toFixed(1)} 天
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="text-xs text-gray-400 text-center">点击日期查看当日请假详情</div>
    </div>
  )
}
