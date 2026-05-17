'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeaveEntitlementWithType } from '@/lib/types/database'

interface LeaveBalanceCardProps {
  entitlement: LeaveEntitlementWithType
}

export function LeaveBalanceCard({ entitlement }: LeaveBalanceCardProps) {
  const { leave_type, entitled_days, carried_forward, used_days, pending_days, balance } = entitlement
  const total = entitled_days + carried_forward
  const usedPercent = total > 0 ? Math.min((used_days / total) * 100, 100) : 0

  // Ring chart values
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (usedPercent / 100) * circumference

  const colorMap: Record<string, string> = {
    AL: 'text-blue-500 stroke-blue-500',
    MC: 'text-emerald-500 stroke-emerald-500',
    EL: 'text-amber-500 stroke-amber-500',
    UL: 'text-gray-400 stroke-gray-400',
  }
  const colorClass = colorMap[leave_type.code] ?? 'text-blue-500 stroke-blue-500'
  const bgClass = {
    AL: 'bg-blue-50',
    MC: 'bg-emerald-50',
    EL: 'bg-amber-50',
    UL: 'bg-gray-50',
  }[leave_type.code] ?? 'bg-blue-50'

  return (
    <Card className={`${bgClass} border-0 shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Ring chart */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-white opacity-60" />
              <circle
                cx="40" cy="40" r={radius}
                fill="none" strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className={colorClass}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-lg font-bold ${colorClass.split(' ')[0]}`}>
                {leave_type.code === 'UL' ? '∞' : balance.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">余天</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{leave_type.name_zh}</p>
            <p className="text-xs text-gray-500 mb-2">{leave_type.name_en}</p>
            <div className="space-y-0.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>总额度</span>
                <span className="font-medium">{leave_type.code === 'UL' ? '无限' : `${total.toFixed(1)} 天`}</span>
              </div>
              <div className="flex justify-between">
                <span>已用</span>
                <span className="font-medium">{used_days.toFixed(1)} 天</span>
              </div>
              {pending_days > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>审批中</span>
                  <span className="font-medium">{pending_days.toFixed(1)} 天</span>
                </div>
              )}
              {carried_forward > 0 && (
                <div className="flex justify-between text-purple-600">
                  <span>结转</span>
                  <span className="font-medium">+{carried_forward.toFixed(1)} 天</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
