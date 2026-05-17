'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Clock, Calendar, FileText, Users, Settings, CheckSquare, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmployeeRole } from '@/lib/types/database'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: EmployeeRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',         label: '主页',   icon: Home,        roles: ['employee', 'manager', 'hr_admin'] },
  { href: '/attendance',        label: '打卡',   icon: Clock,       roles: ['employee', 'manager', 'hr_admin'] },
  { href: '/leave/apply',       label: '请假',   icon: Calendar,    roles: ['employee', 'manager', 'hr_admin'] },
  { href: '/leave/history',     label: '记录',   icon: FileText,    roles: ['employee', 'manager', 'hr_admin'] },
  { href: '/manager/approvals', label: '审批',   icon: CheckSquare, roles: ['manager', 'hr_admin'] },
  { href: '/admin/employees',   label: '员工',   icon: Users,       roles: ['hr_admin'] },
  { href: '/admin/reports',     label: '报表',   icon: BarChart2,   roles: ['hr_admin'] },
]

interface BottomNavProps {
  role: EmployeeRole
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role))
  // On mobile show max 5 items
  const displayItems = visibleItems.slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex">
        {displayItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-2 gap-1 text-xs transition-colors',
                isActive
                  ? 'text-blue-500'
                  : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'text-blue-500')} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
