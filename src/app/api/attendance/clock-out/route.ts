import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { employee_id, lat, lng } = await request.json()

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .eq('auth_user_id', user.id)
      .single()
    if (!employee) return NextResponse.json({ error: '无权限' }, { status: 403 })

    const now = new Date()
    const klOffset = 8 * 60
    const klTime = new Date(now.getTime() + klOffset * 60000)
    const dateStr = klTime.toISOString().split('T')[0]

    // Verify clock_in exists but no clock_out yet
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id, clock_in, clock_out')
      .eq('employee_id', employee_id)
      .eq('date', dateStr)
      .single()

    if (!existing?.clock_in) {
      return NextResponse.json({ error: '尚未打上班卡' }, { status: 400 })
    }
    if (existing.clock_out) {
      return NextResponse.json({ error: '今日已打下班卡' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        clock_out: now.toISOString(),
        clock_out_lat: lat ?? null,
        clock_out_lng: lng ?? null,
      })
      .eq('employee_id', employee_id)
      .eq('date', dateStr)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ record: data })
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
