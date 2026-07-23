-- ===========================================================================
-- TALA Operations Console — backing tables
-- These power the admin-side "TALA" workspace (operator face), separate from
-- the public guest orb. Mirrors the existing tala_leads open-policy pattern:
-- the admin panel uses a local passkey, not Supabase Auth, so every request
-- reaches Postgres as the same anon role and SELECT is open (like cms_data).
-- anon can INSERT/SELECT but NOT UPDATE/DELETE, so a visitor (or stray
-- client) can only ever add a row, never alter or wipe operator data.
-- ===========================================================================

-- --- Goals TALA is working toward ------------------------------------------
CREATE TABLE IF NOT EXISTS public.tala_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'done'
  target_date TEXT NOT NULL DEFAULT '',    -- human date, e.g. "2026-08-01"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Weekly / one-off tasks TALA tracks --------------------------------
CREATE TABLE IF NOT EXISTS public.tala_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  due TEXT NOT NULL DEFAULT '',            -- human date or "" (no due)
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'done'
  category TEXT NOT NULL DEFAULT 'general',-- 'general' | 'booking' | 'tour' | 'staff' | 'maintenance'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Morning briefings (computed from live ops data, then stored) --------
CREATE TABLE IF NOT EXISTS public.tala_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date TEXT NOT NULL DEFAULT '',      -- the ops "today" the brief covers, YYYY-MM-DD
  summary TEXT NOT NULL DEFAULT '',        -- human narrative TALA writes
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of short notable strings
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Wins / accomplishments log ------------------------------------------
CREATE TABLE IF NOT EXISTS public.tala_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date TEXT NOT NULL DEFAULT '',     -- YYYY-MM-DD the win relates to
  text TEXT NOT NULL DEFAULT '',          -- what TALA accomplished
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --- Grants (same shape as tala_leads) -------------------------------------
GRANT SELECT, INSERT ON public.tala_goals TO anon;
GRANT SELECT, INSERT ON public.tala_goals TO authenticated;
GRANT ALL ON public.tala_goals TO service_role;

GRANT SELECT, INSERT ON public.tala_tasks TO anon;
GRANT SELECT, INSERT ON public.tala_tasks TO authenticated;
GRANT ALL ON public.tala_tasks TO service_role;

GRANT SELECT, INSERT ON public.tala_briefings TO anon;
GRANT SELECT, INSERT ON public.tala_briefings TO authenticated;
GRANT ALL ON public.tala_briefings TO service_role;

GRANT SELECT, INSERT ON public.tala_wins TO anon;
GRANT SELECT, INSERT ON public.tala_wins TO authenticated;
GRANT ALL ON public.tala_wins TO service_role;

-- --- Row Level Security -----------------------------------------------------
ALTER TABLE public.tala_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tala_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tala_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tala_wins ENABLE ROW LEVEL SECURITY;

-- INSERT is open (admin passkey guards the UI; anyone reaching here as anon
-- can only append). SELECT is open so the admin console can read.
CREATE POLICY "Anyone can add a goal"      ON public.tala_goals      FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read goals"      ON public.tala_goals      FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can add a task"      ON public.tala_tasks      FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read tasks"      ON public.tala_tasks      FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can add a briefing"  ON public.tala_briefings  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read briefings"  ON public.tala_briefings  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can add a win"       ON public.tala_wins       FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read wins"       ON public.tala_wins       FOR SELECT TO anon, authenticated USING (true);
