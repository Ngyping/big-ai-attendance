import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { LeaveHistoryClient } from './LeaveHistoryClient'
import type { Employee, LeaveRequest } from '@/lib/types/database'

export default async function LeaveHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single() as { data: Employee | null }
  if (!employee) redirect('/login')

  const { data } = await supabase
    .from('leave_requests')
    .select('*, leave_type:leave_types(*)')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false })

  return (
    <>
      <Header title="假期记录" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto w-full">
        <LeaveHistoryClient
          requests={(data as LeaveRequest[]) ?? []}
          employeeId={employee.id}
        />
      </div>
    </>
  )
}
