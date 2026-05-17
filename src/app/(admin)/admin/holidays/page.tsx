import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { HolidaysClient } from './HolidaysClient'
import type { PublicHoliday } from '@/lib/types/database'

export default async function HolidaysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('public_holidays')
    .select('*')
    .eq('year', year)
    .order('date')

  return (
    <>
      <Header title="公共假期管理" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto w-full">
        <HolidaysClient holidays={(data as PublicHoliday[]) ?? []} year={year} />
      </div>
    </>
  )
}
