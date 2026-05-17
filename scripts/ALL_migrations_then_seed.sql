-- ============================================================
-- BIG AI ATTENDANCE SYSTEM — FULL SETUP SQL
-- Paste this entire file into Supabase SQL Editor and click Run.
-- Includes: 001_schema, 002_functions, 003_rls, 004_triggers, seed
-- ============================================================

-- ============================================================
-- FILE: migrations/001_schema.sql
-- ============================================================
-- =============================================
-- Big AI Sdn Bhd â€” Attendance & Leave System
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


-- ============================================================
-- FILE: migrations/002_functions.sql
-- ============================================================
-- =============================================
-- Migration 002: Business Functions
-- =============================================

-- Helper: get current employee's id from auth.uid()
CREATE OR REPLACE FUNCTION current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Helper: get current employee's role
CREATE OR REPLACE FUNCTION current_employee_role()
RETURNS employee_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- =============================================
-- calculate_leave_days
-- Counts working days between two dates,
-- excluding weekends and public holidays for the given state.
-- If half_day is specified, returns 0.5.
-- =============================================
CREATE OR REPLACE FUNCTION calculate_leave_days(
  p_start_date date,
  p_end_date   date,
  p_state      text,
  p_half_day   leave_half_day DEFAULT NULL
)
RETURNS numeric(4,1)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_days numeric(4,1) := 0;
  v_date date;
BEGIN
  IF p_half_day IS NOT NULL THEN
    RETURN 0.5;
  END IF;

  v_date := p_start_date;
  WHILE v_date <= p_end_date LOOP
    -- Skip Saturday (6) and Sunday (0)
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      -- Skip public holidays (nationwide or state-specific)
      IF NOT EXISTS (
        SELECT 1 FROM public_holidays
        WHERE date = v_date
          AND (state IS NULL OR state = p_state)
      ) THEN
        v_days := v_days + 1;
      END IF;
    END IF;
    v_date := v_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_days;
END;
$$;

-- =============================================
-- get_annual_leave_entitlement
-- Malaysia Employment Act 1955:
--   < 2 years  â†’ 8 days
--   2â€“5 years  â†’ 12 days
--   > 5 years  â†’ 16 days
-- =============================================
CREATE OR REPLACE FUNCTION get_annual_leave_entitlement(
  p_join_date date,
  p_year      int
)
RETURNS numeric(4,1)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_years numeric;
BEGIN
  v_years := EXTRACT(YEAR FROM AGE(make_date(p_year, 12, 31), p_join_date));
  IF v_years < 2 THEN RETURN 8;
  ELSIF v_years < 5 THEN RETURN 12;
  ELSE RETURN 16;
  END IF;
END;
$$;

-- =============================================
-- generate_yearly_entitlements
-- Called on Jan 1 each year (via Edge Function cron).
-- Creates entitlements for all active employees.
-- Carries forward up to 5 unused annual leave days.
-- =============================================
CREATE OR REPLACE FUNCTION generate_yearly_entitlements(p_year int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec          RECORD;
  v_al_id      uuid;
  v_mc_id      uuid;
  v_el_id      uuid;
  v_ul_id      uuid;
  v_al_days    numeric(4,1);
  v_carried    numeric(4,1);
BEGIN
  SELECT id INTO v_al_id FROM leave_types WHERE code = 'AL';
  SELECT id INTO v_mc_id FROM leave_types WHERE code = 'MC';
  SELECT id INTO v_el_id FROM leave_types WHERE code = 'EL';
  SELECT id INTO v_ul_id FROM leave_types WHERE code = 'UL';

  FOR rec IN SELECT * FROM employees WHERE status = 'active' LOOP
    -- Annual Leave with carry-forward (max 5 days)
    v_al_days := get_annual_leave_entitlement(rec.join_date, p_year);
    SELECT LEAST(COALESCE(balance, 0), 5) INTO v_carried
      FROM leave_entitlements
      WHERE employee_id = rec.id
        AND leave_type_id = v_al_id
        AND year = p_year - 1;
    v_carried := COALESCE(v_carried, 0);

    INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days, carried_forward)
    VALUES (rec.id, v_al_id, p_year, v_al_days, v_carried)
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

    -- Medical Leave: 14 days
    INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days)
    VALUES (rec.id, v_mc_id, p_year, 14)
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

    -- Emergency Leave: 2 days
    INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days)
    VALUES (rec.id, v_el_id, p_year, 2)
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

    -- Unpaid Leave: unlimited (represented as 999)
    INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days)
    VALUES (rec.id, v_ul_id, p_year, 999)
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  END LOOP;
END;
$$;


