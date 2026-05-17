'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { leaveApplySchema, type LeaveApplyForm as FormData } from '@/lib/validators/leaveSchema'
import { countWorkingDays, formatDate } from '@/lib/utils/date'
import type { LeaveType, LeaveEntitlementWithType, PublicHoliday } from '@/lib/types/database'

interface LeaveApplyFormProps {
  leaveTypes: LeaveType[]
  entitlements: LeaveEntitlementWithType[]
  holidays: PublicHoliday[]
  employeeId: string
  employeeState: string
}

export function LeaveApplyForm({
  leaveTypes, entitlements, holidays, employeeId, employeeState
}: LeaveApplyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [calculatedDays, setCalculatedDays] = useState<number>(0)
  const [selectedType, setSelectedType] = useState<LeaveType | null>(null)
  const [selectedEntitlement, setSelectedEntitlement] = useState<LeaveEntitlementWithType | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(leaveApplySchema),
  })

  const watchLeaveType = watch('leave_type_id')
  const watchStart = watch('start_date')
  const watchEnd = watch('end_date')
  const watchHalfDay = watch('half_day')

  useEffect(() => {
    const type = leaveTypes.find(t => t.id === watchLeaveType)
    setSelectedType(type ?? null)
    const ent = entitlements.find(e => e.leave_type_id === watchLeaveType)
    setSelectedEntitlement(ent ?? null)
  }, [watchLeaveType, leaveTypes, entitlements])

  useEffect(() => {
    if (watchStart && watchEnd) {
      const days = countWorkingDays(watchStart, watchEnd, holidays, employeeState, watchHalfDay as 'morning' | 'afternoon' | undefined)
      setCalculatedDays(days)
    } else {
      setCalculatedDays(0)
    }
  }, [watchStart, watchEnd, watchHalfDay, holidays, employeeState])

  async function handleFileUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('文件不能超过 5MB')
      return
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('仅支持 JPG、PNG 或 PDF 文件')
      return
    }
    setUploadLoading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${employeeId}/${Date.now()}.${ext}`
      const { error, data } = await supabase.storage
        .from('leave-attachments')
        .upload(path, file)
      if (error) { toast.error('上传失败：' + error.message); return }
      const { data: urlData } = supabase.storage.from('leave-attachments').getPublicUrl(path)
      setValue('attachment_url', urlData.publicUrl)
      setUploadedFile(file)
      toast.success('附件上传成功')
    } finally {
      setUploadLoading(false)
    }
  }

  async function onSubmit(data: FormData) {
    // MC > 2 days requires attachment
    if (selectedType?.code === 'MC' && calculatedDays > 2 && !data.attachment_url) {
      toast.error('病假超过2天须上传医疗证明')
      return
    }
    // Check balance
    if (selectedEntitlement && selectedType?.code !== 'UL' && calculatedDays > selectedEntitlement.balance) {
      toast.error(`余额不足，剩余 ${selectedEntitlement.balance.toFixed(1)} 天`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/leave/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, total_days: calculatedDays, employee_id: employeeId }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? '提交失败'); return }
      toast.success('请假申请已提交！')
      router.push('/leave/history')
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const balanceOk = !selectedEntitlement || selectedType?.code === 'UL' || calculatedDays <= selectedEntitlement.balance
  const today = new Date().toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Leave Type */}
      <div className="space-y-1.5">
        <Label>假期类型 *</Label>
        <Select onValueChange={(v) => { if (v) setValue('leave_type_id', v as string) }}>
          <SelectTrigger>
            <SelectValue placeholder="请选择假期类型" />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map(type => {
              const ent = entitlements.find(e => e.leave_type_id === type.id)
              return (
                <SelectItem key={type.id} value={type.id}>
                  <span className="flex items-center gap-2">
                    {type.name_zh}
                    {ent && type.code !== 'UL' && (
                      <span className="text-xs text-gray-400">（余 {ent.balance.toFixed(1)} 天）</span>
                    )}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {errors.leave_type_id && <p className="text-xs text-red-500">{errors.leave_type_id.message}</p>}
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start_date">开始日期 *</Label>
          <Input id="start_date" type="date" min={today} {...register('start_date')} />
          {errors.start_date && <p className="text-xs text-red-500">{errors.start_date.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end_date">结束日期 *</Label>
          <Input id="end_date" type="date" min={(watchStart as string) || today} {...register('end_date')} />
          {errors.end_date && <p className="text-xs text-red-500">{errors.end_date.message}</p>}
        </div>
      </div>

      {/* Half day */}
      <div className="space-y-1.5">
        <Label>半天假（可选）</Label>
        <Select onValueChange={v => setValue('half_day', v as 'morning' | 'afternoon')}>
          <SelectTrigger>
            <SelectValue placeholder="全天假期（默认）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="morning">上午半天</SelectItem>
            <SelectItem value="afternoon">下午半天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Days calculator */}
      {calculatedDays > 0 && (
        <Card className={`border ${balanceOk ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  扣除 <span className={balanceOk ? 'text-blue-600' : 'text-red-600'}>{calculatedDays.toFixed(1)} 天</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  已排除周末及公共假期
                  {selectedEntitlement && selectedType?.code !== 'UL' && (
                    <> · 剩余余额 {(selectedEntitlement.balance - calculatedDays).toFixed(1)} 天</>
                  )}
                </p>
              </div>
              {!balanceOk && <AlertCircle className="w-5 h-5 text-red-500" />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reason */}
      <div className="space-y-1.5">
        <Label htmlFor="reason">请假原因</Label>
        <Textarea
          id="reason"
          placeholder="请简要描述请假原因..."
          rows={3}
          {...register('reason')}
        />
      </div>

      {/* File upload for MC */}
      {selectedType?.code === 'MC' && (
        <div className="space-y-1.5">
          <Label>
            医疗证明
            {calculatedDays > 2 && <Badge variant="destructive" className="ml-2 text-xs">必须上传</Badge>}
          </Label>
          {uploadedFile ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-sm text-green-700 flex-1 truncate">{uploadedFile.name}</span>
              <button
                type="button"
                onClick={() => { setUploadedFile(null); setValue('attachment_url', '') }}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
              {uploadLoading ? (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-700">点击上传医疗证明</p>
                <p className="text-xs text-gray-400">支持 JPG、PNG、PDF，最大 5MB</p>
              </div>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
            </label>
          )}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full bg-blue-500 hover:bg-blue-600"
        disabled={loading || calculatedDays === 0 || !balanceOk}
      >
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</> : '提交请假申请'}
      </Button>
    </form>
  )
}
