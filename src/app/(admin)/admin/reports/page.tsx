import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ReportsClient } from './ReportsClient'
import type { Employee, AttendanceRecord, LeaveRequest } from '@/lib/types/database'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1
  const monthStr = String(month).padStart(2, '0')

  const [employeesRes, attendanceRes, leavesRes] = await Promise.all([
    supabase.from('employees').select('*').eq('status', 'active').order('employee_code'),
    supabase
      .from('attendance_records')
      .select('*')
      .gte('date', `${year}-${monthStr}-01`)
      .lte('date', `${year}-${monthStr}-31`),
    supabase
      .from('leave_requests')
      .select('*, leave_type:leave_types(code, name_zh)')
      .eq('status', 'approved')
      .gte('start_date', `${year}-${monthStr}-01`)
      .lte('end_date', `${year}-${monthStr}-31`),
  ])

  return (
    <>
      <Header title="报表中心" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
        <ReportsClient
          employees={(employeesRes.data as Employee[]) ?? []}
          attendance={(attendanceRes.data as AttendanceRecord[]) ?? []}
          leaves={(leavesRes.data as LeaveRequest[]) ?? []}
          year={year}
          month={month}
        />
      </div>
    </>
  )
}
