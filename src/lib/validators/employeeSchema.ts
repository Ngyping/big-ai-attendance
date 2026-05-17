import { z } from 'zod'

export const employeeSchema = z.object({
  employee_code: z.string().min(1, '请填写员工编号').max(20),
  full_name: z.string().min(1, '请填写姓名').max(100),
  email: z.string().email('请输入有效邮箱'),
  department: z.string().min(1, '请选择部门'),
  position: z.string().min(1, '请填写职位').max(100),
  join_date: z.string().min(1, '请选择入职日期'),
  manager_id: z.string().nullable().optional(),
  role: z.enum(['employee', 'manager', 'hr_admin']),
  status: z.enum(['active', 'inactive', 'probation']),
  state: z.string().min(1, '请选择州属'),
})

export type EmployeeForm = z.infer<typeof employeeSchema>
