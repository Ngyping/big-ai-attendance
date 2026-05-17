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