-- ============================================================
-- FILE: migrations/003_rls.sql
-- ============================================================
-- =============================================
-- Migration 003: Row Level Security
-- =============================================

ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays    ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_records   ENABLE ROW LEVEL SECURITY;

-- =============================================
-- employees policies
-- =============================================

-- SELECT: self, direct reports, hr_admin sees all
CREATE POLICY emp_select ON employees
  FOR SELECT USING (
    id = current_employee_id()
    OR manager_id = current_employee_id()
    OR current_employee_role() = 'hr_admin'
  );

-- INSERT: only hr_admin
CREATE POLICY emp_insert ON employees
  FOR INSERT WITH CHECK (current_employee_role() = 'hr_admin');

-- UPDATE: only hr_admin
CREATE POLICY emp_update ON employees
  FOR UPDATE USING (current_employee_role() = 'hr_admin');

-- DELETE: only hr_admin
CREATE POLICY emp_delete ON employees
  FOR DELETE USING (current_employee_role() = 'hr_admin');

-- =============================================
-- leave_types policies (read-only for everyone)
-- =============================================
CREATE POLICY lt_select ON leave_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY lt_write ON leave_types
  FOR ALL USING (current_employee_role() = 'hr_admin');

-- =============================================
-- leave_entitlements policies
-- =============================================
CREATE POLICY le_select ON leave_entitlements
  FOR SELECT USING (
    employee_id = current_employee_id()
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE id = leave_entitlements.employee_id
        AND manager_id = current_employee_id()
    )
    OR current_employee_role() = 'hr_admin'
  );

CREATE POLICY le_insert ON leave_entitlements
  FOR INSERT WITH CHECK (current_employee_role() = 'hr_admin');

CREATE POLICY le_update ON leave_entitlements
  FOR UPDATE USING (current_employee_role() = 'hr_admin');

-- =============================================
-- leave_requests policies
-- =============================================
CREATE POLICY lr_select ON leave_requests
  FOR SELECT USING (
    employee_id = current_employee_id()
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE id = leave_requests.employee_id
        AND manager_id = current_employee_id()
    )
    OR current_employee_role() = 'hr_admin'
  );

-- Employees can submit their own requests
CREATE POLICY lr_insert ON leave_requests
  FOR INSERT WITH CHECK (employee_id = current_employee_id());

-- Employee can cancel their own; manager can approve/reject reports; hr_admin all
CREATE POLICY lr_update ON leave_requests
  FOR UPDATE USING (
    employee_id = current_employee_id()
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE id = leave_requests.employee_id
        AND manager_id = current_employee_id()
    )
    OR current_employee_role() = 'hr_admin'
  );

-- =============================================
-- attendance_records policies
-- =============================================
CREATE POLICY ar_select ON attendance_records
  FOR SELECT USING (
    employee_id = current_employee_id()
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE id = attendance_records.employee_id
        AND manager_id = current_employee_id()
    )
    OR current_employee_role() = 'hr_admin'
  );

-- Employees can insert their own clock-in/out
CREATE POLICY ar_insert ON attendance_records
  FOR INSERT WITH CHECK (employee_id = current_employee_id());

-- Only hr_admin can manually correct records
CREATE POLICY ar_update ON attendance_records
  FOR UPDATE USING (current_employee_role() = 'hr_admin');

-- =============================================
-- public_holidays policies (everyone can read)
-- =============================================
CREATE POLICY ph_select ON public_holidays
  FOR SELECT USING (true);

CREATE POLICY ph_write ON public_holidays
  FOR ALL USING (current_employee_role() = 'hr_admin');

-- =============================================
-- overtime_records policies
-- =============================================
CREATE POLICY ot_select ON overtime_records
  FOR SELECT USING (
    employee_id = current_employee_id()
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE id = overtime_records.employee_id
        AND manager_id = current_employee_id()
    )
    OR current_employee_role() = 'hr_admin'
  );

