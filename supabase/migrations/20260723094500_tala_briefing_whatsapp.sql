-- ===========================================================================
-- TALA — WhatsApp delivery for the morning briefing (one-tap wa.me).
-- Adds a flag so the console shows which briefings have been pushed to
-- WhatsApp. The actual send is a wa.me deep link opened from the admin UI
-- (no WhatsApp API, no server, no ban risk) — full auto-send is a later phase.
-- ===========================================================================

ALTER TABLE public.tala_briefings
  ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE;
