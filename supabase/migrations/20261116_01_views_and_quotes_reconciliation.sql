-- supabase/migrations/20261116_01_views_and_quotes_reconciliation.sql
-- Tranche 1: Database SSOT, Views & Offerte-naar-Order Reconciliatie

-- 1. Schema uitbreiding orders en order_lines tabellen
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS converted_to_order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_orders_quotation_number ON public.orders (quotation_number);
CREATE INDEX IF NOT EXISTS idx_orders_fsm_step ON public.orders (fsm_step);
CREATE INDEX IF NOT EXISTS idx_orders_converted_to_order_id ON public.orders (converted_to_order_id);

ALTER TABLE public.order_lines
ADD COLUMN IF NOT EXISTS configuration_spec jsonb;

CREATE INDEX IF NOT EXISTS idx_order_lines_config_spec ON public.order_lines USING gin (configuration_spec);
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_lines_order_line_sub ON public.order_lines (order_id, line_number, sub_line);

-- 2. SSOT Views
CREATE OR REPLACE VIEW public.active_orders WITH (security_invoker = true) AS
SELECT * FROM public.orders WHERE fsm_step IS DISTINCT FROM 2;

CREATE OR REPLACE VIEW public.active_quotes WITH (security_invoker = true) AS
SELECT * FROM public.orders WHERE fsm_step = 2 AND status IS DISTINCT FROM 'Geconverteerd naar order';

CREATE OR REPLACE VIEW public.active_catalog WITH (security_invoker = true) AS
SELECT * FROM public.orders WHERE status IS DISTINCT FROM 'Geconverteerd naar order';

CREATE OR REPLACE VIEW public.active_order_lines WITH (security_invoker = true) AS
SELECT ol.* FROM public.order_lines ol
JOIN public.orders o ON o.id = ol.order_id
WHERE o.fsm_step IS DISTINCT FROM 2;

GRANT SELECT ON public.active_orders, public.active_quotes, public.active_catalog, public.active_order_lines TO anon, authenticated, service_role;