CREATE POLICY ot_insert ON overtime_records
  FOR INSERT WITH CHECK (employee_id = current_employee_id());

CREATE POLICY ot_update ON overtime_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = overtime_records.employee_id
        AND manager_id = current_employee_id()
    )
    OR current_employee_role() = 'hr_admin'
  );


-- ============================================================
-- FILE: migrations/004_triggers.sql
-- ============================================================
-- =============================================
-- Migration 004: Triggers
-- =============================================

-- =============================================
-- On leave_requests INSERT: pre-deduct pending_days
-- =============================================
CREATE OR REPLACE FUNCTION handle_leave_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE leave_entitlements
  SET pending_days = pending_days + NEW.total_days
  WHERE employee_id   = NEW.employee_id
    AND leave_type_id = NEW.leave_type_id
    AND year          = EXTRACT(YEAR FROM NEW.start_date)::int;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leave_insert
  AFTER INSERT ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_leave_insert();

-- =============================================
-- On leave_requests UPDATE: handle status transitions
-- pending â†’ approved : pending_days â†’ used_days
-- pending â†’ rejected/cancelled : restore pending_days
-- =============================================
CREATE OR REPLACE FUNCTION handle_leave_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE leave_entitlements
    SET pending_days = pending_days - NEW.total_days,
        used_days    = used_days    + NEW.total_days
    WHERE employee_id   = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id
      AND year          = EXTRACT(YEAR FROM NEW.start_date)::int;

    NEW.approved_at := now();

  ELSIF OLD.status = 'pending' AND NEW.status IN ('rejected', 'cancelled') THEN
    UPDATE leave_entitlements
    SET pending_days = pending_days - NEW.total_days
    WHERE employee_id   = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id
      AND year          = EXTRACT(YEAR FROM NEW.start_date)::int;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leave_status_change
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_leave_status_change();

-- =============================================
-- On attendance_records INSERT/UPDATE:
-- Auto-set status based on clock_in time (KL timezone)
-- late = after 09:15 KL
-- =============================================
CREATE OR REPLACE FUNCTION set_attendance_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_local_time  timestamptz;
  v_cutoff_late timestamptz;
  v_work_start  timestamptz;
  v_work_end    timestamptz;
BEGIN
  -- Only auto-set when clock_in provided and status is not manually overridden
  IF NEW.clock_in IS NOT NULL AND NEW.status NOT IN ('on_leave', 'holiday', 'absent', 'half_day') THEN
    v_local_time  := NEW.clock_in AT TIME ZONE 'Asia/Kuala_Lumpur';
    -- 09:15 cutoff for late
    v_cutoff_late := (date_trunc('day', v_local_time) + INTERVAL '9 hours 15 minutes');

    IF v_local_time > v_cutoff_late THEN
      NEW.status := 'late';
    ELSE
      NEW.status := 'present';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_status
  BEFORE INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION set_attendance_status();


-- ============================================================
-- FILE: seed.sql
-- ============================================================
-- =============================================
-- Big AI Sdn Bhd â€” Seed Data
-- Run AFTER migrations 001â€“004
-- NOTE: auth.users must be created via Supabase Auth dashboard or CLI
--       before running this seed. Update auth_user_id values accordingly.
-- =============================================

-- =============================================
-- Leave Types
-- =============================================
INSERT INTO leave_types (id, name_zh, name_en, code, default_days, requires_attachment, is_paid, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'å¹´å‡', 'Annual Leave',    'AL', 8,  false, true,  1),
  ('00000000-0000-0000-0000-000000000002', 'ç—…å‡', 'Medical Leave',   'MC', 14, true,  true,  2),
  ('00000000-0000-0000-0000-000000000003', 'ç´§æ€¥å‡', 'Emergency Leave', 'EL', 2,  false, true,  3),
  ('00000000-0000-0000-0000-000000000004', 'æ— è–ªå‡', 'Unpaid Leave',    'UL', 0,  false, false, 4);

