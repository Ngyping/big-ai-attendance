import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { employee_id, lat, lng } = await request.json()

    // Verify the employee belongs to this auth user
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .eq('auth_user_id', user.id)
      .single()
    if (!employee) return NextResponse.json({ error: '无权限' }, { status: 403 })

    const now = new Date()
    // Date in KL timezone (UTC+8)
    const klOffset = 8 * 60
    const klTime = new Date(now.getTime() + klOffset * 60000)
    const dateStr = klTime.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(
        {
          employee_id,
          date: dateStr,
          clock_in: now.toISOString(),
          clock_in_lat: lat ?? null,
          clock_in_lng: lng ?? null,
        },
        { onConflict: 'employee_id,date', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) {
      // Already clocked in today
      if (error.code === '23505') {
        return NextResponse.json({ error: '今日已打上班卡' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ record: data })
  } catch (err) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
