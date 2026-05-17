'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Search, UserPlus, Edit2 } from 'lucide-react'
import { formatDate } from '@/lib/utils/date'
import type { Employee, EmployeeRole, EmployeeStatus } from '@/lib/types/database'

interface Props { employees: Employee[] }

const ROLE_CONFIG: Record<EmployeeRole, { label: string; class: string }> = {
  employee: { label: '员工', class: 'text-gray-600 border-gray-200 bg-gray-50' },
  manager:  { label: '经理', class: 'text-blue-600 border-blue-200 bg-blue-50' },
  hr_admin: { label: 'HR 管理', class: 'text-purple-600 border-purple-200 bg-purple-50' },
}

const STATUS_CONFIG: Record<EmployeeStatus, { label: string; class: string }> = {
  active:     { label: '在职', class: 'text-green-600 border-green-200 bg-green-50' },
  inactive:   { label: '离职', class: 'text-red-600 border-red-200 bg-red-50' },
  probation:  { label: '试用', class: 'text-amber-600 border-amber-200 bg-amber-50' },
}

export function EmployeesClient({ employees }: Props) {
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const departments = [...new Set(employees.map(e => e.department))].sort()

  const filtered = employees.filter(emp => {
    const matchSearch = !search ||
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase())
    const matchDept = filterDept === 'all' || emp.department === filterDept
    const matchStatus = filterStatus === 'all' || emp.status === filterStatus
    return matchSearch && matchDept && matchStatus
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索员工姓名、编号或邮箱..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterDept} onValueChange={(v) => setFilterDept(v ?? 'all')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="部门" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部部门</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? 'all')}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="active">在职</SelectItem>
            <SelectItem value="probation">试用</SelectItem>
            <SelectItem value="inactive">离职</SelectItem>
          </SelectContent>
        </Select>
        <Button className="bg-blue-500 hover:bg-blue-600 text-white flex-shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />新增员工
        </Button>
      </div>

      <p className="text-sm text-gray-500">共 {filtered.length} 名员工</p>

      {/* Employee cards */}
      <div className="space-y-2">
        {filtered.map(emp => {
          const roleConf = ROLE_CONFIG[emp.role]
          const statusConf = STATUS_CONFIG[emp.status]
          return (
            <Card key={emp.id} className="shadow-sm border-gray-100 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">
                      {emp.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{emp.full_name}</p>
                      <Badge variant="outline" className={`text-xs ${roleConf.class}`}>{roleConf.label}</Badge>
                      <Badge variant="outline" className={`text-xs ${statusConf.class}`}>{statusConf.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                      <span>{emp.employee_code}</span>
                      <span>{emp.department}</span>
                      <span>{emp.position}</span>
                      <span>入职 {formatDate(emp.join_date)}</span>
                      <span>{emp.state}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="flex-shrink-0 text-gray-400 hover:text-blue-500">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
