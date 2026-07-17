DROP POLICY IF EXISTS "Authenticated can write CMS data" ON public.cms_data;

GRANT INSERT, UPDATE, DELETE ON public.cms_data TO anon;

CREATE POLICY "Anyone can write CMS data"
  ON public.cms_data FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);