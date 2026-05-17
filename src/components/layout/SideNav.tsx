'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Clock, Calendar, FileText, CheckSquare,
  Users, Umbrella, BarChart2, Settings, LogOut, Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { EmployeeRole } from '@/lib/types/database'

interface NavSection {
  title: string
  items: {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    roles: EmployeeRole[]
  }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '员工',
    items: [
      { href: '/dashboard',     label: '主页',       icon: Home,        roles: ['employee', 'manager', 'hr_admin'] },
      { href: '/attendance',    label: '考勤打卡',   icon: Clock,       roles: ['employee', 'manager', 'hr_admin'] },
      { href: '/leave/apply',   label: '申请假期',   icon: Calendar,    roles: ['employee', 'manager', 'hr_admin'] },
      { href: '/leave/history', label: '假期记录',   icon: FileText,    roles: ['employee', 'manager', 'hr_admin'] },
      { href: '/leave/calendar',label: '团队日历',   icon: Umbrella,    roles: ['employee', 'manager', 'hr_admin'] },
    ],
  },
  {
    title: '经理',
    items: [
      { href: '/manager/approvals', label: '审批中心', icon: CheckSquare, roles: ['manager', 'hr_admin'] },
      { href: '/manager/team',      label: '团队概览', icon: Users,       roles: ['manager', 'hr_admin'] },
    ],
  },
  {
    title: 'HR 管理',
    items: [
      { href: '/admin/employees', label: '员工管理', icon: Users,     roles: ['hr_admin'] },
      { href: '/admin/holidays',  label: '公共假期', icon: Umbrella,  roles: ['hr_admin'] },
      { href: '/admin/reports',   label: '报表中心', icon: BarChart2, roles: ['hr_admin'] },
      { href: '/admin/settings',  label: '系统设置', icon: Settings,  roles: ['hr_admin'] },
    ],
  },
]

interface SideNavProps {
  role: EmployeeRole
  employeeName: string
  employeeCode: string
}

export function SideNav({ role, employeeName, employeeCode }: SideNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gray-200 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Big AI Sdn Bhd</p>
          <p className="text-xs text-gray-500">考勤管理系统</p>
        </div>
      </div>

      {/* User info */}
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-900 truncate">{employeeName}</p>
        <p className="text-xs text-gray-500">{employeeCode}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => item.roles.includes(role))
          if (visibleItems.length === 0) return null

          return (
            <div key={section.title}>
              <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {section.title}
              </p>
              <div className="space-y-1">
                {visibleItems.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <item.icon className={cn('w-4 h-4', isActive && 'text-blue-500')} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-3" />
          退出登录
        </Button>
      </div>
    </aside>
  )
}