-- 3. Stored Procedure: public.ingest_logictrade_order(jsonb)
CREATE OR REPLACE FUNCTION public.ingest_logictrade_order(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id text;
    v_order_number text;
    v_quotation_number text;
    v_fsm_step int;
    v_header jsonb;
    v_existing_order_id text;
    v_status text;
    v_converted_to text;
    v_lines_count int := 0;
BEGIN
    v_header := COALESCE(p_order->'order', p_order);
    v_order_id := v_header->>'id';
    IF v_order_id IS NULL OR v_order_id = '' THEN
        RAISE EXCEPTION 'Order ID is verplicht in payload';
    END IF;

    v_fsm_step := COALESCE((v_header->>'fsm_step')::int, 5);
    v_order_number := COALESCE(v_header->>'order_number', v_header->>'number', v_order_id);
    v_status := COALESCE(v_header->>'status', 'concept');
    v_converted_to := NULL;

    IF v_fsm_step = 2 THEN
        v_quotation_number := COALESCE(NULLIF(TRIM(v_header->>'quotation_number'), ''), NULLIF(TRIM(v_header->>'order_number'), ''), NULLIF(TRIM(v_header->>'number'), ''), v_order_id);
    ELSE
        v_quotation_number := COALESCE(NULLIF(TRIM(v_header->>'quotation_number'), ''), NULLIF(TRIM(v_header->'quote'->>'number'), ''));
    END IF;

    -- Tak 2: Out-of-order offerte ingest -> controleer vooraf of er reeds een verkooporder bestaat
    IF v_fsm_step = 2 THEN
        SELECT id INTO v_existing_order_id
        FROM public.orders
        WHERE fsm_step IS DISTINCT FROM 2
          AND (
            quotation_number = v_order_id
            OR quotation_number = v_quotation_number
            OR quotation_number = (v_header->>'order_number')
            OR quotation_number = (v_header->>'number')
          )
        ORDER BY order_date DESC NULLS LAST, id DESC
        LIMIT 1;

        IF v_existing_order_id IS NOT NULL THEN
            v_status := 'Geconverteerd naar order';
            v_converted_to := v_existing_order_id;
        END IF;
    END IF;

    -- Stap 1: Upsert Order Header (MOET eerst gebeuren zodat v_order_id bestaat in orders vóór eventuele FK-koppelingen)
    INSERT INTO public.orders (
        id, order_number, customer_name, city, quotation_number, order_date,
        sales_rep, branch, fsm_phase, fsm_step, scope_description,
        total_amount_cents, status, converted_to_order_id, raw_data, updated_at
    ) VALUES (
        v_order_id,
        v_order_number,
        COALESCE(v_header->>'customer_name', 'Onbekende Klant'),
        v_header->>'city',
        v_quotation_number,
        CASE WHEN v_header->>'order_date' ~ '^\d{4}-\d{2}-\d{2}' THEN (v_header->>'order_date')::date ELSE CURRENT_DATE END,
        v_header->>'sales_rep',
        v_header->>'branch',
        COALESCE(v_header->>'fsm_phase', 'Lead / Intake'),
        v_fsm_step,
        v_header->>'scope_description',
        COALESCE((v_header->>'total_amount_cents')::bigint, 0),
        v_status,
        v_converted_to,
        COALESCE(v_header->'raw_data', '{}'::jsonb),
        now()
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
        status = CASE WHEN orders.status = 'Geconverteerd naar order' THEN orders.status ELSE EXCLUDED.status END,
        converted_to_order_id = COALESCE(EXCLUDED.converted_to_order_id, orders.converted_to_order_id),
        raw_data = EXCLUDED.raw_data,
        updated_at = now();

    -- Stap 2 (Tak 1): Verkooporder ingest -> converteer gekoppelde offerte atomair NA header upsert i.v.m. Foreign Key integriteit
    IF v_quotation_number IS NOT NULL AND TRIM(v_quotation_number) <> '' AND v_fsm_step IS DISTINCT FROM 2 THEN
        UPDATE public.orders
        SET status = 'Geconverteerd naar order',
            converted_to_order_id = v_order_id,
            updated_at = now()
        WHERE (quotation_number = v_quotation_number OR id = v_quotation_number OR order_number = v_quotation_number)
          AND fsm_step = 2;
    END IF;

    -- Stap 3: Upsert Order Lines met external_line_id en JSONB null-trap beveiliging
    IF jsonb_typeof(p_order->'lines') = 'array' AND jsonb_array_length(p_order->'lines') > 0 THEN
        INSERT INTO public.order_lines (
            order_id, line_number, sub_line, external_line_id, product_id, product_code, product_group_code,
            description, quantity, unit, unit_price_cents, total_price_cents,
            is_hybrid, is_inbegrepen, etage_name, room_name, window_name,
            position_id, dim, notes, dimension_spec, configuration_spec, updated_at
        )
        SELECT
            v_order_id,
            (l->>'line_number')::int,
            COALESCE((l->>'sub_line')::int, 0),
            COALESCE(NULLIF(l->>'external_line_id', ''), NULLIF(l->>'id', ''), (l->>'line_number') || '.' || COALESCE(l->>'sub_line', '0')),
            COALESCE(NULLIF(l->>'product_id', '')::bigint, lp.id),
            COALESCE(l->>'product_code', 'TEKST'),
            COALESCE(NULLIF(l->>'product_group_code', ''), lp.product_group_code, '9.9'),
            l->>'description',
            COALESCE((l->>'quantity')::numeric, 1),
            COALESCE(l->>'unit', 'stuks'),
            COALESCE((l->>'unit_price_cents')::bigint, 0),
            COALESCE((l->>'total_price_cents')::bigint, 0),
            COALESCE((l->>'is_hybrid')::boolean, false),
            COALESCE((l->>'is_inbegrepen')::boolean, false),
            COALESCE(l->>'etage_name', 'Begane grond'),
            l->>'room_name',
            l->>'window_name',
            l->>'position_id',
            l->>'dim',
            l->>'notes',
            l->'dimension_spec',
            l->'configuration_spec',
            now()
        FROM jsonb_array_elements(p_order->'lines') AS l
        LEFT JOIN LATERAL (
            SELECT p.id, p.product_group_code
            FROM public.logictrade_products p
            WHERE p.code = l->>'product_code'
            ORDER BY p.modified_at DESC NULLS LAST
            LIMIT 1
        ) lp ON (COALESCE(l->>'product_code', '') NOT IN ('', 'TEKST') AND NULLIF(l->>'product_id', '') IS NULL)
        ON CONFLICT (order_id, line_number, sub_line) DO UPDATE SET
            external_line_id = COALESCE(EXCLUDED.external_line_id, order_lines.external_line_id),
            product_id = COALESCE(EXCLUDED.product_id, order_lines.product_id),
            product_code = EXCLUDED.product_code,
            product_group_code = CASE
                WHEN order_lines.product_code IS DISTINCT FROM EXCLUDED.product_code THEN EXCLUDED.product_group_code
                WHEN EXCLUDED.product_group_code IS DISTINCT FROM '9.9' THEN EXCLUDED.product_group_code
                ELSE order_lines.product_group_code
            END,
            description = EXCLUDED.description,
            quantity = EXCLUDED.quantity,
            unit = EXCLUDED.unit,
            unit_price_cents = EXCLUDED.unit_price_cents,
            total_price_cents = EXCLUDED.total_price_cents,
            is_hybrid = EXCLUDED.is_hybrid,
            is_inbegrepen = EXCLUDED.is_inbegrepen,
            etage_name = COALESCE(order_lines.etage_name, EXCLUDED.etage_name),
            room_name = COALESCE(order_lines.room_name, EXCLUDED.room_name),
            window_name = COALESCE(order_lines.window_name, EXCLUDED.window_name),
            position_id = COALESCE(order_lines.position_id, EXCLUDED.position_id),
            dim = COALESCE(order_lines.dim, EXCLUDED.dim),
            notes = COALESCE(order_lines.notes, EXCLUDED.notes),
            dimension_spec = CASE
                WHEN EXCLUDED.dimension_spec IS NOT NULL AND EXCLUDED.dimension_spec <> 'null'::jsonb AND jsonb_typeof(EXCLUDED.dimension_spec) <> 'null'
                THEN EXCLUDED.dimension_spec
                ELSE order_lines.dimension_spec
            END,
            configuration_spec = CASE
                WHEN EXCLUDED.configuration_spec IS NOT NULL AND EXCLUDED.configuration_spec <> 'null'::jsonb AND jsonb_typeof(EXCLUDED.configuration_spec) <> 'null'
                THEN EXCLUDED.configuration_spec
                ELSE order_lines.configuration_spec
            END,
            updated_at = now();

        GET DIAGNOSTICS v_lines_count = ROW_COUNT;

        DELETE FROM public.order_lines
        WHERE order_id = v_order_id
          AND (line_number, sub_line) NOT IN (
            SELECT (del_l->>'line_number')::int, COALESCE((del_l->>'sub_line')::int, 0)
            FROM jsonb_array_elements(p_order->'lines') AS del_l
          );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'lines_processed', v_lines_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingest_logictrade_order(jsonb) TO anon, authenticated, service_role;

-- 4. Eenmalige forensische backfill van alle 3.882 geconverteerde offertes
UPDATE public.orders q
SET status = 'Geconverteerd naar order',
    converted_to_order_id = sub.order_id,
    updated_at = now()
FROM (
    SELECT DISTINCT ON (o.quotation_number) 
        o.quotation_number, 
        o.id AS order_id
    FROM public.orders o
    WHERE o.fsm_step IS DISTINCT FROM 2 
      AND o.quotation_number IS NOT NULL 
      AND TRIM(o.quotation_number) <> ''
    ORDER BY o.quotation_number, o.created_at DESC
) sub
WHERE (q.order_number = sub.quotation_number OR q.id = sub.quotation_number)
  AND q.fsm_step = 2
  AND q.status IS DISTINCT FROM 'Geconverteerd naar order';

-- 5. PostgREST Schema Cache Reload
NOTIFY pgrst, 'reload schema';
