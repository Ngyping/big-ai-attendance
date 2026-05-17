import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await request.json()
    const { employee_id, leave_type_id, start_date, end_date, half_day, reason, attachment_url } = body

    // Verify ownership
    const { data: employee } = await supabase
      .from('employees')
      .select('id, state')
      .eq('id', employee_id)
      .eq('auth_user_id', user.id)
      .single()
    if (!employee) return NextResponse.json({ error: '无权限' }, { status: 403 })

    // Calculate exact days using Postgres function
    const { data: daysData, error: daysError } = await supabase
      .rpc('calculate_leave_days', {
        p_start_date: start_date,
        p_end_date: end_date,
        p_state: employee.state,
        p_half_day: half_day ?? null,
      })

    if (daysError) return NextResponse.json({ error: '天数计算失败' }, { status: 500 })
    const total_days = daysData as number

    if (total_days <= 0) {
      return NextResponse.json({ error: '所选日期无有效工作日' }, { status: 400 })
    }

    // Check balance (skip for UL)
    const { data: leaveType } = await supabase
      .from('leave_types')
      .select('code')
      .eq('id', leave_type_id)
      .single()

    if (leaveType?.code !== 'UL') {
      const year = new Date(start_date).getFullYear()
      const { data: entitlement } = await supabase
        .from('leave_entitlements')
        .select('balance')
        .eq('employee_id', employee_id)
        .eq('leave_type_id', leave_type_id)
        .eq('year', year)
        .single()

      if (!entitlement || entitlement.balance < total_days) {
        return NextResponse.json({
          error: `余额不足，剩余 ${entitlement?.balance?.toFixed(1) ?? 0} 天`,
        }, { status: 400 })
      }
    }

    // Insert leave request (trigger handles pending_days update)
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        half_day: half_day ?? null,
        total_days,
        reason: reason ?? null,
        attachment_url: attachment_url ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ request: data })
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
