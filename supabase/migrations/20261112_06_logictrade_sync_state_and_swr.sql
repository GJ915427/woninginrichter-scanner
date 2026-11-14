-- migration: 20261112_06_logictrade_sync_state_and_swr.sql
-- Fase 2A: Idempotente Sync State DDL, Gescheiden Lease-Fencing, Order Line Precision
-- en Service-Role Security Boundary.

-- ============================================================================
-- Stap 1: Garandeer order_lines.updated_at & NUMERIC(14,4) quantity precisie
-- ============================================================================
ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.order_lines
  ALTER COLUMN quantity TYPE NUMERIC(14,4) USING quantity::NUMERIC(14,4);

-- ============================================================================
-- Stap 2: Breid logictrade_sync_state uit voor cursors, watermarks & daemon lease
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.logictrade_sync_state (
  key TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z'::timestamptz,
  total_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.logictrade_sync_state
  ALTER COLUMN last_synced_at SET DEFAULT '1970-01-01T00:00:00Z'::timestamptz;

ALTER TABLE public.logictrade_sync_state
  ADD COLUMN IF NOT EXISTS high_watermark_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS leader_id TEXT,
  ADD COLUMN IF NOT EXISTS leader_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

INSERT INTO public.logictrade_sync_state (key, last_synced_at, total_synced)
VALUES ('orders_daemon_lease', '1970-01-01T00:00:00Z'::timestamptz, 0)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Stap 3: Least-Privilege RLS op logictrade_sync_state
-- ============================================================================
ALTER TABLE public.logictrade_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read logictrade_sync_state" ON public.logictrade_sync_state;
CREATE POLICY "Public read logictrade_sync_state"
  ON public.logictrade_sync_state
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role full access logictrade_sync_state" ON public.logictrade_sync_state;
CREATE POLICY "Service role full access logictrade_sync_state"
  ON public.logictrade_sync_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Stap 4: Lease & Cursor RPCs (SECURITY DEFINER + search_path = public)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.acquire_logictrade_sync_lease(
    p_lease_key text,
    p_leader_id text,
    p_ttl_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now timestamptz := now();
    v_expires_at timestamptz := v_now + make_interval(secs => GREATEST(COALESCE(p_ttl_seconds, 300), 10));
    v_row public.logictrade_sync_state%ROWTYPE;
BEGIN
    IF NULLIF(p_lease_key, '') IS NULL OR NULLIF(p_leader_id, '') IS NULL THEN
        RAISE EXCEPTION 'p_lease_key en p_leader_id zijn verplicht';
    END IF;

    INSERT INTO public.logictrade_sync_state (
        key,
        last_synced_at,
        total_synced,
        leader_id,
        leader_lease_expires_at,
        updated_at
    )
    VALUES (
        p_lease_key,
        '1970-01-01T00:00:00Z'::timestamptz,
        0,
        p_leader_id,
        v_expires_at,
        v_now
    )
    ON CONFLICT (key) DO UPDATE SET
        leader_id = EXCLUDED.leader_id,
        leader_lease_expires_at = EXCLUDED.leader_lease_expires_at,
        updated_at = v_now
    WHERE public.logictrade_sync_state.leader_lease_expires_at IS NULL
       OR public.logictrade_sync_state.leader_lease_expires_at <= v_now
       OR public.logictrade_sync_state.leader_id = EXCLUDED.leader_id
    RETURNING * INTO v_row;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'acquired', true,
            'lease_key', v_row.key,
            'owner_id', v_row.leader_id,
            'expires_at', v_row.leader_lease_expires_at
        );
    END IF;

    SELECT * INTO v_row
    FROM public.logictrade_sync_state
    WHERE key = p_lease_key;

    RETURN jsonb_build_object(
        'acquired', false,
        'lease_key', p_lease_key,
        'owner_id', v_row.leader_id,
        'expires_at', v_row.leader_lease_expires_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_logictrade_sync_lease(
    p_lease_key text,
    p_leader_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_released integer := 0;
BEGIN
    UPDATE public.logictrade_sync_state
    SET
        leader_id = NULL,
        leader_lease_expires_at = NULL,
        updated_at = now()
    WHERE key = p_lease_key
      AND leader_id = p_leader_id;

    GET DIAGNOSTICS v_released = ROW_COUNT;
    RETURN v_released > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_logictrade_sync_state(
    p_key text
)
RETURNS SETOF public.logictrade_sync_state
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
    FROM public.logictrade_sync_state
    WHERE key = p_key
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_logictrade_sync_state(
    p_key text,
    p_last_synced_at timestamptz,
    p_total_synced integer DEFAULT NULL,
    p_high_watermark_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT NULL,
    p_expected_lease_owner text DEFAULT NULL,
    p_lease_key text DEFAULT 'orders_daemon_lease'
)
RETURNS public.logictrade_sync_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effective_lease_key text := COALESCE(NULLIF(p_lease_key, ''), 'orders_daemon_lease');
    v_row public.logictrade_sync_state%ROWTYPE;
BEGIN
    -- Gescheiden lease-rij vs. cursor-rij fencing
    IF NULLIF(p_expected_lease_owner, '') IS NOT NULL THEN
        PERFORM 1
        FROM public.logictrade_sync_state
        WHERE key = v_effective_lease_key
          AND leader_id = p_expected_lease_owner
          AND leader_lease_expires_at > now()
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Lease fencing mismatch voor eigenaar "%" op lease "%"', p_expected_lease_owner, v_effective_lease_key;
        END IF;
    END IF;

    INSERT INTO public.logictrade_sync_state (
        key,
        last_synced_at,
        total_synced,
        high_watermark_id,
        metadata,
        updated_at
    )
    VALUES (
        p_key,
        COALESCE(p_last_synced_at, '1970-01-01T00:00:00Z'::timestamptz),
        COALESCE(p_total_synced, 0),
        p_high_watermark_id,
        COALESCE(p_metadata, '{}'::jsonb),
        now()
    )
    ON CONFLICT (key) DO UPDATE SET
        last_synced_at = GREATEST(public.logictrade_sync_state.last_synced_at, EXCLUDED.last_synced_at),
        total_synced = COALESCE(p_total_synced, public.logictrade_sync_state.total_synced),
        high_watermark_id = COALESCE(p_high_watermark_id, public.logictrade_sync_state.high_watermark_id),
        metadata = COALESCE(public.logictrade_sync_state.metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
        updated_at = now()
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

-- ============================================================================
-- Stap 5: Herstel Least-Privilege GRANTS op alle 5 privileged Sync/Ingest RPCs
-- ============================================================================
REVOKE ALL ON FUNCTION public.ingest_logictrade_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_logictrade_order(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.acquire_logictrade_sync_lease(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_logictrade_sync_lease(text, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.release_logictrade_sync_lease(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_logictrade_sync_lease(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_logictrade_sync_state(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_logictrade_sync_state(text) TO service_role;

REVOKE ALL ON FUNCTION public.update_logictrade_sync_state(text, timestamptz, integer, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_logictrade_sync_state(text, timestamptz, integer, text, jsonb, text, text) TO service_role;