-- =============================================
-- 2025 Malaysia Federal Public Holidays
-- =============================================
INSERT INTO public_holidays (name_zh, name_en, date, state, year, is_replacement) VALUES
  ('å…ƒæ—¦',     'New Year''s Day',                    '2025-01-01', NULL, 2025, false),
  ('å†œåŽ†æ–°å¹´ä¸€', 'Chinese New Year (Day 1)',           '2025-01-29', NULL, 2025, false),
  ('å†œåŽ†æ–°å¹´äºŒ', 'Chinese New Year (Day 2)',           '2025-01-30', NULL, 2025, false),
  ('å¼€æ–‹èŠ‚ä¸€',  'Hari Raya Aidilfitri (Day 1)',       '2025-03-31', NULL, 2025, false),
  ('å¼€æ–‹èŠ‚äºŒ',  'Hari Raya Aidilfitri (Day 2)',       '2025-04-01', NULL, 2025, false),
  ('åŠ³åŠ¨èŠ‚',   'Labour Day',                         '2025-05-01', NULL, 2025, false),
  ('æœ€é«˜å…ƒé¦–è¯žè¾°', 'Yang di-Pertuan Agong Birthday',  '2025-06-02', NULL, 2025, false),
  ('å“ˆèŠèŠ‚',   'Hari Raya Haji',                     '2025-06-06', NULL, 2025, false),
  ('å›žåŽ†æ–°å¹´',  'Awal Muharram',                      '2025-07-27', NULL, 2025, false),
  ('é©¬æ¥è¥¿äºšæ—¥', 'Malaysia Day',                      '2025-09-16', NULL, 2025, false),
  ('å± å¦–èŠ‚',   'Deepavali',                          '2025-10-20', NULL, 2025, false),
  ('åœ£è¯žèŠ‚',   'Christmas Day',                      '2025-12-25', NULL, 2025, false),
  -- Selangor state holidays
  ('å¤§å®æ£®èŠ‚',  'Thaipusam',                          '2025-02-11', 'Selangor', 2025, false),
  ('é›ªå·žå…ƒé¦–è¯žè¾°', 'Selangor Sultan Birthday',        '2025-12-11', 'Selangor', 2025, false),
  -- Johor state holidays
  ('æŸ”ä½›å…ƒé¦–è¯žè¾°', 'Johor Sultan Birthday',           '2025-03-23', 'Johor', 2025, false);

-- =============================================
-- Employees
-- (auth_user_id will be NULL until linked to Supabase Auth accounts)
-- =============================================
INSERT INTO employees (id, auth_user_id, employee_code, full_name, email, department, position, join_date, manager_id, role, status, state) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL, 'EMP001', 'Tan Wei Ming',      'tanweiming@bigai.com.my',    'è¿è¥éƒ¨', 'è¿è¥æ€»ç›‘',   '2020-03-15', NULL,                                        'hr_admin',  'active', 'Selangor'),
  ('10000000-0000-0000-0000-000000000002', NULL, 'EMP002', 'Siti Nurhaliza',    'siti@bigai.com.my',          'å¸‚åœºéƒ¨', 'å¸‚åœºç»ç†',   '2022-06-01', '10000000-0000-0000-0000-000000000001',  'manager',   'active', 'Selangor'),
  ('10000000-0000-0000-0000-000000000003', NULL, 'EMP003', 'Rajesh Kumar',      'rajesh@bigai.com.my',        'æŠ€æœ¯éƒ¨', 'é«˜çº§å¼€å‘',   '2023-01-10', '10000000-0000-0000-0000-000000000005',  'employee',  'active', 'KL'),
  ('10000000-0000-0000-0000-000000000004', NULL, 'EMP004', 'Lim Mei Ling',      'limmeiling@bigai.com.my',    'å¸‚åœºéƒ¨', 'å¸‚åœºä¸“å‘˜',   '2024-08-20', '10000000-0000-0000-0000-000000000002',  'employee',  'active', 'Selangor'),
  ('10000000-0000-0000-0000-000000000005', NULL, 'EMP005', 'Ahmad bin Ismail',  'ahmad@bigai.com.my',         'è¿è¥éƒ¨', 'ä»“åº“ä¸»ç®¡',   '2019-11-01', '10000000-0000-0000-0000-000000000001',  'manager',   'active', 'Johor');

