import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, AlertCircle, Clock, Umbrella } from 'lucide-react'

interface AttendanceSummaryCardProps {
  present: number
  late: number
  absent: number
  onLeave: number
  totalWorkHours: number
  overtimeHours: number
}

export function AttendanceSummaryCard({
  present, late, absent, onLeave, totalWorkHours, overtimeHours
}: AttendanceSummaryCardProps) {
  return (
    <Card className="shadow-sm border-gray-100">
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">本月考勤概览</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{present}</p>
              <p className="text-xs text-gray-500">正常出勤</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{late}</p>
              <p className="text-xs text-gray-500">迟到次数</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{totalWorkHours.toFixed(1)}</p>
              <p className="text-xs text-gray-500">工作时数</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Umbrella className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{onLeave}</p>
              <p className="text-xs text-gray-500">请假天数</p>
            </div>
          </div>
        </div>
        {overtimeHours > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">本月加班 <span className="font-semibold text-gray-900">{overtimeHours.toFixed(1)} 小时</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
