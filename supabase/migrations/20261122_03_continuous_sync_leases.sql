-- ==============================================================================
-- Migratie: 20261122_03_continuous_sync_leases.sql
-- Doel: Gedistribueerde Lease Tabel, RLS & Beveiligde RPC Functies voor
-- Continue 1-Seconde Delta Synchronisatie Engine (LogicTrade -> Supabase).
-- Invarianten: Monotone Fencing Epochs (et+1 > et), SET search_path, zero anon privileges.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.logictrade_sync_leases (
  lease_key text PRIMARY KEY,
  worker_id text NOT NULL,
  fencing_token bigint NOT NULL DEFAULT 1,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- RLS Handhaving
ALTER TABLE public.logictrade_sync_leases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.logictrade_sync_leases FROM anon, authenticated;
GRANT ALL ON public.logictrade_sync_leases TO service_role;
GRANT SELECT ON public.logictrade_sync_leases TO authenticated;

DROP POLICY IF EXISTS sync_leases_service_role_all ON public.logictrade_sync_leases;
CREATE POLICY sync_leases_service_role_all ON public.logictrade_sync_leases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sync_leases_authenticated_read ON public.logictrade_sync_leases;
CREATE POLICY sync_leases_authenticated_read ON public.logictrade_sync_leases
  FOR SELECT TO authenticated USING (true);

-- Atomaire Lease Acquisitie & Heartbeat Functie met Monotone Fencing Epochs
CREATE OR REPLACE FUNCTION public.acquire_sync_lease(
  p_lease_key text,
  p_worker_id text,
  p_ttl_seconds integer DEFAULT 15
) RETURNS TABLE (acquired boolean, current_fencing_token bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_expires timestamptz := v_now + (p_ttl_seconds || ' seconds')::interval;
  v_row record;
BEGIN
  INSERT INTO public.logictrade_sync_leases (lease_key, worker_id, fencing_token, acquired_at, expires_at)
  VALUES (p_lease_key, p_worker_id, 1, v_now, v_expires)
  ON CONFLICT (lease_key) DO UPDATE
  SET worker_id = p_worker_id,
      fencing_token = CASE
        -- Uitsluitend gelijk houden tijdens een actieve heartbeat van dezelfde leider
        WHEN logictrade_sync_leases.expires_at >= v_now AND logictrade_sync_leases.worker_id = p_worker_id 
          THEN logictrade_sync_leases.fencing_token
        -- Bij overname, herstart na downtime of expiratie: altijd monotoon ophogen
        ELSE logictrade_sync_leases.fencing_token + 1
      END,
      acquired_at = CASE
        WHEN logictrade_sync_leases.expires_at >= v_now AND logictrade_sync_leases.worker_id = p_worker_id 
          THEN logictrade_sync_leases.acquired_at
        ELSE v_now
      END,
      expires_at = v_expires
  WHERE logictrade_sync_leases.expires_at <= v_now
     OR logictrade_sync_leases.worker_id = p_worker_id
  RETURNING logictrade_sync_leases.fencing_token INTO v_row;

  IF FOUND THEN
    RETURN QUERY SELECT true, v_row.fencing_token;
  ELSE
    RETURN QUERY SELECT false, (SELECT fencing_token FROM public.logictrade_sync_leases WHERE lease_key = p_lease_key);
  END IF;
END;
$$;

-- Status Inspectie Functie voor Fail-Closed Pre-Tick Assertions
CREATE OR REPLACE FUNCTION public.get_sync_lease(p_lease_key text)
RETURNS TABLE (
  lease_key text,
  worker_id text,
  fencing_token bigint,
  expires_at timestamptz,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT l.lease_key, l.worker_id, l.fencing_token, l.expires_at, (l.expires_at > clock_timestamp())
  FROM public.logictrade_sync_leases l
  WHERE l.lease_key = p_lease_key;
END;
$$;

-- Zachte Lease Vrijgave via Epoch Zero (1970-01-01) ter Garantie van Fencing Epoch Monotonie
CREATE OR REPLACE FUNCTION public.release_sync_lease(
  p_lease_key text,
  p_worker_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  UPDATE public.logictrade_sync_leases
  SET expires_at = '1970-01-01 00:00:00+00'::timestamptz
  WHERE lease_key = p_lease_key AND worker_id = p_worker_id;
  RETURN FOUND;
END;
$$;

-- Veilig intrekken van openbare rechten: géén anon executie!
REVOKE ALL ON FUNCTION public.acquire_sync_lease(text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sync_lease(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_sync_lease(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.acquire_sync_lease(text, text, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sync_lease(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.release_sync_lease(text, text) TO service_role, authenticated;