-- =============================================
-- 2025 Leave Entitlements
-- (Based on service years as at 2025-12-31)
-- EMP001: 4.7 yrs â†’ AL=12, carry=3.0
-- EMP002: 2.5 yrs â†’ AL=12, carry=2.0
-- EMP003: 1.9 yrs â†’ AL=8,  carry=0
-- EMP004: 0.3 yrs â†’ AL=8,  carry=0
-- EMP005: 5.1 yrs â†’ AL=16, carry=5.0
-- =============================================

-- EMP001 (Tan Wei Ming)
INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days, carried_forward, used_days, pending_days) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 2025, 12.0, 3.0, 1.0, 0.0),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 2025, 14.0, 0.0, 0.0, 0.0),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 2025, 2.0,  0.0, 0.0, 0.0),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 2025, 999.0,0.0, 0.0, 0.0);

-- EMP002 (Siti Nurhaliza)
INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days, carried_forward, used_days, pending_days) VALUES
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 2025, 12.0, 2.0, 0.0, 5.0),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 2025, 14.0, 0.0, 0.0, 0.0),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 2025, 2.0,  0.0, 0.0, 0.0),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 2025, 999.0,0.0, 0.0, 0.0);

-- EMP003 (Rajesh Kumar)
INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days, carried_forward, used_days, pending_days) VALUES
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 2025, 8.0,  0.0, 0.0, 2.0),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 2025, 14.0, 0.0, 2.0, 0.0),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 2025, 2.0,  0.0, 0.0, 0.0),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 2025, 999.0,0.0, 0.0, 0.0);

-- EMP004 (Lim Mei Ling)
INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days, carried_forward, used_days, pending_days) VALUES
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 2025, 8.0,  0.0, 3.0, 0.0),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 2025, 14.0, 0.0, 0.0, 0.0),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 2025, 2.0,  0.0, 0.0, 0.0),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 2025, 999.0,0.0, 0.0, 0.0);

-- EMP005 (Ahmad bin Ismail)
INSERT INTO leave_entitlements (employee_id, leave_type_id, year, entitled_days, carried_forward, used_days, pending_days) VALUES
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 2025, 16.0, 5.0, 1.0, 0.0),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 2025, 14.0, 0.0, 0.0, 0.0),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 2025, 2.0,  0.0, 1.0, 0.0),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 2025, 999.0,0.0, 0.0, 0.0);

-- =============================================
-- Leave Requests (6 sample records)
-- =============================================
INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by, approved_at, rejection_reason, created_at) VALUES
  -- EMP003: MC approved (2 days)
  ('20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   '2025-05-05', '2025-05-06', 2.0, 'æ„Ÿå†’å‘çƒ§ / Fever and flu',
   'approved', '10000000-0000-0000-0000-000000000005', '2025-05-05 10:00:00+08', NULL,
   '2025-05-05 09:00:00+08'),

  -- EMP004: AL approved (3 days)
  ('20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   '2025-05-12', '2025-05-14', 3.0, 'å®¶åº­æ—…æ¸¸ / Family vacation',
   'approved', '10000000-0000-0000-0000-000000000002', '2025-05-09 14:00:00+08', NULL,
   '2025-05-08 10:00:00+08'),

  -- EMP002: AL pending (5 days)
  ('20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   '2025-06-02', '2025-06-06', 5.0, 'å¹´åº¦å‡æœŸ / Annual vacation',
   'pending', NULL, NULL, NULL,
   '2025-05-10 09:30:00+08'),

  -- EMP005: EL approved (1 day)
  ('20000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003',
   '2025-04-28', '2025-04-28', 1.0, 'å®¶äººä½é™¢ / Family hospitalisation',
   'approved', '10000000-0000-0000-0000-000000000001', '2025-04-29 09:00:00+08', NULL,
   '2025-04-29 08:00:00+08'),

  -- EMP003: AL pending (2 days)
  ('20000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   '2025-07-07', '2025-07-08', 2.0, 'ä¸ªäººäº‹åŠ¡ / Personal matters',
   'pending', NULL, NULL, NULL,
   '2025-05-15 11:00:00+08'),

  -- EMP001: UL rejected (1 day)
  ('20000000-0000-0000-0000-000000000006',
   '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004',
   '2025-03-10', '2025-03-10', 1.0, 'ä¸ªäººäº‹åŠ¡ / Personal matter',
   'rejected', '10000000-0000-0000-0000-000000000001', '2025-03-08 10:00:00+08',
   'é¡¹ç›®äº¤ä»˜æœŸé—´ä¸æ‰¹æ— è–ªå‡ / Unpaid leave not approved during project delivery',
   '2025-03-07 15:00:00+08');

