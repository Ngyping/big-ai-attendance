import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const state = searchParams.get('state')
  const halfDay = searchParams.get('half_day')

  if (!start || !end || !state) {
    return NextResponse.json({ error: '参数缺失' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('calculate_leave_days', {
      p_start_date: start,
      p_end_date: end,
      p_state: state,
      p_half_day: halfDay || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ days: data })
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
