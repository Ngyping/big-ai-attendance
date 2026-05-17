'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { LeaveStatus } from '@/lib/types/database'

const STATUS_MESSAGES: Record<LeaveStatus, string> = {
  approved: '你的请假申请已批准',
  rejected: '你的请假申请已被拒绝',
  pending: '请假申请已提交，等待审批',
  cancelled: '请假申请已取消',
}

export function useLeaveRealtime(employeeId: string | undefined, onUpdate?: () => void) {
  useEffect(() => {
    if (!employeeId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`leave-updates-${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leave_requests',
          filter: `employee_id=eq.${employeeId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as LeaveStatus
          const message = STATUS_MESSAGES[newStatus]
          if (message) {
            if (newStatus === 'approved') {
              toast.success(message)
            } else if (newStatus === 'rejected') {
              toast.error(message)
            } else {
              toast.info(message)
            }
          }
          onUpdate?.()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [employeeId, onUpdate])
}

export function useApprovalRealtime(managerId: string | undefined, onUpdate?: () => void) {
  useEffect(() => {
    if (!managerId) return

    const supabase = createClient()

    // Subscribe to new pending requests for this manager's reports
    const channel = supabase
      .channel(`approval-updates-${managerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leave_requests',
        },
        () => {
          toast.info('有新的请假申请待审批')
          onUpdate?.()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [managerId, onUpdate])
}
