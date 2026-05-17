import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { LeaveApplyForm } from '@/components/leave/LeaveApplyForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Employee, LeaveType, LeaveEntitlementWithType, PublicHoliday } from '@/lib/types/database'

export default async function LeaveApplyPage() {
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

  const [typesRes, entitlementsRes, holidaysRes] = await Promise.all([
    supabase.from('leave_types').select('*').order('sort_order'),
    supabase
      .from('leave_entitlements')
      .select('*, leave_type:leave_types(*)')
      .eq('employee_id', employee.id)
      .eq('year', year),
    supabase
      .from('public_holidays')
      .select('*')
      .eq('year', year),
  ])

  return (
    <>
      <Header title="申请假期" />
      <div className="p-4 md:p-6 max-w-lg mx-auto w-full">
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">新建请假申请</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveApplyForm
              leaveTypes={(typesRes.data as LeaveType[]) ?? []}
              entitlements={(entitlementsRes.data as LeaveEntitlementWithType[]) ?? []}
              holidays={(holidaysRes.data as PublicHoliday[]) ?? []}
              employeeId={employee.id}
              employeeState={employee.state}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
