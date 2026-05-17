'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Employee } from '@/lib/types/database'

export function useEmployee() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchEmployee() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      setEmployee(data)
      setLoading(false)
    }

    fetchEmployee()
  }, [])

  return { employee, loading }
}
