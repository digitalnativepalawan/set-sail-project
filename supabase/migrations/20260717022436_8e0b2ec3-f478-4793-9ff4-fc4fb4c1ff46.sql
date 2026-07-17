CREATE TABLE IF NOT EXISTS public.cms_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.cms_data TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_data TO authenticated;
GRANT ALL ON public.cms_data TO service_role;

ALTER TABLE public.cms_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read CMS data"
  ON public.cms_data FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can write CMS data"
  ON public.cms_data FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_data;

INSERT INTO public.cms_data (key, value)
VALUES ('marina_terrace_payload', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;