'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LeaveEntitlementWithType } from '@/lib/types/database'
import { currentYearKL } from '@/lib/utils/date'

export function useLeaveBalance(employeeId: string | undefined) {
  const [entitlements, setEntitlements] = useState<LeaveEntitlementWithType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) return

    const supabase = createClient()

    async function fetchBalance() {
      const year = currentYearKL()
      const { data } = await supabase
        .from('leave_entitlements')
        .select('*, leave_type:leave_types(*)')
        .eq('employee_id', employeeId)
        .eq('year', year)
        .order('leave_type(sort_order)')

      setEntitlements((data as LeaveEntitlementWithType[]) ?? [])
      setLoading(false)
    }

    fetchBalance()
  }, [employeeId])

  return { entitlements, loading }
}
