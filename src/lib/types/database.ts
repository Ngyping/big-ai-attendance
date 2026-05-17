// Supabase database types — generated manually to match migrations
// Run `npx supabase gen types typescript --project-id YOUR_ID` to regenerate

export type EmployeeRole = 'employee' | 'manager' | 'hr_admin'
export type EmployeeStatus = 'active' | 'inactive' | 'probation'
export type LeaveHalfDay = 'morning' | 'afternoon'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday'
export type OvertimeStatus = 'pending' | 'approved' | 'rejected'

export interface Employee {
  id: string
  auth_user_id: string | null
  employee_code: string
  full_name: string
  email: string
  department: string
  position: string
  join_date: string
  manager_id: string | null
  role: EmployeeRole
  status: EmployeeStatus
  state: string
  created_at: string
}

export interface LeaveType {
  id: string
  name_zh: string
  name_en: string
  code: string
  default_days: number
  requires_attachment: boolean
  is_paid: boolean
  sort_order: number
}

export interface LeaveEntitlement {
  id: string
  employee_id: string
  leave_type_id: string
  year: number
  entitled_days: number
  carried_forward: number
  used_days: number
  pending_days: number
  balance: number // generated column
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  half_day: LeaveHalfDay | null
  total_days: number
  reason: string | null
  attachment_url: string | null
  status: LeaveStatus
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  // Joined fields
  employee?: Employee
  leave_type?: LeaveType
  approver?: Employee
}

export interface AttendanceRecord {
  id: string
  employee_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  clock_in_lat: number | null
  clock_in_lng: number | null
  clock_out_lat: number | null
  clock_out_lng: number | null
  work_hours: number // generated column
  overtime_hours: number
  status: AttendanceStatus
  notes: string | null
}

export interface PublicHoliday {
  id: string
  name_zh: string
  name_en: string
  date: string
  state: string | null
  year: number
  is_replacement: boolean
}

export interface OvertimeRecord {
  id: string
  employee_id: string
  date: string
  start_time: string
  end_time: string
  total_hours: number
  rate_multiplier: number
  status: OvertimeStatus
  approved_by: string | null
  created_at: string
}

// Extended types with joins
export interface LeaveEntitlementWithType extends LeaveEntitlement {
  leave_type: LeaveType
}

export interface AttendanceSummary {
  present: number
  late: number
  absent: number
  on_leave: number
  total_work_hours: number
  total_overtime_hours: number
}
