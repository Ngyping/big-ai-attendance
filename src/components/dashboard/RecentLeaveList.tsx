import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import type { LeaveRequest } from '@/lib/types/database'
import { formatDate } from '@/lib/utils/date'

interface RecentLeaveListProps {
  requests: LeaveRequest[]
}

const STATUS_CONFIG = {
  pending:   { label: '待审批', variant: 'outline' as const, class: 'text-amber-600 border-amber-200 bg-amber-50' },
  approved:  { label: '已批准', variant: 'outline' as const, class: 'text-green-600 border-green-200 bg-green-50' },
  rejected:  { label: '已拒绝', variant: 'outline' as const, class: 'text-red-600 border-red-200 bg-red-50' },
  cancelled: { label: '已取消', variant: 'outline' as const, class: 'text-gray-500 border-gray-200 bg-gray-50' },
}

export function RecentLeaveList({ requests }: RecentLeaveListProps) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        暂无请假记录
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {requests.map(req => {
        const config = STATUS_CONFIG[req.status]
        return (
          <div key={req.id} className="flex items-center gap-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-gray-900">
                  {req.leave_type?.name_zh ?? '假期'}
                </p>
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${config.class}`}>
                  {config.label}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                {formatDate(req.start_date)}
                {req.start_date !== req.end_date && ` — ${formatDate(req.end_date)}`}
                {' · '}{req.total_days.toFixed(1)} 天
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
        )
      })}
      <Link href="/leave/history" className="block text-center text-xs text-blue-500 hover:underline pt-1">
        查看全部记录
      </Link>
    </div>
  )
}
