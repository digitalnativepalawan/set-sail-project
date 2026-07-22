-- KAPWA's audit-trail rule applied to TALA: every completed agent turn is
-- recorded (classification, tools used, message/reply previews) so the owner
-- can see what the agent is actually doing from Admin → TALA. Append-only
-- from the browser, same policy story as tala_leads.

CREATE TABLE IF NOT EXISTS public.tala_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent TEXT NOT NULL DEFAULT 'general',
  urgency TEXT NOT NULL DEFAULT 'normal',
  department TEXT NOT NULL DEFAULT 'guest_relations',
  guest_message TEXT NOT NULL DEFAULT '',
  reply_preview TEXT NOT NULL DEFAULT '',
  tools_used TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT ON public.tala_audit_log TO anon;
GRANT SELECT, INSERT ON public.tala_audit_log TO authenticated;
GRANT ALL ON public.tala_audit_log TO service_role;

ALTER TABLE public.tala_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can append audit entries"
  ON public.tala_audit_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read audit entries"
  ON public.tala_audit_log FOR SELECT
  TO anon, authenticated
  USING (true);
