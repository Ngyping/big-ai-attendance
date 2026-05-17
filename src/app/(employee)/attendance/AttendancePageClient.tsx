'use client'

import { useState } from 'react'
import { ClockButton } from '@/components/attendance/ClockButton'
import { AttendanceCalendar } from '@/components/attendance/AttendanceCalendar'
import { createClient } from '@/lib/supabase/client'
import type { Employee, AttendanceRecord } from '@/lib/types/database'
import { formatKL } from '@/lib/utils/date'

interface Props {
  employee: Employee
  initialTodayRecord: AttendanceRecord | null
  initialMonthRecords: AttendanceRecord[]
}

export function AttendancePageClient({ employee, initialTodayRecord, initialMonthRecords }: Props) {
  const [todayRecord, setTodayRecord] = useState(initialTodayRecord)
  const [monthRecords, setMonthRecords] = useState(initialMonthRecords)

  async function handleClockSuccess() {
    const supabase = createClient()
    const today = formatKL(new Date(), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('date', today)
      .maybeSingle()

    if (data) {
      setTodayRecord(data as AttendanceRecord)
      setMonthRecords(prev => {
        const idx = prev.findIndex(r => r.date === today)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = data as AttendanceRecord
          return next
        }
        return [...prev, data as AttendanceRecord]
      })
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-lg mx-auto w-full">
      {/* Clock section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex justify-center">
        <ClockButton
          employeeId={employee.id}
          record={todayRecord}
          onSuccess={handleClockSuccess}
        />
      </div>

      {/* Calendar */}
      <AttendanceCalendar records={monthRecords} />
    </div>
  )
}
