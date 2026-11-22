-- ==============================================================================
-- Migration: 20261122_02_bronze_domains_parity_fixes.sql
-- Description: 100% Bronze Ruwe Data Pariteit DDL & Stored Procedure Repairs
-- Target: Klanten, Leveranciers, GSW Inkooporders & Configurator Opties/Waarden
-- Invariants: INV-RAW-IMMUTABILITY-01, INV-SYS-07, INV-SYS-10, INV-SYS-13, INV-SYS-15
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. IDEMPOTENTE SCHEMA-ALIGNMENT OP public.logictrade_configurator_schemas
-- ------------------------------------------------------------------------------
-- Garandeert dat Silver UI-velden en Bronze ruwe datavelden compatibel coëxisteren
ALTER TABLE public.logictrade_configurator_schemas
  ADD COLUMN IF NOT EXISTS step_id TEXT,
  ADD COLUMN IF NOT EXISTS option_code TEXT,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'algemeen',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS code TEXT DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS kind INTEGER DEFAULT 400,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS possible_values JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lt_raw_data JSONB,
  ADD COLUMN IF NOT EXISTS lt_raw_hash TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Drop rigid NOT NULL constraints uit 20261014 om compatibiliteit met Bronze-ingest te garanderen
ALTER TABLE public.logictrade_configurator_schemas
  ALTER COLUMN step_id DROP NOT NULL,
  ALTER COLUMN option_code DROP NOT NULL,
  ALTER COLUMN label DROP NOT NULL,
  ALTER COLUMN category DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. KLANTEN BATCH INGEST MET INTRA-BATCH DEDUPLICATIE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_logictrade_customers_batch(p_customers jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    INSERT INTO public.logictrade_customers (
        id,
        customer_number,
        name,
        search_name,
        is_active,
        lt_raw_data,
        created_at,
        updated_at
    )
    SELECT DISTINCT ON ((elem->>'id')::bigint)
        (elem->>'id')::bigint,
        elem->>'customer_number',
        elem->>'name',
        elem->>'search_name',
        COALESCE((elem->>'is_active')::boolean, true),
        elem->'lt_raw_data',
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_customers) elem
    ORDER BY (elem->>'id')::bigint
    ON CONFLICT (id) DO UPDATE SET
        customer_number = EXCLUDED.customer_number,
        name = EXCLUDED.name,
        search_name = EXCLUDED.search_name,
        is_active = EXCLUDED.is_active,
        lt_raw_data = EXCLUDED.lt_raw_data,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. LEVERANCIERS BATCH INGEST MET INTRA-BATCH DEDUPLICATIE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_logictrade_suppliers_batch(p_suppliers jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    INSERT INTO public.logictrade_suppliers (
        id,
        supplier_number,
        name,
        is_active,
        lt_raw_data,
        created_at,
        updated_at
    )
    SELECT DISTINCT ON ((elem->>'id')::bigint)
        (elem->>'id')::bigint,
        elem->>'supplier_number',
        elem->>'name',
        COALESCE((elem->>'is_active')::boolean, true),
        elem->'lt_raw_data',
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_suppliers) elem
    ORDER BY (elem->>'id')::bigint
    ON CONFLICT (id) DO UPDATE SET
        supplier_number = EXCLUDED.supplier_number,
        name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        lt_raw_data = EXCLUDED.lt_raw_data,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. INKOOPORDERS BATCH INGEST MET REFERENCED SUPPLIERS & ATOMAIRE LIJNVERVANGING
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_logictrade_purchase_orders_batch(p_purchase_orders jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    -- Stap 4.1: CTE deduped_po ontdubbelt binnenkomende orders
    WITH deduped_po AS (
        SELECT DISTINCT ON ((po->>'id')::bigint)
            (po->>'id')::bigint AS id,
            po->>'order_number' AS order_number,
            (NULLIF(TRIM(COALESCE(po->>'supplier_id', po->'supplier'->>'id', po->'lt_raw_data'->'supplier'->>'id')), ''))::bigint AS supplier_id,
            COALESCE(po->>'status', 'ORDER') AS status,
            NULLIF(TRIM(COALESCE(po->>'order_date', po->'lt_raw_data'->>'orderDate', po->'lt_raw_data'->>'date')), '')::timestamptz AS order_date,
            COALESCE(
                (po->>'total_gross_cents')::bigint,
                ROUND(COALESCE((po->'lt_raw_data'->>'totalGross')::numeric, (po->'lt_raw_data'->>'totalPrice')::numeric, 0) * 100)::bigint
            ) AS total_gross_cents,
            COALESCE(po->'lt_raw_data', po) AS lt_raw_data,
            po
        FROM jsonb_array_elements(p_purchase_orders) po
        WHERE (po->>'id') IS NOT NULL AND TRIM(po->>'id') != ''
        ORDER BY (po->>'id')::bigint
    ),
    -- Stap 4.2: Seeden van ontbrekende historische leveranciers ter voorkoming van SQLSTATE 23503 (FK violation)
    referenced_suppliers AS (
        SELECT DISTINCT ON (d.supplier_id)
            d.supplier_id AS id,
            COALESCE(
                d.po->'lt_raw_data'->'supplier'->>'supplierNumber',
                d.po->'supplier'->>'supplierNumber',
                'SUPP-' || d.supplier_id
            ) AS supplier_number,
            COALESCE(
                d.po->'lt_raw_data'->'supplier'->>'name',
                d.po->'supplier'->>'name',
                d.po->'lt_raw_data'->'supplier'->>'companyName',
                'Leverancier ' || d.supplier_id
            ) AS name,
            true AS is_active
        FROM deduped_po d
        WHERE d.supplier_id IS NOT NULL
        ORDER BY d.supplier_id
    ),
    seeded_suppliers AS (
        INSERT INTO public.logictrade_suppliers (id, supplier_number, name, is_active, created_at, updated_at)
        SELECT s.id, s.supplier_number, s.name, s.is_active, NOW(), NOW()
        FROM referenced_suppliers s
        ON CONFLICT (id) DO NOTHING
    ),
    -- Stap 4.3: Upsert order-headers
    upserted_headers AS (
        INSERT INTO public.logictrade_purchase_orders (
            id,
            order_number,
            supplier_id,
            status,
            order_date,
            total_gross_cents,
            lt_raw_data,
            created_at,
            updated_at
        )
        SELECT
            d.id,
            d.order_number,
            d.supplier_id,
            d.status,
            d.order_date,
            d.total_gross_cents,
            d.lt_raw_data,
            NOW(),
            NOW()
        FROM deduped_po d
        ON CONFLICT (id) DO UPDATE SET
            order_number = EXCLUDED.order_number,
            supplier_id = EXCLUDED.supplier_id,
            status = EXCLUDED.status,
            order_date = EXCLUDED.order_date,
            total_gross_cents = EXCLUDED.total_gross_cents,
            lt_raw_data = EXCLUDED.lt_raw_data,
            updated_at = NOW()
        RETURNING id
    ),
    -- Stap 4.4: Verwijder bestaande lijnen voor de verwerkte PO's om ghost-lines uit te sluiten
    deleted_lines AS (
        DELETE FROM public.logictrade_purchase_order_lines
        WHERE purchase_order_id IN (SELECT id FROM deduped_po)
    )
    -- Stap 4.5: Lijnen invoegen met botsingsvrije ROW_NUMBER() en numeric quantity cast
    INSERT INTO public.logictrade_purchase_order_lines (
        purchase_order_id,
        line_number,
        line_ordinal,
        article_code,
        description,
        quantity,
        unit_price_cents,
        total_price_cents,
        lt_raw_data,
        created_at,
        updated_at
    )
    SELECT
        d.id,
        ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY l.ord)::integer,
        l.ord::integer,
        COALESCE(l.line->>'code', l.line->>'articleCode'),
        COALESCE(l.line->>'description', l.line->>'name', 'Regel'),
        COALESCE(NULLIF(TRIM(l.line->>'quantity'), '')::numeric, 1),
        COALESCE(
            (l.line->>'unitPriceCents')::bigint,
            ROUND(COALESCE((l.line->>'partPrice')::numeric, (l.line->>'unitPrice')::numeric, 0) * 100)::bigint
        ),
        COALESCE(
            (l.line->>'totalPriceCents')::bigint,
            ROUND(COALESCE((l.line->>'linePrice')::numeric, (l.line->>'totalPrice')::numeric, 0) * 100)::bigint
        ),
        l.line,
        NOW(),
        NOW()
    FROM deduped_po d
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(d.po->'lines') = 'array' THEN d.po->'lines'
            WHEN jsonb_typeof(d.po->'orderLines') = 'array' THEN d.po->'orderLines'
            WHEN jsonb_typeof(d.lt_raw_data->'lines') = 'array' THEN d.lt_raw_data->'lines'
            WHEN jsonb_typeof(d.lt_raw_data->'orderLines') = 'array' THEN d.lt_raw_data->'orderLines'
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY l(line, ord);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. CONFIGURATOR SCHEMA'S BATCH INGEST (POSTGREST COMPATIBLE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_logictrade_configurator_schemas_batch(
    p_schemas jsonb,
    p_preserve_silver boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    INSERT INTO public.logictrade_configurator_schemas (
        option_id,
        code,
        description,
        name,
        kind,
        is_active,
        possible_values,
        step_id,
        option_code,
        label,
        category,
        sort_order,
        raw_metadata,
        synced_at,
        lt_raw_data,
        created_at,
        updated_at
    )
    SELECT DISTINCT ON ((elem->>'option_id')::bigint)
        (elem->>'option_id')::bigint,
        COALESCE(elem->>'code', 'UNKNOWN'),
        elem->>'description',
        elem->>'name',
        COALESCE((elem->>'kind')::int, 400),
        COALESCE((elem->>'is_active')::boolean, false),
        COALESCE(elem->'possible_values', '[]'::jsonb),
        elem->>'step_id',
        COALESCE(elem->>'option_code', elem->>'code'),
        COALESCE(elem->>'label', elem->>'name', elem->>'description'),
        COALESCE(elem->>'category', 'algemeen'),
        COALESCE((elem->>'sort_order')::int, 0),
        COALESCE(elem->'raw_metadata', '{}'::jsonb),
        COALESCE(NULLIF(elem->>'synced_at', '')::timestamptz, NOW()),
        elem->'lt_raw_data',
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_schemas) elem
    ORDER BY (elem->>'option_id')::bigint
    ON CONFLICT (option_id) DO UPDATE SET
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        is_active = EXCLUDED.is_active,
        possible_values = EXCLUDED.possible_values,
        step_id = COALESCE(public.logictrade_configurator_schemas.step_id, EXCLUDED.step_id),
        option_code = COALESCE(public.logictrade_configurator_schemas.option_code, EXCLUDED.option_code),
        label = COALESCE(public.logictrade_configurator_schemas.label, EXCLUDED.label),
        category = COALESCE(public.logictrade_configurator_schemas.category, EXCLUDED.category),
        sort_order = COALESCE(public.logictrade_configurator_schemas.sort_order, EXCLUDED.sort_order),
        raw_metadata = COALESCE(public.logictrade_configurator_schemas.raw_metadata, EXCLUDED.raw_metadata),
        synced_at = COALESCE(public.logictrade_configurator_schemas.synced_at, EXCLUDED.synced_at),
        lt_raw_data = EXCLUDED.lt_raw_data,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. CONFIGURATOR OPTIEWAARDEN BATCH INGEST MET INTRA-BATCH DEDUPLICATIE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_logictrade_configurator_option_values_batch(p_values jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    INSERT INTO public.logictrade_configurator_option_values (
        option_id,
        value_id,
        code,
        description,
        name,
        is_active,
        lt_raw_data,
        created_at,
        updated_at
    )
    SELECT DISTINCT ON ((elem->>'option_id')::bigint, (elem->>'value_id')::bigint)
        (elem->>'option_id')::bigint,
        (elem->>'value_id')::bigint,
        elem->>'code',
        elem->>'description',
        elem->>'name',
        COALESCE((elem->>'is_active')::boolean, true),
        elem->'lt_raw_data',
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_values) elem
    ORDER BY (elem->>'option_id')::bigint, (elem->>'value_id')::bigint
    ON CONFLICT (option_id, value_id) DO UPDATE SET
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        lt_raw_data = EXCLUDED.lt_raw_data,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. REPARATIE VERIFICATIE-RPC verify_bronze_immutability_and_hashes
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verify_bronze_immutability_and_hashes(text, text, integer);

