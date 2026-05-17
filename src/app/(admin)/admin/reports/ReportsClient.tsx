'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, BarChart2, Users, Clock } from 'lucide-react'
import { generateCsv, downloadCsv } from '@/lib/utils/csvExport'
import type { Employee, AttendanceRecord, LeaveRequest } from '@/lib/types/database'

interface Props {
  employees: Employee[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
  year: number
  month: number
}

interface EmployeeReport {
  employee: Employee
  workDays: number
  presentDays: number
  lateDays: number
  absentDays: number
  onLeaveDays: number
  totalWorkHours: number
  overtimeHours: number
  alDays: number
  mcDays: number
  elDays: number
  ulDays: number
}

export function ReportsClient({ employees, attendance, leaves, year, month }: Props) {
  const [exporting, setExporting] = useState(false)

  function buildReport(): EmployeeReport[] {
    return employees.map(emp => {
      const empAtt = attendance.filter(a => a.employee_id === emp.id)
      const empLeaves = leaves.filter(l => l.employee_id === emp.id)

      const countLeave = (code: string) => empLeaves
        .filter(l => (l.leave_type as unknown as { code: string })?.code === code)
        .reduce((s, l) => s + l.total_days, 0)

      return {
        employee: emp,
        workDays: empAtt.length,
        presentDays: empAtt.filter(a => a.status === 'present').length,
        lateDays: empAtt.filter(a => a.status === 'late').length,
        absentDays: empAtt.filter(a => a.status === 'absent').length,
        onLeaveDays: empAtt.filter(a => a.status === 'on_leave').length,
        totalWorkHours: empAtt.reduce((s, a) => s + (a.work_hours ?? 0), 0),
        overtimeHours: empAtt.reduce((s, a) => s + (a.overtime_hours ?? 0), 0),
        alDays: countLeave('AL'),
        mcDays: countLeave('MC'),
        elDays: countLeave('EL'),
        ulDays: countLeave('UL'),
      }
    })
  }

  function handleExport() {
    setExporting(true)
    const report = buildReport()
    const monthName = format(new Date(year, month - 1, 1), 'yyyy年M月')

    const csv = generateCsv([
      { header: '员工编号', key: 'code' },
      { header: '姓名', key: 'name' },
      { header: '部门', key: 'dept' },
      { header: '职位', key: 'position' },
      { header: '出勤天数', key: 'present' },
      { header: '迟到次数', key: 'late' },
      { header: '缺勤天数', key: 'absent' },
      { header: '请假天数', key: 'onLeave' },
      { header: '工作时数', key: 'workHours' },
      { header: '加班时数', key: 'overtime' },
      { header: '年假天数', key: 'al' },
      { header: '病假天数', key: 'mc' },
      { header: '紧急假天数', key: 'el' },
      { header: '无薪假天数', key: 'ul' },
    ], report.map(r => ({
      code: r.employee.employee_code,
      name: r.employee.full_name,
      dept: r.employee.department,
      position: r.employee.position,
      present: r.presentDays + r.lateDays,
      late: r.lateDays,
      absent: r.absentDays,
      onLeave: r.onLeaveDays,
      workHours: r.totalWorkHours.toFixed(1),
      overtime: r.overtimeHours.toFixed(1),
      al: r.alDays.toFixed(1),
      mc: r.mcDays.toFixed(1),
      el: r.elDays.toFixed(1),
      ul: r.ulDays.toFixed(1),
    })))

    downloadCsv(`考勤报表_${monthName}.csv`, csv)
    setTimeout(() => setExporting(false), 1000)
  }

  const report = buildReport()
  const totals = {
    present: report.reduce((s, r) => s + r.presentDays + r.lateDays, 0),
    late: report.reduce((s, r) => s + r.lateDays, 0),
    absent: report.reduce((s, r) => s + r.absentDays, 0),
    workHours: report.reduce((s, r) => s + r.totalWorkHours, 0),
    overtime: report.reduce((s, r) => s + r.overtimeHours, 0),
  }

  const monthLabel = format(new Date(year, month - 1, 1), 'yyyy年M月')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{monthLabel}考勤报表</h2>
          <p className="text-sm text-gray-500">{employees.length} 名员工</p>
        </div>
        <Button
          className="bg-blue-500 hover:bg-blue-600 text-white"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download className="w-4 h-4 mr-2" />
          {exporting ? '导出中...' : '导出 CSV'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{totals.present}</p>
            <p className="text-xs text-gray-500">总出勤次数</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-3 text-center">
            <BarChart2 className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{totals.late}</p>
            <p className="text-xs text-gray-500">总迟到次数</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{totals.workHours.toFixed(0)}h</p>
            <p className="text-xs text-gray-500">总工作时数</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{totals.overtime.toFixed(1)}h</p>
            <p className="text-xs text-gray-500">总加班时数</p>
          </CardContent>
        </Card>
      </div>

      {/* Detail table */}
      <Card className="shadow-sm border-gray-100 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">员工明细</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="text-left px-4 py-2 font-medium">员工</th>
                <th className="text-center px-3 py-2 font-medium">出勤</th>
                <th className="text-center px-3 py-2 font-medium">迟到</th>
                <th className="text-center px-3 py-2 font-medium">缺勤</th>
                <th className="text-center px-3 py-2 font-medium">工时(h)</th>
                <th className="text-center px-3 py-2 font-medium">加班(h)</th>
                <th className="text-center px-3 py-2 font-medium">假期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.map(r => (
                <tr key={r.employee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.employee.full_name}</p>
                    <p className="text-xs text-gray-400">{r.employee.employee_code} · {r.employee.department}</p>
                  </td>
                  <td className="text-center px-3 py-3 text-green-600 font-medium">{r.presentDays + r.lateDays}</td>
                  <td className="text-center px-3 py-3">
                    {r.lateDays > 0 ? (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">{r.lateDays}</Badge>
                    ) : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="text-center px-3 py-3">
                    {r.absentDays > 0 ? (
                      <Badge variant="outline" className="text-xs text-red-600 border-red-200">{r.absentDays}</Badge>
                    ) : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="text-center px-3 py-3 text-gray-700">{r.totalWorkHours.toFixed(1)}</td>
                  <td className="text-center px-3 py-3 text-purple-600">{r.overtimeHours.toFixed(1)}</td>
                  <td className="text-center px-3 py-3 text-blue-600">
                    {(r.alDays + r.mcDays + r.elDays + r.ulDays).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
