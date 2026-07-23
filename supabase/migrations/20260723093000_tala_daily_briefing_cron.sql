-- ===========================================================================
-- TALA — "wake her up": autonomous MORNING BRIEFING (phase 1 autonomy)
-- Runs on a schedule via pg_cron, no webhook, no keys, no edge function.
-- Reads the same cms_data payload the site + tala-chat already use, computes
-- the day's rundown in Postgres, and inserts it into tala_briefings so the
-- admin console shows it every morning without anyone clicking a button.
--
-- Safe to re-run: function is CREATE OR REPLACE; the schedule is deleted then
-- re-created by name (idempotent).
-- ===========================================================================

-- 1) Enable the pg_cron extension (must exist before we can read cron.job
--    or call cron.schedule). If this line errors with "permission denied",
--    enable pg_cron from the Supabase Dashboard → Extensions page instead.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) The briefing generator. Mirrors OperationsDashboard.tsx math.
CREATE OR REPLACE FUNCTION public.generate_tala_briefing()
RETURNS public.tala_briefings AS $$
DECLARE
  cms          JSONB := '{}'::jsonb;
  ops          JSONB;
  today        TEXT  := to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD');
  arrivals     INT;
  departures   INT;
  tour_today   INT;
  bikes_out    INT;
  in_house     INT;
  revenue_30   NUMERIC := 0;
  expenses_30  NUMERIC := 0;
  unpaid_pay   NUMERIC := 0;
  active_staff INT;
  highlights   TEXT[] := '{}';
  summary      TEXT;
  inserted     public.tala_briefings;
BEGIN
  SELECT value INTO cms
  FROM public.cms_data
  WHERE key = 'marina_terrace_payload'
  LIMIT 1;

  ops := COALESCE(cms -> 'operations', '{}'::jsonb);

  SELECT count(*) INTO arrivals   FROM jsonb_array_elements(ops -> 'bookings') b
    WHERE b ->> 'checkIn' = today AND COALESCE(b ->> 'status', '') <> 'cancelled';
  SELECT count(*) INTO departures FROM jsonb_array_elements(ops -> 'bookings') b
    WHERE b ->> 'checkOut' = today AND COALESCE(b ->> 'status', '') <> 'cancelled';
  SELECT count(*) INTO tour_today  FROM jsonb_array_elements(ops -> 'tourBookings') t
    WHERE t ->> 'date' = today AND COALESCE(t ->> 'status', '') <> 'cancelled';
  SELECT count(*) INTO bikes_out   FROM jsonb_array_elements(ops -> 'motorbikes') m
    WHERE m ->> 'status' = 'rented';
  SELECT count(*) INTO in_house    FROM jsonb_array_elements(ops -> 'bookings') b
    WHERE b ->> 'status' = 'checked_in';
  SELECT count(*) INTO active_staff FROM jsonb_array_elements(ops -> 'staff') s
    WHERE (s ->> 'active')::bool IS TRUE;

  SELECT COALESCE(sum((p ->> 'amount')::numeric), 0) INTO revenue_30
    FROM jsonb_array_elements(ops -> 'payments') p
    WHERE p ->> 'direction' = 'in'
      AND (p ->> 'date')::timestamptz > now() - interval '30 days';
  SELECT COALESCE(sum((p ->> 'amount')::numeric), 0) INTO expenses_30
    FROM jsonb_array_elements(ops -> 'payments') p
    WHERE p ->> 'direction' = 'out'
      AND (p ->> 'date')::timestamptz > now() - interval '30 days';
  SELECT COALESCE(sum((pr ->> 'amount')::numeric), 0) INTO unpaid_pay
    FROM jsonb_array_elements(ops -> 'payRecords') pr
    WHERE (pr ->> 'paid')::bool IS NOT TRUE;

  IF arrivals   > 0 THEN highlights := highlights || format('%s arrival(s) today', arrivals); END IF;
  IF departures > 0 THEN highlights := highlights || format('%s departure(s) today', departures); END IF;
  IF tour_today > 0 THEN highlights := highlights || format('%s tour(s) running', tour_today); END IF;
  IF bikes_out  > 0 THEN highlights := highlights || format('%s bike(s) out', bikes_out); END IF;
  IF in_house   > 0 THEN highlights := highlights || format('%s guest(s) in-house', in_house); END IF;
  IF unpaid_pay > 0 THEN highlights := highlights || format('Unpaid payroll: ₱%s', trim(to_char(unpaid_pay, 'FM999,999,999'))); END IF;
  IF revenue_30 > 0 THEN highlights := highlights || format('Revenue (30d): ₱%s', trim(to_char(revenue_30, 'FM999,999,999'))); END IF;
  IF expenses_30 > 0 THEN highlights := highlights || format('Expenses (30d): ₱%s', trim(to_char(expenses_30, 'FM999,999,999'))); END IF;

  summary := format('Good morning. Here is the rundown for %s. ', today);
  IF in_house > 0 THEN summary := summary || format('%s guest(s) are in-house. ', in_house);
  ELSE summary := summary || 'No guests are in-house right now. '; END IF;
  IF arrivals > 0 THEN summary := summary || format('%s arrival(s) expected today. ', arrivals);
  ELSE summary := summary || 'No arrivals scheduled today. '; END IF;
  IF departures > 0 THEN summary := summary || format('%s departure(s) today. ', departures);
  ELSE summary := summary || 'No departures today. '; END IF;
  IF tour_today > 0 THEN summary := summary || format('%s tour(s) on the schedule. ', tour_today);
  ELSE summary := summary || 'No tours booked today. '; END IF;
  IF bikes_out > 0 THEN summary := summary || format('%s motorbike(s) out. ', bikes_out); END IF;
  IF revenue_30 > 0 OR expenses_30 > 0 THEN
    summary := summary || format('Last 30 days: ₱%s in, ₱%s out. ',
      trim(to_char(revenue_30, 'FM999,999,999')), trim(to_char(expenses_30, 'FM999,999,999')));
  END IF;
  IF unpaid_pay > 0 THEN summary := summary || format('Heads up — ₱%s in payroll is still unpaid. ', trim(to_char(unpaid_pay, 'FM999,999,999'))); END IF;
  summary := summary || format('%s staff active.', active_staff);

  INSERT INTO public.tala_briefings (brief_date, summary, highlights)
  VALUES (today, summary, to_jsonb(highlights))
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant so the cron worker (postgres role) and the console can both call it.
GRANT EXECUTE ON FUNCTION public.generate_tala_briefing() TO postgres, service_role;

-- 3) Schedule it daily at 07:00 Asia/Manila (23:00 UTC). Idempotent: remove
--    any prior copy with this name, then (re)create. pg_cron's objects live in
--    the "cron" schema.
DELETE FROM cron.job WHERE jobname = 'tala_daily_briefing';
SELECT cron.schedule(
  'tala_daily_briefing',
  '0 23 * * *',
  'SELECT public.generate_tala_briefing();'
);