-- =============================================
-- Attendance Records (2025-05-12 ~ 2025-05-16)
-- =============================================

-- EMP001 (Tan Wei Ming) - all normal
INSERT INTO attendance_records (employee_id, date, clock_in, clock_out, status) VALUES
  ('10000000-0000-0000-0000-000000000001', '2025-05-12', '2025-05-12 09:00:00+08', '2025-05-12 18:05:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000001', '2025-05-13', '2025-05-13 08:55:00+08', '2025-05-13 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000001', '2025-05-14', '2025-05-14 09:02:00+08', '2025-05-14 18:10:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000001', '2025-05-15', '2025-05-15 09:00:00+08', '2025-05-15 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000001', '2025-05-16', '2025-05-16 09:05:00+08', '2025-05-16 18:00:00+08', 'present');

-- EMP002 (Siti Nurhaliza) - all normal
INSERT INTO attendance_records (employee_id, date, clock_in, clock_out, status) VALUES
  ('10000000-0000-0000-0000-000000000002', '2025-05-12', '2025-05-12 09:00:00+08', '2025-05-12 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000002', '2025-05-13', '2025-05-13 09:10:00+08', '2025-05-13 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000002', '2025-05-14', '2025-05-14 09:00:00+08', '2025-05-14 18:15:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000002', '2025-05-15', '2025-05-15 09:00:00+08', '2025-05-15 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000002', '2025-05-16', '2025-05-16 08:58:00+08', '2025-05-16 18:05:00+08', 'present');

-- EMP003 (Rajesh Kumar) - late on 13th
INSERT INTO attendance_records (employee_id, date, clock_in, clock_out, status) VALUES
  ('10000000-0000-0000-0000-000000000003', '2025-05-12', '2025-05-12 09:00:00+08', '2025-05-12 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000003', '2025-05-13', '2025-05-13 09:25:00+08', '2025-05-13 18:30:00+08', 'late'),
  ('10000000-0000-0000-0000-000000000003', '2025-05-14', '2025-05-14 09:00:00+08', '2025-05-14 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000003', '2025-05-15', '2025-05-15 09:05:00+08', '2025-05-15 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000003', '2025-05-16', '2025-05-16 09:00:00+08', '2025-05-16 18:00:00+08', 'present');

-- EMP004 (Lim Mei Ling) - on_leave 12-14, present 15-16
INSERT INTO attendance_records (employee_id, date, clock_in, clock_out, status) VALUES
  ('10000000-0000-0000-0000-000000000004', '2025-05-12', NULL, NULL, 'on_leave'),
  ('10000000-0000-0000-0000-000000000004', '2025-05-13', NULL, NULL, 'on_leave'),
  ('10000000-0000-0000-0000-000000000004', '2025-05-14', NULL, NULL, 'on_leave'),
  ('10000000-0000-0000-0000-000000000004', '2025-05-15', '2025-05-15 09:00:00+08', '2025-05-15 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000004', '2025-05-16', '2025-05-16 09:05:00+08', '2025-05-16 18:00:00+08', 'present');

-- EMP005 (Ahmad bin Ismail) - normal
INSERT INTO attendance_records (employee_id, date, clock_in, clock_out, status) VALUES
  ('10000000-0000-0000-0000-000000000005', '2025-05-12', '2025-05-12 08:50:00+08', '2025-05-12 17:55:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000005', '2025-05-13', '2025-05-13 09:00:00+08', '2025-05-13 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000005', '2025-05-14', '2025-05-14 08:55:00+08', '2025-05-14 18:05:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000005', '2025-05-15', '2025-05-15 09:00:00+08', '2025-05-15 18:00:00+08', 'present'),
  ('10000000-0000-0000-0000-000000000005', '2025-05-16', '2025-05-16 09:05:00+08', '2025-05-16 18:10:00+08', 'present');


