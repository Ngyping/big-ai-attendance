'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatKL } from '@/lib/utils/date'
import type { AttendanceRecord } from '@/lib/types/database'

interface ClockButtonProps {
  employeeId: string
  record: AttendanceRecord | null
  onSuccess: () => void
}

export function ClockButton({ employeeId, record, onSuccess }: ClockButtonProps) {
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  useEffect(() => {
    const tick = () => setCurrentTime(formatKL(new Date(), 'HH:mm:ss'))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsLoading(false)
      },
      () => setGpsLoading(false),
      { timeout: 5000 }
    )
  }, [])

  const hasClockIn = !!record?.clock_in
  const hasClockOut = !!record?.clock_out
  const isDone = hasClockIn && hasClockOut

  async function handleClock() {
    setLoading(true)
    try {
      const endpoint = hasClockIn ? '/api/attendance/clock-out' : '/api/attendance/clock-in'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          lat: location?.lat,
          lng: location?.lng,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? '操作失败')
        return
      }
      toast.success(hasClockIn ? '下班打卡成功！' : '上班打卡成功！')
      onSuccess()
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Clock display */}
      <div className="text-center">
        <p className="text-5xl font-mono font-bold text-gray-900 tracking-tight">{currentTime}</p>
        <p className="text-sm text-gray-500 mt-1">{formatKL(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* GPS status */}
      <div className="text-center text-xs text-gray-400">
        {gpsLoading ? (
          <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />获取位置中...</span>
        ) : location ? (
          <span className="text-green-500">✓ 已获取位置 ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})</span>
        ) : (
          <span>未开启 GPS</span>
        )}
      </div>

      {/* Main clock button */}
      {isDone ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-32 h-32 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-16 h-16 text-green-400" />
          </div>
          <p className="text-sm font-medium text-green-600">今日打卡完成</p>
        </div>
      ) : (
        <button
          onClick={handleClock}
          disabled={loading}
          className={`
            w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2
            font-bold text-xl text-white shadow-xl transition-all duration-200 active:scale-95
            ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}
            ${hasClockIn
              ? 'bg-gradient-to-br from-orange-400 to-orange-500 shadow-orange-200'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-200'
            }
          `}
        >
          {loading ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : (
            <>
              <span className="text-3xl">{hasClockIn ? '🕔' : '🕘'}</span>
              <span>{hasClockIn ? '下班打卡' : '上班打卡'}</span>
            </>
          )}
        </button>
      )}

      {/* Status row */}
      <div className="flex gap-6 text-sm">
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">上班</p>
          <p className={`font-semibold ${hasClockIn ? 'text-blue-600' : 'text-gray-300'}`}>
            {record?.clock_in ? formatKL(record.clock_in, 'HH:mm') : '--:--'}
          </p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">下班</p>
          <p className={`font-semibold ${hasClockOut ? 'text-orange-500' : 'text-gray-300'}`}>
            {record?.clock_out ? formatKL(record.clock_out, 'HH:mm') : '--:--'}
          </p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">工时</p>
          <p className={`font-semibold ${record?.work_hours ? 'text-gray-900' : 'text-gray-300'}`}>
            {record?.work_hours ? `${record.work_hours.toFixed(1)}h` : '--'}
          </p>
        </div>
      </div>
    </div>
  )
}
