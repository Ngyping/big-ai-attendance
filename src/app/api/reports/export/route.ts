import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCsv } from '@/lib/utils/csvExport'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') ?? String(new Date().getFullYear())
  const month = searchParams.get('month') ?? String(new Date().getMonth() + 1)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // Check HR role
    const { data: emp } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()
    if (emp?.role !== 'hr_admin') return new Response('Forbidden', { status: 403 })

    const monthStr = String(month).padStart(2, '0')
    const startDate = `${year}-${monthStr}-01`
    const endDate = `${year}-${monthStr}-31`

    const [employeesRes, attendanceRes, leavesRes] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active').order('employee_code'),
      supabase.from('attendance_records').select('*').gte('date', startDate).lte('date', endDate),
      supabase
        .from('leave_requests')
        .select('*, leave_type:leave_types(code)')
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate),
    ])

    const employees = employeesRes.data ?? []
    const attendance = attendanceRes.data ?? []
    const leaves = leavesRes.data ?? []

    const rows = employees.map((emp: Record<string, unknown>) => {
      const empAtt = attendance.filter((a: Record<string, unknown>) => a.employee_id === emp.id)
      const empLeaves = leaves.filter((l: Record<string, unknown>) => l.employee_id === emp.id)

      const countLeave = (code: string) => (empLeaves as Record<string, unknown>[])
        .filter(l => (l.leave_type as { code: string })?.code === code)
        .reduce((s: number, l: Record<string, unknown>) => s + (l.total_days as number), 0)

      const present = (empAtt as Record<string, unknown>[]).filter(a => a.status === 'present').length
      const late = (empAtt as Record<string, unknown>[]).filter(a => a.status === 'late').length
      const absent = (empAtt as Record<string, unknown>[]).filter(a => a.status === 'absent').length
      const onLeave = (empAtt as Record<string, unknown>[]).filter(a => a.status === 'on_leave').length
      const workHours = (empAtt as Record<string, unknown>[]).reduce((s: number, a: Record<string, unknown>) => s + ((a.work_hours as number) ?? 0), 0)
      const overtime = (empAtt as Record<string, unknown>[]).reduce((s: number, a: Record<string, unknown>) => s + ((a.overtime_hours as number) ?? 0), 0)

      return {
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department: emp.department,
        position: emp.position,
        present_days: present + late,
        late_count: late,
        absent_days: absent,
        on_leave_days: onLeave,
        work_hours: workHours.toFixed(1),
        overtime_hours: overtime.toFixed(1),
        al_days: countLeave('AL').toFixed(1),
        mc_days: countLeave('MC').toFixed(1),
        el_days: countLeave('EL').toFixed(1),
        ul_days: countLeave('UL').toFixed(1),
      }
    })

    const csv = generateCsv([
      { header: '员工编号', key: 'employee_code' },
      { header: '姓名', key: 'full_name' },
      { header: '部门', key: 'department' },
      { header: '职位', key: 'position' },
      { header: '出勤天数', key: 'present_days' },
      { header: '迟到次数', key: 'late_count' },
      { header: '缺勤天数', key: 'absent_days' },
      { header: '请假天数', key: 'on_leave_days' },
      { header: '工作时数', key: 'work_hours' },
      { header: '加班时数', key: 'overtime_hours' },
      { header: '年假(AL)', key: 'al_days' },
      { header: '病假(MC)', key: 'mc_days' },
      { header: '紧急假(EL)', key: 'el_days' },
      { header: '无薪假(UL)', key: 'ul_days' },
    ], rows as Record<string, unknown>[])

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance_${year}_${monthStr}.csv"`,
      },
    })
  } catch {
    return new Response('Server error', { status: 500 })
  }
}
