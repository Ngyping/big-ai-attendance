'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useApprovalRealtime } from '@/lib/hooks/useRealtime'
import { formatDate } from '@/lib/utils/date'
import { Check, X, Clock } from 'lucide-react'
import type { LeaveRequest, LeaveStatus } from '@/lib/types/database'

interface Props {
  requests: LeaveRequest[]
  managerId: string
}

const STATUS_CONFIG: Record<LeaveStatus, { label: string; class: string }> = {
  pending:   { label: '待审批', class: 'text-amber-600 border-amber-200 bg-amber-50' },
  approved:  { label: '已批准', class: 'text-green-600 border-green-200 bg-green-50' },
  rejected:  { label: '已拒绝', class: 'text-red-600 border-red-200 bg-red-50' },
  cancelled: { label: '已取消', class: 'text-gray-500 border-gray-200 bg-gray-50' },
}

export function ApprovalsClient({ requests: initialRequests, managerId }: Props) {
  const [requests, setRequests] = useState(initialRequests)
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  useApprovalRealtime(managerId, async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('leave_requests')
      .select('*, employee:employees(id, full_name, employee_code, department), leave_type:leave_types(*)')
      .order('created_at')
    setRequests((data as LeaveRequest[]) ?? [])
  })

  const pending = requests.filter(r => r.status === 'pending')
  const processed = requests.filter(r => r.status !== 'pending')

  async function handleApprove(id: string) {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'approved', approved_by: managerId })
        .eq('id', id)
      if (error) { toast.error('操作失败：' + error.message); return }
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved', approved_by: managerId } : r))
      toast.success('已批准申请')
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'rejected', approved_by: managerId, rejection_reason: rejectReason })
        .eq('id', rejectTarget.id)
      if (error) { toast.error('操作失败'); return }
      setRequests(prev => prev.map(r =>
        r.id === rejectTarget.id ? { ...r, status: 'rejected', rejection_reason: rejectReason } : r
      ))
      setRejectTarget(null)
      setRejectReason('')
      toast.success('已拒绝申请')
    } finally {
      setLoading(false)
    }
  }

  async function handleBulkApprove() {
    if (bulkSelected.size === 0) return
    setLoading(true)
    try {
      const supabase = createClient()
      const ids = [...bulkSelected]
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'approved', approved_by: managerId })
        .in('id', ids)
      if (error) { toast.error('批量操作失败'); return }
      setRequests(prev => prev.map(r =>
        ids.includes(r.id) ? { ...r, status: 'approved', approved_by: managerId } : r
      ))
      setBulkSelected(new Set())
      toast.success(`已批量批准 ${ids.length} 条申请`)
    } finally {
      setLoading(false)
    }
  }

  function toggleBulk(id: string) {
    setBulkSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            待审批
            {pending.length > 0 && (
              <Badge className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processed" className="flex-1">已处理</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无待审批申请</p>
            </div>
          ) : (
            <>
              {bulkSelected.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-sm text-blue-700">已选 {bulkSelected.size} 条</span>
                  <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleBulkApprove} disabled={loading}>
                    批量批准
                  </Button>
                </div>
              )}
              {pending.map(req => {
                const emp = req.employee as unknown as { full_name: string; employee_code: string; department: string }
                return (
                  <Card key={req.id} className={`shadow-sm border ${bulkSelected.has(req.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 accent-blue-500"
                          checked={bulkSelected.has(req.id)}
                          onChange={() => toggleBulk(req.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{emp?.full_name}</p>
                              <p className="text-xs text-gray-500">{emp?.employee_code} · {emp?.department}</p>
                            </div>
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 flex-shrink-0">
                              {req.leave_type?.name_zh}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-1">
                            {formatDate(req.start_date)}
                            {req.start_date !== req.end_date && ` — ${formatDate(req.end_date)}`}
                            <span className="ml-2 font-semibold text-blue-600">{req.total_days.toFixed(1)} 天</span>
                          </p>
                          {req.reason && <p className="text-xs text-gray-400 mb-3">{req.reason}</p>}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                              onClick={() => handleApprove(req.id)}
                              disabled={loading}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />批准
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-red-500 border-red-200 hover:bg-red-50"
                              onClick={() => { setRejectTarget(req); setRejectReason('') }}
                              disabled={loading}
                            >
                              <X className="w-3.5 h-3.5 mr-1" />拒绝
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </>
          )}
        </TabsContent>

        <TabsContent value="processed" className="space-y-2 mt-4">
          {processed.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">暂无已处理记录</div>
          ) : (
            processed.map(req => {
              const emp = req.employee as unknown as { full_name: string; employee_code: string }
              const config = STATUS_CONFIG[req.status]
              return (
                <Card key={req.id} className="shadow-sm border-gray-100">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-gray-900">{emp?.full_name}</p>
                          <Badge variant="outline" className={`text-xs ${config.class}`}>{config.label}</Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          {req.leave_type?.name_zh} · {formatDate(req.start_date)} · {req.total_days.toFixed(1)} 天
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝请假申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {(rejectTarget?.employee as unknown as { full_name: string })?.full_name} 的
              {rejectTarget?.leave_type?.name_zh}申请（{rejectTarget?.total_days.toFixed(1)} 天）
            </p>
            <div className="space-y-1.5">
              <Label>拒绝原因 *</Label>
              <Textarea
                placeholder="请填写拒绝原因..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || loading}
            >
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
