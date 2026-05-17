import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { LeaveBalanceCard } from '@/components/dashboard/LeaveBalanceCard'
import { AttendanceSummaryCard } from '@/components/dashboard/AttendanceSummaryCard'
import { RecentLeaveList } from '@/components/dashboard/RecentLeaveList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Calendar } from 'lucide-react'
import type { Employee, LeaveEntitlementWithType, LeaveRequest, AttendanceRecord } from '@/lib/types/database'
import { formatTime, formatKL } from '@/lib/utils/date'

export default async function DashboardPage() {
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
  const now = new Date()
  const month = now.getMonth() + 1
  const monthStr = String(month).padStart(2, '0')
  const today = formatKL(now, 'yyyy-MM-dd')

  // Parallel data fetching
  const [entitlementsRes, recentLeaveRes, monthAttendanceRes, todayAttRes] = await Promise.all([
    supabase
      .from('leave_entitlements')
      .select('*, leave_type:leave_types(*)')
      .eq('employee_id', employee.id)
      .eq('year', year)
      .order('leave_type(sort_order)'),

    supabase
      .from('leave_requests')
      .select('*, leave_type:leave_types(*)')
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
      .limit(3),

    supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('date', `${year}-${monthStr}-01`)
      .lte('date', `${year}-${monthStr}-31`),

    supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('date', today)
      .single(),
  ])

  const entitlements = (entitlementsRes.data as LeaveEntitlementWithType[]) ?? []
  const recentLeave = (recentLeaveRes.data as LeaveRequest[]) ?? []
  const monthAttendance = (monthAttendanceRes.data as AttendanceRecord[]) ?? []
  const todayAtt = todayAttRes.data as AttendanceRecord | null

  // Compute month summary
  const summary = {
    present: monthAttendance.filter(r => r.status === 'present').length,
    late: monthAttendance.filter(r => r.status === 'late').length,
    absent: monthAttendance.filter(r => r.status === 'absent').length,
    onLeave: monthAttendance.filter(r => r.status === 'on_leave').length,
    totalWorkHours: monthAttendance.reduce((sum, r) => sum + (r.work_hours ?? 0), 0),
    overtimeHours: monthAttendance.reduce((sum, r) => sum + (r.overtime_hours ?? 0), 0),
  }

  // Only show AL and MC in dashboard balance cards
  const mainEntitlements = entitlements.filter(e =>
    ['AL', 'MC'].includes(e.leave_type.code)
  )

  const greetingHour = parseInt(formatKL(now, 'HH'), 10)
  const greeting = greetingHour < 12 ? '早安' : greetingHour < 18 ? '午安' : '晚安'

  return (
    <>
      <Header title="主页" subtitle={`${greeting}, ${employee.full_name.split(' ')[0]}`} />

      <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto w-full">
        {/* Greeting — desktop only */}
        <div className="hidden md:block">
          <h2 className="text-xl font-bold text-gray-900">{greeting}，{employee.full_name} 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">{employee.employee_code} · {employee.department} · {employee.position}</p>
        </div>

        {/* Today's Clock Status */}
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">今日状态</p>
                {todayAtt?.clock_in ? (
                  <>
                    <p className="text-lg font-bold">
                      {todayAtt.clock_out ? '已下班' : '工作中'}
                    </p>
                    <p className="text-blue-200 text-sm mt-0.5">
                      上班 {formatTime(todayAtt.clock_in)}
                      {todayAtt.clock_out && ` · 下班 ${formatTime(todayAtt.clock_out)}`}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold">尚未打卡</p>
                )}
              </div>
              <Link href="/attendance">
                <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  <Clock className="w-4 h-4 mr-1.5" />
                  {todayAtt?.clock_in && !todayAtt?.clock_out ? '打下班卡' : '打卡'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Leave Balance Cards */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">假期余额</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mainEntitlements.map(ent => (
              <LeaveBalanceCard key={ent.id} entitlement={ent} />
            ))}
          </div>
        </section>

        {/* Attendance Summary */}
        <AttendanceSummaryCard {...summary} />

        {/* Quick Actions */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">快捷操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/leave/apply">
              <Button variant="outline" className="w-full h-12 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">
                <Calendar className="w-4 h-4 mr-2" />
                申请假期
              </Button>
            </Link>
            <Link href="/attendance">
              <Button variant="outline" className="w-full h-12 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">
                <Clock className="w-4 h-4 mr-2" />
                考勤打卡
              </Button>
            </Link>
          </div>
        </section>

        {/* Recent Leave */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">最近请假记录</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <RecentLeaveList requests={recentLeave} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
