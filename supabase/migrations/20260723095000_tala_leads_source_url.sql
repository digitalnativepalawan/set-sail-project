-- ===========================================================================
-- TALA lead-gen: let the scraper store where a lead came from so we don't
-- re-insert the same Reddit post on every run, and can click back to it.
-- Safe to re-run (IF NOT EXISTS).
-- ===========================================================================

ALTER TABLE public.tala_leads
  ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';

-- Index so the dedupe SELECT (WHERE source_url = $1) is fast as the table grows.
CREATE INDEX IF NOT EXISTS tala_leads_source_url_idx
  ON public.tala_leads (source_url);

-- service_role already has ALL on tala_leads; the scraper uses the service
-- role key to read (dedupe) + insert.
