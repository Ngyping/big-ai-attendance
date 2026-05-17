-- =============================================
-- Big AI Sdn Bhd — Attendance & Leave System
-- Migration 001: Schema
-- =============================================

-- Enum types
CREATE TYPE employee_role AS ENUM ('employee', 'manager', 'hr_admin');
CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'probation');
CREATE TYPE leave_half_day AS ENUM ('morning', 'afternoon');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'on_leave', 'holiday');
CREATE TYPE overtime_status AS ENUM ('pending', 'approved', 'rejected');

-- =============================================
-- employees
-- =============================================
CREATE TABLE employees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code text UNIQUE NOT NULL,
  full_name     text NOT NULL,
  email         text NOT NULL,
  department    text NOT NULL,
  position      text NOT NULL,
  join_date     date NOT NULL,
  manager_id    uuid REFERENCES employees(id) ON DELETE SET NULL,
  role          employee_role NOT NULL DEFAULT 'employee',
  status        employee_status NOT NULL DEFAULT 'active',
  state         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- leave_types
-- =============================================
CREATE TABLE leave_types (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_zh             text NOT NULL,
  name_en             text NOT NULL,
  code                text UNIQUE NOT NULL,
  default_days        int NOT NULL DEFAULT 0,
  requires_attachment boolean NOT NULL DEFAULT false,
  is_paid             boolean NOT NULL DEFAULT true,
  sort_order          int NOT NULL DEFAULT 0
);

-- =============================================
-- leave_entitlements
-- =============================================
CREATE TABLE leave_entitlements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id   uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year            int NOT NULL,
  entitled_days   numeric(4,1) NOT NULL DEFAULT 0,
  carried_forward numeric(4,1) NOT NULL DEFAULT 0,
  used_days       numeric(4,1) NOT NULL DEFAULT 0,
  pending_days    numeric(4,1) NOT NULL DEFAULT 0,
  UNIQUE(employee_id, leave_type_id, year)
);

ALTER TABLE leave_entitlements
  ADD COLUMN balance numeric(4,1) GENERATED ALWAYS AS
    (entitled_days + carried_forward - used_days - pending_days) STORED;

-- =============================================
-- leave_requests
-- =============================================
CREATE TABLE leave_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id    uuid NOT NULL REFERENCES leave_types(id),
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  half_day         leave_half_day,
  total_days       numeric(4,1) NOT NULL,
  reason           text,
  attachment_url   text,
  status           leave_status NOT NULL DEFAULT 'pending',
  approved_by      uuid REFERENCES employees(id) ON DELETE SET NULL,
  approved_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- attendance_records
-- =============================================
CREATE TABLE attendance_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date           date NOT NULL,
  clock_in       timestamptz,
  clock_out      timestamptz,
  clock_in_lat   numeric(10,7),
  clock_in_lng   numeric(10,7),
  clock_out_lat  numeric(10,7),
  clock_out_lng  numeric(10,7),
  overtime_hours numeric(4,2) NOT NULL DEFAULT 0,
  status         attendance_status NOT NULL DEFAULT 'present',
  notes          text,
  UNIQUE(employee_id, date)
);

ALTER TABLE attendance_records
  ADD COLUMN work_hours numeric(4,2) GENERATED ALWAYS AS (
    CASE
      WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0, 2)
      ELSE 0
    END
  ) STORED;

-- =============================================
-- public_holidays
-- =============================================
CREATE TABLE public_holidays (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_zh        text NOT NULL,
  name_en        text NOT NULL,
  date           date NOT NULL,
  state          text,          -- NULL = nationwide
  year           int NOT NULL,
  is_replacement boolean NOT NULL DEFAULT false
);

-- =============================================
-- overtime_records
-- =============================================
CREATE TABLE overtime_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date            date NOT NULL,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  total_hours     numeric(4,2) NOT NULL,
  rate_multiplier numeric(3,1) NOT NULL,
  status          overtime_status NOT NULL DEFAULT 'pending',
  approved_by     uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_employees_auth_user    ON employees(auth_user_id);
CREATE INDEX idx_employees_manager      ON employees(manager_id);

CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status   ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates    ON leave_requests(start_date, end_date);

CREATE INDEX idx_attendance_emp_date    ON attendance_records(employee_id, date);
CREATE INDEX idx_attendance_date        ON attendance_records(date);

CREATE INDEX idx_entitlements_emp_year  ON leave_entitlements(employee_id, year);

CREATE INDEX idx_holidays_date_state    ON public_holidays(date, state);
CREATE INDEX idx_holidays_year          ON public_holidays(year);
