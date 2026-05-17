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
-- pending → approved : pending_days → used_days
-- pending → rejected/cancelled : restore pending_days
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
