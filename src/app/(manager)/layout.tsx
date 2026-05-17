import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Employee } from '@/lib/types/database'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single() as { data: Pick<Employee, 'role'> | null }

  if (!employee || !['manager', 'hr_admin'].includes(employee.role)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
