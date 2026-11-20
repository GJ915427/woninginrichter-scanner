-- ==============================================================================
-- Migration: 20261119_01_bronze_parity_fixes_and_domains.sql
-- Description: Complete LogicTrade Bronze Domain Rollout, Cryptographic
--              Immutability (SHA-256), Isolated Triggers & Collision-Free Ingestion.
-- Invariants: INV-RAW-IMMUTABILITY-01, INV-SYS-12, INV-SYS-15
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. BASE TABLES & BRONZE SCHEMAS (IDEMPOTENT DDL)
-- ------------------------------------------------------------------------------

-- Configurator schemas parent table
CREATE TABLE IF NOT EXISTS public.logictrade_configurator_schemas (
    option_id BIGINT PRIMARY KEY,
    code TEXT NOT NULL,
    description TEXT,
    name TEXT,
    kind INT DEFAULT 400,
    is_active BOOLEAN DEFAULT false,
    possible_values JSONB DEFAULT '[]'::jsonb,
    lt_raw_data JSONB,
    lt_raw_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurator option values normalized child table
CREATE TABLE IF NOT EXISTS public.logictrade_configurator_option_values (
    option_id BIGINT NOT NULL REFERENCES public.logictrade_configurator_schemas(option_id) ON DELETE CASCADE,
    value_id BIGINT NOT NULL,
    code TEXT,
    description TEXT,
    name TEXT,
    is_active BOOLEAN DEFAULT true,
    lt_raw_data JSONB,
    lt_raw_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (option_id, value_id)
);

-- Customers
CREATE TABLE IF NOT EXISTS public.logictrade_customers (
    id BIGINT PRIMARY KEY,
    customer_number TEXT,
    name TEXT,
    search_name TEXT,
    is_active BOOLEAN DEFAULT true,
    lt_raw_data JSONB,
    lt_raw_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS public.logictrade_suppliers (
    id BIGINT PRIMARY KEY,
    supplier_number TEXT,
    name TEXT,
    is_active BOOLEAN DEFAULT true,
    lt_raw_data JSONB,
    lt_raw_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS public.logictrade_purchase_orders (
    id BIGINT PRIMARY KEY,
    order_number TEXT,
    supplier_id BIGINT REFERENCES public.logictrade_suppliers(id) ON DELETE SET NULL,
    status TEXT,
    order_date TIMESTAMPTZ,
    total_gross_cents BIGINT DEFAULT 0,
    lt_raw_data JSONB,
    lt_raw_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Lines
CREATE TABLE IF NOT EXISTS public.logictrade_purchase_order_lines (
    purchase_order_id BIGINT NOT NULL REFERENCES public.logictrade_purchase_orders(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    line_ordinal INT DEFAULT 0,
    article_code TEXT,
    description TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price_cents BIGINT DEFAULT 0,
    total_price_cents BIGINT DEFAULT 0,
    lt_raw_data JSONB,
    lt_raw_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (purchase_order_id, line_number)
);

-- Sync state table resilience
CREATE TABLE IF NOT EXISTS public.logictrade_sync_state (
    key TEXT PRIMARY KEY,
    total_records INT DEFAULT 0,
    checkpoint_page INT DEFAULT 1,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logictrade_sync_state' AND column_name = 'key') THEN
        ALTER TABLE public.logictrade_sync_state ADD COLUMN key TEXT;
        UPDATE public.logictrade_sync_state SET key = id WHERE key IS NULL AND id IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logictrade_sync_state' AND column_name = 'checkpoint_page') THEN
        ALTER TABLE public.logictrade_sync_state ADD COLUMN checkpoint_page INT DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logictrade_sync_state' AND column_name = 'last_synced_at') THEN
        ALTER TABLE public.logictrade_sync_state ADD COLUMN last_synced_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    -- purchase_order_lines quantity type
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logictrade_purchase_order_lines' AND column_name = 'quantity' AND data_type != 'numeric') THEN
        ALTER TABLE public.logictrade_purchase_order_lines ALTER COLUMN quantity TYPE NUMERIC;
    END IF;
END $$;

-- Add Bronze hash columns to existing tables
DO $$
BEGIN
    -- orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'lt_id') THEN
        ALTER TABLE public.orders ADD COLUMN lt_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'lt_raw_data') THEN
        ALTER TABLE public.orders ADD COLUMN lt_raw_data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'lt_raw_hash') THEN
        ALTER TABLE public.orders ADD COLUMN lt_raw_hash TEXT;
    END IF;

    -- order_lines
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_lines' AND column_name = 'sub_line') THEN
        ALTER TABLE public.order_lines ADD COLUMN sub_line INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_lines' AND column_name = 'lt_id') THEN
        ALTER TABLE public.order_lines ADD COLUMN lt_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_lines' AND column_name = 'lt_raw_data') THEN
        ALTER TABLE public.order_lines ADD COLUMN lt_raw_data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_lines' AND column_name = 'lt_raw_hash') THEN
        ALTER TABLE public.order_lines ADD COLUMN lt_raw_hash TEXT;
    END IF;

    -- logictrade_products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logictrade_products' AND column_name = 'lt_raw_data') THEN
        ALTER TABLE public.logictrade_products ADD COLUMN lt_raw_data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'logictrade_products' AND column_name = 'lt_raw_hash') THEN
        ALTER TABLE public.logictrade_products ADD COLUMN lt_raw_hash TEXT;
    END IF;
END $$;

-- Enforce sub_line = 1 cleanup (mechanical invariant: lt_raw_data MUST be null for sub_line = 1)
UPDATE public.order_lines
SET lt_raw_data = NULL, lt_raw_hash = NULL
WHERE sub_line = 1 AND (lt_raw_data IS NOT NULL OR lt_raw_hash IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 2. CRYPTOGRAPHIC IMMUTABILITY & ISOLATED TRIGGERS
-- ------------------------------------------------------------------------------

-- Generic Trigger: Compute hash on insert/update and guard updates
CREATE OR REPLACE FUNCTION public.fn_bronze_compute_hash_and_guard()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.lt_raw_data IS NOT NULL THEN
            NEW.lt_raw_hash := encode(extensions.digest(NEW.lt_raw_data::text, 'sha256'), 'hex');
        ELSE
            NEW.lt_raw_hash := NULL;
        END IF;
        NEW.created_at := COALESCE(NEW.created_at, NOW());
        NEW.updated_at := NOW();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF current_setting('app.bronze_sync_authorized', true) = 'on' THEN
            IF NEW.lt_raw_data IS NOT NULL THEN
                NEW.lt_raw_hash := encode(extensions.digest(NEW.lt_raw_data::text, 'sha256'), 'hex');
            ELSE
                NEW.lt_raw_hash := NULL;
            END IF;
            NEW.updated_at := NOW();
            RETURN NEW;
        END IF;

        -- Outside authorized sync, block modifications to raw data or hash drift
        IF (NEW.lt_raw_data IS DISTINCT FROM OLD.lt_raw_data) OR
           (NEW.lt_raw_hash IS DISTINCT FROM OLD.lt_raw_hash) THEN
            RAISE EXCEPTION 'SQLSTATE[P0001]: Direct updates to bronze raw data are prohibited without authorization.'
                USING ERRCODE = 'P0001';
        END IF;
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dedicated Trigger for order_lines (enforcing sub_line = 1 rule)
CREATE OR REPLACE FUNCTION public.fn_order_lines_bronze_guard()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.sub_line = 1 THEN
            NEW.lt_raw_data := NULL;
            NEW.lt_raw_hash := NULL;
        ELSIF NEW.lt_raw_data IS NOT NULL THEN
            NEW.lt_raw_hash := encode(extensions.digest(NEW.lt_raw_data::text, 'sha256'), 'hex');
        ELSE
            NEW.lt_raw_hash := NULL;
        END IF;
        NEW.created_at := COALESCE(NEW.created_at, NOW());
        NEW.updated_at := NOW();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF current_setting('app.bronze_sync_authorized', true) = 'on' THEN
            IF NEW.sub_line = 1 THEN
                NEW.lt_raw_data := NULL;
                NEW.lt_raw_hash := NULL;
            ELSIF NEW.lt_raw_data IS NOT NULL THEN
                NEW.lt_raw_hash := encode(extensions.digest(NEW.lt_raw_data::text, 'sha256'), 'hex');
            ELSE
                NEW.lt_raw_hash := NULL;
            END IF;
            NEW.updated_at := NOW();
            RETURN NEW;
        END IF;

        IF NEW.sub_line = 1 AND (NEW.lt_raw_data IS NOT NULL OR NEW.lt_raw_hash IS NOT NULL) THEN
            RAISE EXCEPTION 'SQLSTATE[P0001]: sub_line = 1 order lines must strictly have NULL raw bronze data.'
                USING ERRCODE = 'P0001';
        END IF;

        IF (NEW.lt_raw_data IS DISTINCT FROM OLD.lt_raw_data) OR
           (NEW.lt_raw_hash IS DISTINCT FROM OLD.lt_raw_hash) THEN
            RAISE EXCEPTION 'SQLSTATE[P0001]: Direct updates to order_lines bronze raw data are prohibited without authorization.'
                USING ERRCODE = 'P0001';
        END IF;
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers idempotently
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'orders',
        'logictrade_products',
        'logictrade_configurator_schemas',
        'logictrade_configurator_option_values',
        'logictrade_customers',
        'logictrade_suppliers',
        'logictrade_purchase_orders',
        'logictrade_purchase_order_lines'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('CREATE OR REPLACE TRIGGER trg_bronze_immutability_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_bronze_compute_hash_and_guard();', tbl, tbl);
    END LOOP;

    -- Order lines dedicated trigger
    CREATE OR REPLACE TRIGGER trg_order_lines_bronze_immutability
        BEFORE INSERT OR UPDATE ON public.order_lines
        FOR EACH ROW EXECUTE FUNCTION public.fn_order_lines_bronze_guard();
END $$;

-- ------------------------------------------------------------------------------
-- 3. STORED PROCEDURES & SYNCHRONIZATION RPCS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Ingest LogicTrade Order RPC with DELETE-before-INSERT to prevent 21000 & 23505
CREATE OR REPLACE FUNCTION public.ingest_logictrade_order(
    p_order JSONB,
    p_lines JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order JSONB;
    v_lines JSONB;
    v_order_id TEXT;
    v_order_num TEXT;
    v_has_lines_key BOOLEAN;
    v_inserted_lines INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    -- Polymorphic payload resolution
    IF p_order ? 'order' THEN
        v_order := p_order->'order';
    ELSE
        v_order := p_order;
    END IF;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        v_lines := p_lines;
        v_has_lines_key := true;
    ELSIF p_order ? 'lines' AND jsonb_typeof(p_order->'lines') = 'array' THEN
        v_lines := p_order->'lines';
        v_has_lines_key := true;
    ELSIF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' THEN
        v_lines := p_lines;
        v_has_lines_key := true;
    ELSE
        v_lines := '[]'::jsonb;
        v_has_lines_key := false;
    END IF;

    v_order_id := COALESCE(v_order->>'id', v_order->>'order_number', v_order->>'orderNumber');
    v_order_num := COALESCE(v_order->>'order_number', v_order->>'orderNumber', v_order_id);

    IF v_order_id IS NULL THEN
        RAISE EXCEPTION 'Order ID or Order Number is required for ingest_logictrade_order';
    END IF;

    -- Upsert order header
    INSERT INTO public.orders (
        id,
        order_number,
        customer_name,
        city,
        quotation_number,
        order_date,
        sales_rep,
        branch,
        fsm_phase,
        fsm_step,
        scope_description,
        total_amount_cents,
        status,
        raw_data,
        lt_raw_data,
        lt_id,
        created_at,
        updated_at
    ) VALUES (
        v_order_id,
        v_order_num,
        COALESCE(v_order->>'customer_name', 'Onbekende Klant'),
        v_order->>'city',
        v_order->>'quotation_number',
        (v_order->>'order_date')::timestamptz,
        v_order->>'sales_rep',
        v_order->>'branch',
        COALESCE(v_order->>'fsm_phase', '5. Bestellen (Actueel)'),
        COALESCE((v_order->>'fsm_step')::int, 5),
        v_order->>'scope_description',
        COALESCE((v_order->>'total_amount_cents')::bigint, 0),
        COALESCE(v_order->>'status', 'ORDER'),
        COALESCE(v_order->'raw_data', v_order),
        COALESCE(v_order->'lt_raw_data', v_order),
        v_order->>'lt_id',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        order_number = EXCLUDED.order_number,
        customer_name = EXCLUDED.customer_name,
        city = EXCLUDED.city,
        quotation_number = EXCLUDED.quotation_number,
        order_date = EXCLUDED.order_date,
        sales_rep = EXCLUDED.sales_rep,
        branch = EXCLUDED.branch,
        fsm_phase = EXCLUDED.fsm_phase,
        fsm_step = EXCLUDED.fsm_step,
        scope_description = EXCLUDED.scope_description,
        total_amount_cents = EXCLUDED.total_amount_cents,
        status = EXCLUDED.status,
        raw_data = EXCLUDED.raw_data,
        lt_raw_data = EXCLUDED.lt_raw_data,
        lt_id = EXCLUDED.lt_id,
        updated_at = NOW();

    -- Process lines if present
    IF v_has_lines_key THEN
        -- Atomic DELETE before INSERT to eliminate SQLSTATE 21000 and 23505
        DELETE FROM public.order_lines WHERE order_id = v_order_id;

        IF jsonb_array_length(v_lines) > 0 THEN
            INSERT INTO public.order_lines (
                order_id,
                line_number,
                sub_line,
                product_code,
                description,
                quantity,
                unit,
                unit_price_cents,
                total_price_cents,
                etage_name,
                room_name,
                window_name,
                position_id,
                dim,
                notes,
                dimension_spec,
                is_hybrid,
                supplier_name,
                supplier_code,
                width_mm,
                height_mm,
                options,
                configuration,
                configuration_json,
                lt_raw_data,
                lt_id,
                created_at,
                updated_at
            )
            SELECT
                v_order_id,
                COALESCE((elem->>'line_number')::int, (ord * 10)::int),
                COALESCE((elem->>'sub_line')::int, 0),
                COALESCE(elem->>'product_code', 'TEKST'),
                COALESCE(elem->>'description', 'Regel'),
                COALESCE((elem->>'quantity')::numeric, 1),
                COALESCE(elem->>'unit', 'stuks'),
                COALESCE((elem->>'unit_price_cents')::bigint, 0),
                COALESCE((elem->>'total_price_cents')::bigint, 0),
                COALESCE(elem->>'etage_name', 'Begane grond'),
                elem->>'room_name',
                elem->>'window_name',
                elem->>'position_id',
                elem->>'dim',
                elem->>'notes',
                elem->'dimension_spec',
                COALESCE((elem->>'is_hybrid')::boolean, false),
                elem->>'supplier_name',
                elem->>'supplier_code',
                (elem->>'width_mm')::int,
                (elem->>'height_mm')::int,
                elem->'options',
                elem->'configuration',
                elem->'configuration_json',
                CASE WHEN COALESCE((elem->>'sub_line')::int, 0) = 1 THEN NULL ELSE elem->'lt_raw_data' END,
                elem->>'lt_id',
                NOW(),
                NOW()
            FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS arr(elem, ord);

            GET DIAGNOSTICS v_inserted_lines = ROW_COUNT;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_num,
        'lines_processed', v_inserted_lines
    );
END;
$$;

-- Batch backfill order lines bronze
CREATE OR REPLACE FUNCTION public.backfill_order_lines_bronze_batch(p_order_ids TEXT[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_updated_count INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    -- Exclusive lt_id matching to update existing order lines from order raw_data
    WITH matched_raw_lines AS (
        SELECT
            o.id AS order_id,
            l_elem.value AS raw_line,
            (l_elem.value->>'id')::text AS raw_lt_id,
            COALESCE((l_elem.value->>'lineNumber')::int, (l_elem.value->>'line_number')::int) AS raw_line_num
        FROM public.orders o
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(o.raw_data->'lines') = 'array' THEN o.raw_data->'lines'
                WHEN jsonb_typeof(o.raw_data->'orderLines') = 'array' THEN o.raw_data->'orderLines'
                ELSE '[]'::jsonb
            END
        ) l_elem
        WHERE o.id = ANY(p_order_ids)
    )
    UPDATE public.order_lines ol
    SET
        lt_raw_data = m.raw_line,
        lt_raw_hash = encode(extensions.digest(m.raw_line::text, 'sha256'), 'hex'),
        updated_at = NOW()
    FROM matched_raw_lines m
    WHERE ol.order_id = m.order_id
      AND ol.sub_line = 0
      AND (
          (ol.lt_id IS NOT NULL AND ol.lt_id = m.raw_lt_id)
          OR (ol.line_number = m.raw_line_num)
      )
      AND ol.lt_raw_data IS NULL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;

-- Sync State RPC
DROP FUNCTION IF EXISTS public.upsert_logictrade_sync_state(text, integer, integer, timestamptz);
CREATE OR REPLACE FUNCTION public.upsert_logictrade_sync_state(
    p_key TEXT,
    p_total_records INT,
    p_checkpoint_page INT DEFAULT 1,
    p_last_synced_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.logictrade_sync_state (key, total_records, checkpoint_page, last_synced_at, updated_at)
    VALUES (p_key, p_total_records, p_checkpoint_page, p_last_synced_at, NOW())
    ON CONFLICT (key) DO UPDATE SET
        total_records = EXCLUDED.total_records,
        checkpoint_page = EXCLUDED.checkpoint_page,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = NOW();
END;
$$;

-- Products batch ingest RPC with authorization
CREATE OR REPLACE FUNCTION public.ingest_logictrade_products_batch(p_products JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    INSERT INTO public.logictrade_products (
        id,
        code,
        description,
        product_group_code,
        unit,
        price_cents,
        purchase_price_cents,
        vat_rate,
        is_active,
        lt_raw_data,
        created_at,
        updated_at
    )
    SELECT DISTINCT ON ((elem->>'id')::bigint)
        (elem->>'id')::bigint,
        COALESCE(elem->>'code', 'TEKST'),
        COALESCE(elem->>'description', elem->>'name', ''),
        COALESCE(elem->>'product_group_code', elem->>'productGroupCode', 'TEKST'),
        COALESCE(elem->>'unit', 'stuks'),
        COALESCE((elem->>'price_cents')::bigint, (elem->>'priceCents')::bigint, 0),
        COALESCE((elem->>'purchase_price_cents')::bigint, (elem->>'purchasePriceCents')::bigint, 0),
        COALESCE((elem->>'vat_rate')::numeric, (elem->>'vatRate')::numeric, 21.0),
        COALESCE((elem->>'is_active')::boolean, (elem->>'isActive')::boolean, true),
        COALESCE(elem->'lt_raw_data', elem->'raw_data', elem),
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_products) elem
    ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        product_group_code = CASE 
            WHEN public.logictrade_products.product_group_code <> '9.9' AND EXCLUDED.product_group_code = '9.9' 
            THEN public.logictrade_products.product_group_code 
            ELSE EXCLUDED.product_group_code 
        END,
        unit = EXCLUDED.unit,
        price_cents = EXCLUDED.price_cents,
        purchase_price_cents = EXCLUDED.purchase_price_cents,
        vat_rate = EXCLUDED.vat_rate,
        is_active = EXCLUDED.is_active,
        lt_raw_data = EXCLUDED.lt_raw_data,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Bronze Raw Hashes batch backfill RPC
CREATE OR REPLACE FUNCTION public.backfill_bronze_raw_hashes_batch(
    p_target TEXT DEFAULT 'all',
    p_last_key TEXT DEFAULT '',
    p_limit INT DEFAULT 500
)
RETURNS TABLE (
    table_name TEXT,
    processed_count INT,
    next_last_key TEXT,
    has_more BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_proc INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    IF p_target = 'orders' OR p_target = 'all' THEN
        WITH batch AS (
            SELECT id FROM public.orders 
            WHERE lt_raw_data IS NOT NULL AND lt_raw_hash IS NULL 
              AND (p_last_key = '' OR id > p_last_key)
            ORDER BY id
            LIMIT p_limit
        ),
        upd AS (
            UPDATE public.orders o
            SET lt_raw_hash = encode(extensions.digest(o.lt_raw_data::text, 'sha256'), 'hex')
            FROM batch b
            WHERE o.id = b.id
            RETURNING o.id
        )
        SELECT COUNT(*), COALESCE(MAX(id), ''), COUNT(*) = p_limit
        INTO v_proc, next_last_key, has_more
        FROM upd;

        table_name := 'orders';
        processed_count := v_proc;
        RETURN NEXT;
    END IF;
END;
$$;

-- Configurator schemas batch RPC with preserveSilver option
CREATE OR REPLACE FUNCTION public.ingest_logictrade_configurator_schemas_batch(
    p_schemas JSONB,
    p_preserve_silver BOOLEAN DEFAULT false
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
        lt_raw_data,
        created_at,
        updated_at
    )
    SELECT
        (elem->>'option_id')::bigint,
        COALESCE(elem->>'code', 'UNKNOWN'),
        elem->>'description',
        elem->>'name',
        COALESCE((elem->>'kind')::int, 400),
        COALESCE((elem->>'is_active')::boolean, false),
        COALESCE(elem->'possible_values', '[]'::jsonb),
        elem->'lt_raw_data',
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_schemas) elem
    ON CONFLICT (option_id) DO UPDATE SET
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        is_active = CASE WHEN p_preserve_silver THEN public.logictrade_configurator_schemas.is_active ELSE EXCLUDED.is_active END,
        possible_values = CASE WHEN p_preserve_silver THEN public.logictrade_configurator_schemas.possible_values ELSE EXCLUDED.possible_values END,
        lt_raw_data = EXCLUDED.lt_raw_data,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Option values batch ingest RPC
CREATE OR REPLACE FUNCTION public.ingest_logictrade_configurator_option_values_batch(
    p_values JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Customers batch ingest RPC
CREATE OR REPLACE FUNCTION public.ingest_logictrade_customers_batch(p_customers JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Suppliers batch ingest RPC
CREATE OR REPLACE FUNCTION public.ingest_logictrade_suppliers_batch(p_suppliers JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Purchase Orders batch ingest RPC
CREATE OR REPLACE FUNCTION public.ingest_logictrade_purchase_orders_batch(p_purchase_orders JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    -- Insert headers
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
    SELECT DISTINCT ON ((elem->>'id')::bigint)
        (elem->>'id')::bigint,
        elem->>'order_number',
        (elem->>'supplier_id')::bigint,
        elem->>'status',
        (elem->>'order_date')::timestamptz,
        COALESCE((elem->>'total_gross_cents')::bigint, 0),
        elem->'lt_raw_data',
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_purchase_orders) elem
    ON CONFLICT (id) DO UPDATE SET
        order_number = EXCLUDED.order_number,
        supplier_id = EXCLUDED.supplier_id,
        status = EXCLUDED.status,
        order_date = EXCLUDED.order_date,
        total_gross_cents = EXCLUDED.total_gross_cents,
        lt_raw_data = EXCLUDED.lt_raw_data,
        updated_at = NOW();

    -- Insert lines if present in payload
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
    SELECT DISTINCT ON ((po->>'id')::bigint, COALESCE((line->>'lineNumber')::int, (line->>'line_number')::int, ord))
        (po->>'id')::bigint,
        COALESCE((line->>'lineNumber')::int, (line->>'line_number')::int, ord),
        ord,
        line->>'articleCode',
        line->>'description',
        COALESCE((line->>'quantity')::numeric, 1),
        COALESCE((line->>'unitPriceCents')::bigint, 0),
        COALESCE((line->>'totalPriceCents')::bigint, 0),
        line,
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_purchase_orders) po
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(po->'lines') = 'array' THEN po->'lines'
            WHEN jsonb_typeof(po->'orderLines') = 'array' THEN po->'orderLines'
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY l(line, ord)
    ON CONFLICT (purchase_order_id, line_number) DO UPDATE SET
        line_ordinal = EXCLUDED.line_ordinal,
        article_code = EXCLUDED.article_code,
        description = EXCLUDED.description,
        quantity = EXCLUDED.quantity,
        unit_price_cents = EXCLUDED.unit_price_cents,
        total_price_cents = EXCLUDED.total_price_cents,
        lt_raw_data = EXCLUDED.lt_raw_data,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Verification RPC returning row count and hash integrity status with Keyset-Chunking
DROP FUNCTION IF EXISTS public.verify_bronze_immutability_and_hashes();
DROP FUNCTION IF EXISTS public.verify_bronze_immutability_and_hashes(TEXT);
DROP FUNCTION IF EXISTS public.verify_bronze_immutability_and_hashes(TEXT, TEXT, INT);
CREATE OR REPLACE FUNCTION public.verify_bronze_immutability_and_hashes(
    p_table TEXT,
    p_last_key TEXT DEFAULT '',
    p_limit INT DEFAULT 500
)
RETURNS TABLE (
    table_name TEXT,
    total_rows BIGINT,
    rows_with_raw_data BIGINT,
    rows_with_hash BIGINT,
    corrupted_hashes BIGINT,
    next_last_key TEXT,
    has_more BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_limit INT := COALESCE(NULLIF(p_limit, 0), 500);
    v_count BIGINT := 0;
    v_raw_count BIGINT := 0;
    v_hash_count BIGINT := 0;
    v_corrupt_count BIGINT := 0;
    v_next_key TEXT := '';
    v_has_more BOOLEAN := false;
    v_sep_idx INT;
    v_part1 BIGINT;
    v_part2 BIGINT;
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
            LIMIT v_limit
        ) sub;

    ELSIF p_table = 'order_lines' OR p_table = 'order_lines (sub_line=0)' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.order_lines
            WHERE sub_line = 0 AND (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT v_limit
        ) sub;

    ELSIF p_table = 'order_lines_sub1' OR p_table = 'order_lines (sub_line=1)' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_data IS NOT NULL OR lt_raw_hash IS NOT NULL),
            COALESCE(MAX(sub.id::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.order_lines
            WHERE sub_line = 1 AND (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT v_limit
        ) sub;

    ELSIF p_table = 'logictrade_products' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_products
            WHERE (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT v_limit
        ) sub;

    ELSIF p_table = 'logictrade_configurator_schemas' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.option_id::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT option_id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_configurator_schemas
            WHERE (p_last_key = '' OR option_id > p_last_key::bigint)
            ORDER BY option_id ASC
            LIMIT v_limit
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

        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.option_id::text || ':' || sub.value_id::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT option_id, value_id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_configurator_option_values
            WHERE (p_last_key = '' OR (option_id, value_id) > (v_part1, v_part2))
            ORDER BY option_id ASC, value_id ASC
            LIMIT v_limit
        ) sub;

    ELSIF p_table = 'logictrade_customers' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_customers
            WHERE (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT v_limit
        ) sub;

    ELSIF p_table = 'logictrade_suppliers' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_suppliers
            WHERE (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT v_limit
        ) sub;

    ELSIF p_table = 'logictrade_purchase_orders' THEN
        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.id::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT id, lt_raw_data, lt_raw_hash
            FROM public.logictrade_purchase_orders
            WHERE (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT v_limit
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

        SELECT
            COUNT(*),
            COUNT(lt_raw_data),
            COUNT(lt_raw_hash),
            COUNT(*) FILTER (WHERE lt_raw_hash IS NOT NULL AND lt_raw_hash != encode(extensions.digest(lt_raw_data::text, 'sha256'), 'hex')),
            COALESCE(MAX(sub.purchase_order_id::text || ':' || sub.line_number::text), '')
        INTO v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key
        FROM (
            SELECT purchase_order_id, line_number, lt_raw_data, lt_raw_hash
            FROM public.logictrade_purchase_order_lines
            WHERE (p_last_key = '' OR (purchase_order_id, line_number) > (v_part1, v_part2))
            ORDER BY purchase_order_id ASC, line_number ASC
            LIMIT v_limit
        ) sub;

    ELSE
        RAISE EXCEPTION 'Onbekende tabel voor verify_bronze_immutability_and_hashes: %', p_table;
    END IF;

    v_has_more := (v_count = v_limit);

    RETURN QUERY
    SELECT p_table, v_count, v_raw_count, v_hash_count, v_corrupt_count, v_next_key, v_has_more;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. ROLLBACK CONTRACT (DOWN)
-- ------------------------------------------------------------------------------
/*
DROP FUNCTION IF EXISTS public.verify_bronze_immutability_and_hashes();
DROP FUNCTION IF EXISTS public.ingest_logictrade_purchase_orders_batch(JSONB);
DROP FUNCTION IF EXISTS public.ingest_logictrade_suppliers_batch(JSONB);
DROP FUNCTION IF EXISTS public.ingest_logictrade_customers_batch(JSONB);
DROP FUNCTION IF EXISTS public.ingest_logictrade_configurator_option_values_batch(JSONB);
DROP FUNCTION IF EXISTS public.ingest_logictrade_configurator_schemas_batch(JSONB, BOOLEAN);
DROP FUNCTION IF EXISTS public.upsert_logictrade_sync_state(TEXT, INT, INT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.backfill_order_lines_bronze_batch(TEXT[]);
DROP FUNCTION IF EXISTS public.ingest_logictrade_order(JSONB, JSONB);
DROP TRIGGER IF EXISTS trg_order_lines_bronze_immutability ON public.order_lines;
DROP FUNCTION IF EXISTS public.fn_order_lines_bronze_guard();
DROP FUNCTION IF EXISTS public.fn_bronze_compute_hash_and_guard();
DROP TABLE IF EXISTS public.logictrade_purchase_order_lines;
DROP TABLE IF EXISTS public.logictrade_purchase_orders;
DROP TABLE IF EXISTS public.logictrade_suppliers;
DROP TABLE IF EXISTS public.logictrade_customers;
DROP TABLE IF EXISTS public.logictrade_configurator_option_values;
DROP TABLE IF EXISTS public.logictrade_configurator_schemas;
*/
