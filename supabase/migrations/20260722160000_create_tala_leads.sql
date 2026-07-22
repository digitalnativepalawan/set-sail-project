-- Leads captured by TALA (the AI concierge) when a visitor expresses real
-- interest but the conversation ends before they reach WhatsApp. Deliberately
-- a separate table from cms_data: that table is one large JSON blob that the
-- whole admin UI reads/writes wholesale, so having TALA's chat sessions
-- read-modify-write it too would risk silently clobbering concurrent admin
-- edits. This table only ever gets appended to (INSERT), never touched by
-- the CMS save path.

CREATE TABLE IF NOT EXISTS public.tala_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'tala_chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT ON public.tala_leads TO anon;
GRANT SELECT, INSERT ON public.tala_leads TO authenticated;
GRANT ALL ON public.tala_leads TO service_role;

ALTER TABLE public.tala_leads ENABLE ROW LEVEL SECURITY;

-- Note: like the rest of this project's current setup (see cms_data's own
-- policies), there is no real session-based admin/visitor distinction yet —
-- the admin panel uses a local passkey, not Supabase Auth, so every request
-- reaches Postgres as the same anon role. SELECT is therefore open the same
-- way cms_data already is. UPDATE/DELETE are deliberately NOT granted to
-- anon, so a visitor can only ever add a lead, never alter or remove one.
CREATE POLICY "Anyone can submit a lead"
  ON public.tala_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read leads"
  ON public.tala_leads FOR SELECT
  TO anon, authenticated
  USING (true);
