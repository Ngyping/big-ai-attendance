import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Employee, LeaveEntitlementWithType, AttendanceRecord } from '@/lib/types/database'
import { formatKL } from '@/lib/utils/date'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: manager } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user.id)
    .single() as { data: Employee | null }
  if (!manager) redirect('/login')

  // Get direct reports
  let teamQuery = supabase.from('employees').select('*').eq('status', 'active')
  if (manager.role !== 'hr_admin') {
    teamQuery = teamQuery.eq('manager_id', manager.id)
  }
  const { data: team } = await teamQuery

  const teamMembers = (team as Employee[]) ?? []
  const year = new Date().getFullYear()
  const now = new Date()
  const month = now.getMonth() + 1
  const monthStr = String(month).padStart(2, '0')

  // Get entitlements and attendance for all team members
  const [entitlementsRes, attendanceRes] = await Promise.all([
    supabase
      .from('leave_entitlements')
      .select('*, leave_type:leave_types(*)')
      .in('employee_id', teamMembers.map(m => m.id))
      .eq('year', year)
      .in('leave_type(code)', ['AL', 'MC']),

    supabase
      .from('attendance_records')
      .select('*')
      .in('employee_id', teamMembers.map(m => m.id))
      .gte('date', `${year}-${monthStr}-01`)
      .lte('date', `${year}-${monthStr}-31`),
  ])

  const allEntitlements = (entitlementsRes.data as LeaveEntitlementWithType[]) ?? []
  const allAttendance = (attendanceRes.data as AttendanceRecord[]) ?? []

  return (
    <>
      <Header title="团队概览" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto w-full">
        <div className="space-y-3">
          {teamMembers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">暂无团队成员</div>
          ) : (
            teamMembers.map(member => {
              const memberEntitlements = allEntitlements.filter(e => e.employee_id === member.id)
              const alEnt = memberEntitlements.find(e => e.leave_type.code === 'AL')
              const memberAttendance = allAttendance.filter(a => a.employee_id === member.id)
              const presentCount = memberAttendance.filter(a => a.status === 'present').length
              const lateCount = memberAttendance.filter(a => a.status === 'late').length
              const totalWorkHours = memberAttendance.reduce((s, a) => s + (a.work_hours ?? 0), 0)
              const overtimeHours = memberAttendance.reduce((s, a) => s + (a.overtime_hours ?? 0), 0)
              const attendanceRate = memberAttendance.length > 0
                ? Math.round(((presentCount + lateCount) / memberAttendance.length) * 100)
                : 0

              return (
                <Card key={member.id} className="shadow-sm border-gray-100">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-semibold text-sm">
                          {member.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{member.full_name}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs flex-shrink-0 ${member.status === 'active' ? 'text-green-600 border-green-200 bg-green-50' : 'text-gray-400'}`}
                          >
                            {member.status === 'active' ? '在职' : member.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">{member.employee_code} · {member.position}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-base font-bold text-green-600">{attendanceRate}%</p>
                        <p className="text-xs text-gray-400">出勤率</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-base font-bold text-amber-600">{lateCount}</p>
                        <p className="text-xs text-gray-400">迟到</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-base font-bold text-blue-600">{totalWorkHours.toFixed(0)}h</p>
                        <p className="text-xs text-gray-400">工时</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-base font-bold text-gray-700">{alEnt?.balance.toFixed(1) ?? '-'}</p>
                        <p className="text-xs text-gray-400">年假余</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