CREATE OR REPLACE FUNCTION public.verify_bronze_immutability_and_hashes(
    p_table text,
    p_last_key text DEFAULT ''::text,
    p_limit integer DEFAULT 500
)
RETURNS TABLE (
    table_name text,
    total_rows bigint,
    rows_with_raw_data bigint,
    rows_with_hash bigint,
    corrupted_hashes bigint,
    next_last_key text,
    has_more boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_count bigint := 0;
    v_raw_count bigint := 0;
    v_hash_count bigint := 0;
    v_corrupt_count bigint := 0;
    v_next_key text := '';
    v_has_more boolean := false;
    v_sep_idx int;
    v_part1 bigint;
    v_part2 bigint;
BEGIN
    IF p_table = 'orders' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.orders
            WHERE (p_last_key = '' OR id > p_last_key)
            ORDER BY id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'order_lines' OR p_table = 'order_lines (real)' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id)::text, '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.order_lines
            WHERE COALESCE(is_inbegrepen, false) = false AND (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'order_lines_inbegrepen' OR p_table = 'order_lines_sub1' OR p_table = 'order_lines (is_inbegrepen=true)' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_data IS NOT NULL OR lt_raw_hash IS NOT NULL),
            COALESCE(MAX(sub.id)::text, '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.order_lines
            WHERE COALESCE(is_inbegrepen, false) = true AND (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'logictrade_products' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id)::text, '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_products
            WHERE (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'logictrade_configurator_schemas' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.option_id)::text, '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT option_id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_configurator_schemas
            WHERE (p_last_key = '' OR option_id > p_last_key::bigint)
            ORDER BY option_id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'logictrade_configurator_option_values' THEN
        IF p_last_key != '' AND position(':' in p_last_key) > 0 THEN
            v_sep_idx := position(':' in p_last_key);
            v_part1 := substring(p_last_key from 1 for v_sep_idx - 1)::bigint;
            v_part2 := substring(p_last_key from v_sep_idx + 1)::bigint;
        ELSE
            v_part1 := 0;
            v_part2 := 0;
        END IF;

        WITH sub AS (
            SELECT option_id, value_id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_configurator_option_values
            WHERE (p_last_key = '' OR (option_id, value_id) > (v_part1, v_part2))
            ORDER BY option_id ASC, value_id ASC
            LIMIT p_limit
        )
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE((SELECT s.option_id::text || ':' || s.value_id::text FROM sub s ORDER BY s.option_id DESC, s.value_id DESC LIMIT 1), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM sub;

    ELSIF p_table = 'logictrade_customers' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id)::text, '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_customers
            WHERE (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'logictrade_suppliers' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id)::text, '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_suppliers
            WHERE (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'logictrade_purchase_orders' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id)::text, '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_purchase_orders
            WHERE (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'logictrade_purchase_order_lines' THEN
        IF p_last_key != '' AND position(':' in p_last_key) > 0 THEN
            v_sep_idx := position(':' in p_last_key);
            v_part1 := substring(p_last_key from 1 for v_sep_idx - 1)::bigint;
            v_part2 := substring(p_last_key from v_sep_idx + 1)::bigint;
        ELSE
            v_part1 := 0;
            v_part2 := 0;
        END IF;

        WITH sub AS (
            SELECT purchase_order_id, line_number, lt_raw_data, lt_raw_hash
            FROM public.logictrade_purchase_order_lines
            WHERE (p_last_key = '' OR (purchase_order_id, line_number) > (v_part1, v_part2))
            ORDER BY purchase_order_id ASC, line_number ASC
            LIMIT p_limit
        )
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE((SELECT s.purchase_order_id::text || ':' || s.line_number::text FROM sub s ORDER BY s.purchase_order_id DESC, s.line_number DESC LIMIT 1), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM sub;

    ELSE
        RAISE EXCEPTION 'Onbekende tabel voor pariteitsverificatie: %', p_table;
    END IF;

    v_has_more := (v_count = p_limit);

    RETURN QUERY
    SELECT
        p_table,
        v_count,
        v_raw_count,
        v_hash_count,
        v_corrupt_count,
        v_next_key,
        v_has_more;
END;
$$;
