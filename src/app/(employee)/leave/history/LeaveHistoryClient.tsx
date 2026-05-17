'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/date'
import { useLeaveRealtime } from '@/lib/hooks/useRealtime'
import type { LeaveRequest, LeaveStatus } from '@/lib/types/database'
import { FileText } from 'lucide-react'

interface Props {
  requests: LeaveRequest[]
  employeeId: string
}

const STATUS_CONFIG: Record<LeaveStatus, { label: string; class: string }> = {
  pending:   { label: '待审批', class: 'text-amber-600 border-amber-200 bg-amber-50' },
  approved:  { label: '已批准', class: 'text-green-600 border-green-200 bg-green-50' },
  rejected:  { label: '已拒绝', class: 'text-red-600 border-red-200 bg-red-50' },
  cancelled: { label: '已取消', class: 'text-gray-500 border-gray-200 bg-gray-50' },
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

export function LeaveHistoryClient({ requests: initialRequests, employeeId }: Props) {
  const [requests, setRequests] = useState(initialRequests)
  const [filterYear, setFilterYear] = useState(String(CURRENT_YEAR))
  const [selected, setSelected] = useState<LeaveRequest | null>(null)

  useLeaveRealtime(employeeId, async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('leave_requests')
      .select('*, leave_type:leave_types(*)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
    setRequests((data as LeaveRequest[]) ?? [])
  })

  const filtered = requests.filter(r =>
    new Date(r.start_date).getFullYear() === parseInt(filterYear)
  )

  async function handleCancel(req: LeaveRequest) {
    if (!confirm('确定要取消此请假申请吗？')) return
    const supabase = createClient()
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', req.id)
    if (error) { toast.error('取消失败'); return }
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'cancelled' } : r))
    setSelected(null)
    toast.success('申请已取消')
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterYear} onValueChange={(v) => setFilterYear(v ?? String(CURRENT_YEAR))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map(y => (
              <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">共 {filtered.length} 条记录</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无请假记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => {
            const config = STATUS_CONFIG[req.status]
            return (
              <Card
                key={req.id}
                className="shadow-sm border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelected(req)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {req.leave_type?.name_zh}
                        </p>
                        <Badge variant="outline" className={`text-xs ${config.class}`}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDate(req.start_date)}
                        {req.start_date !== req.end_date && ` — ${formatDate(req.end_date)}`}
                      </p>
                      {req.reason && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{req.reason}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-gray-900">{req.total_days.toFixed(1)}</p>
                      <p className="text-xs text-gray-400">天</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.leave_type?.name_zh} 申请详情</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">状态</span>
                  <Badge variant="outline" className={STATUS_CONFIG[selected.status].class}>
                    {STATUS_CONFIG[selected.status].label}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">日期</span>
                  <span className="font-medium">
                    {formatDate(selected.start_date)}
                    {selected.start_date !== selected.end_date && ` — ${formatDate(selected.end_date)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">天数</span>
                  <span className="font-medium">{selected.total_days.toFixed(1)} 天</span>
                </div>
                {selected.reason && (
                  <div>
                    <span className="text-gray-500 block mb-1">原因</span>
                    <p className="text-gray-900">{selected.reason}</p>
                  </div>
                )}
                {selected.rejection_reason && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-xs text-red-600 font-medium mb-1">拒绝原因</p>
                    <p className="text-red-700">{selected.rejection_reason}</p>
                  </div>
                )}
                {selected.attachment_url && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">附件</span>
                    <a href={selected.attachment_url} target="_blank" className="text-blue-500 hover:underline text-sm">
                      查看证明
                    </a>
                  </div>
                )}
                {selected.status === 'pending' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleCancel(selected)}
                  >
                    取消申请
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
