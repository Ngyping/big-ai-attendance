import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { EmployeesClient } from './EmployeesClient'
import type { Employee } from '@/lib/types/database'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('employees')
    .select('*')
    .order('employee_code')

  return (
    <>
      <Header title="员工管理" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
        <EmployeesClient employees={(data as Employee[]) ?? []} />
      </div>
    </>
  )
}
