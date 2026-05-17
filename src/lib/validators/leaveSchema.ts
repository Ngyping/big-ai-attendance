import { z } from 'zod'

export const leaveApplySchema = z.object({
  leave_type_id: z.string().min(1, '请选择假期类型'),
  start_date: z.string().min(1, '请选择开始日期'),
  end_date: z.string().min(1, '请选择结束日期'),
  half_day: z.enum(['morning', 'afternoon']).optional(),
  reason: z.string().max(500, '原因不超过500字').optional(),
  attachment_url: z.string().optional(),
}).refine(data => data.end_date >= data.start_date, {
  message: '结束日期不能早于开始日期',
  path: ['end_date'],
})

export type LeaveApplyForm = z.infer<typeof leaveApplySchema>

export const leaveRejectSchema = z.object({
  rejection_reason: z.string().min(1, '请填写拒绝理由').max(500),
})

export type LeaveRejectForm = z.infer<typeof leaveRejectSchema>
