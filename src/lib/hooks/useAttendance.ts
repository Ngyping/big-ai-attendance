'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AttendanceRecord } from '@/lib/types/database'
import { todayKL } from '@/lib/utils/date'

export function useTodayAttendance(employeeId: string | undefined) {
  const [record, setRecord] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!employeeId) return
    const supabase = createClient()
    const today = todayKL()
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single()
    setRecord(data)
    setLoading(false)
  }, [employeeId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { record, loading, refetch }
}

export function useMonthAttendance(employeeId: string | undefined, year: number, month: number) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) return

    const supabase = createClient()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`

    async function fetch() {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date')

      setRecords(data ?? [])
      setLoading(false)
    }

    fetch()
  }, [employeeId, year, month])

  return { records, loading }
}
