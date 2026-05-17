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
--   < 2 years  → 8 days
--   2–5 years  → 12 days
--   > 5 years  → 16 days
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
