import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SideNav } from '@/components/layout/SideNav'
import { BottomNav } from '@/components/layout/BottomNav'
import type { Employee } from '@/lib/types/database'

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single() as { data: Employee | null }

  if (!employee) redirect('/login')

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      <SideNav
        role={employee.role}
        employeeName={employee.full_name}
        employeeCode={employee.employee_code}
      />
      <main className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
        {children}
      </main>
      <BottomNav role={employee.role} />
    </div>
  )
}
