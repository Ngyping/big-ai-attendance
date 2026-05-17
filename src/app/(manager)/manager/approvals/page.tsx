import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ApprovalsClient } from './ApprovalsClient'
import type { Employee, LeaveRequest } from '@/lib/types/database'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single() as { data: Employee | null }
  if (!employee) redirect('/login')

  // Get pending leave requests for direct reports (or all if hr_admin)
  let query = supabase
    .from('leave_requests')
    .select('*, employee:employees(id, full_name, employee_code, department, position, manager_id), leave_type:leave_types(*)')
    .order('created_at', { ascending: true })

  if (employee.role !== 'hr_admin') {
    // For manager: only see reports' requests
    const { data: reports } = await supabase
      .from('employees')
      .select('id')
      .eq('manager_id', employee.id)
    const reportIds = (reports ?? []).map(r => r.id)
    if (reportIds.length === 0) {
      return (
        <>
          <Header title="审批中心" />
          <div className="p-4 md:p-6 max-w-2xl mx-auto text-center py-12 text-gray-400">
            <p>暂无下属需要审批</p>
          </div>
        </>
      )
    }
    query = query.in('employee_id', reportIds)
  }

  const { data } = await query

  return (
    <>
      <Header title="审批中心" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto w-full">
        <ApprovalsClient
          requests={(data as LeaveRequest[]) ?? []}
          managerId={employee.id}
        />
      </div>
    </>
  )
}
