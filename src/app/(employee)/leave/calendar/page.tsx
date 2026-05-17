import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { TeamCalendarClient } from './TeamCalendarClient'
import type { Employee, LeaveRequest, PublicHoliday } from '@/lib/types/database'

export default async function TeamCalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single() as { data: Employee | null }
  if (!employee) redirect('/login')

  const year = new Date().getFullYear()

  // Get all approved leaves for employees in the same department
  const [deptLeavesRes, holidaysRes, deptEmployeesRes] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('*, employee:employees(full_name, department), leave_type:leave_types(name_zh, code)')
      .eq('status', 'approved')
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`)
      .order('start_date'),

    supabase
      .from('public_holidays')
      .select('*')
      .eq('year', year),

    supabase
      .from('employees')
      .select('id, full_name, department')
      .eq('department', employee.department)
      .eq('status', 'active'),
  ])

  return (
    <>
      <Header title="团队日历" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto w-full">
        <TeamCalendarClient
          leaves={(deptLeavesRes.data as LeaveRequest[]) ?? []}
          holidays={(holidaysRes.data as PublicHoliday[]) ?? []}
          currentEmployeeId={employee.id}
          department={employee.department}
        />
      </div>
    </>
  )
}
