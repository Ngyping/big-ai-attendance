import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { AttendancePageClient } from './AttendancePageClient'
import type { Employee, AttendanceRecord } from '@/lib/types/database'
import { formatKL } from '@/lib/utils/date'

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single() as { data: Employee | null }
  if (!employee) redirect('/login')

  const now = new Date()
  const today = formatKL(now, 'yyyy-MM-dd')
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStr = String(month).padStart(2, '0')

  const [todayRes, monthRes] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('date', today)
      .maybeSingle(),

    supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('date', `${year}-${monthStr}-01`)
      .lte('date', `${year}-${monthStr}-31`)
      .order('date'),
  ])

  return (
    <>
      <Header title="考勤打卡" />
      <AttendancePageClient
        employee={employee}
        initialTodayRecord={todayRes.data as AttendanceRecord | null}
        initialMonthRecords={(monthRes.data as AttendanceRecord[]) ?? []}
      />
    </>
  )
}
