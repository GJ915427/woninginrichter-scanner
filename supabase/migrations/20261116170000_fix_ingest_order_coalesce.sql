-- ==============================================================================
-- Migration: 20261116170000_fix_ingest_order_coalesce.sql
-- Description: Herdefinitie van public.ingest_logictrade_order(jsonb):
--   1. Integratie van Tranche 1 reconciliatie & external_line_id
--   2. Omkering COALESCE naar NULLIF(TRIM(EXCLUDED.x), '') voor tekstvelden
--   3. Productgroep fallback '9.9' bypass via NULLIF(NULLIF(..., ''), '9.9')
--   4. Fail-closed CASE-trap met ELSE NULL voor dimension_spec en configuration_spec
--   5. Bescherming van bestaande raw_data tegen lege overschrijving
--   6. Sanering van bestaande 'null'::jsonb en '{}'::jsonb besmetting
-- ==============================================================================

-- 1. Sanering van bestaande 'null'::jsonb en '{}'::jsonb besmetting in order_lines
UPDATE public.order_lines
SET dimension_spec = NULL
WHERE dimension_spec = 'null'::jsonb OR dimension_spec = '{}'::jsonb;

UPDATE public.order_lines
SET erp_dimension_spec = NULL
WHERE erp_dimension_spec = 'null'::jsonb OR erp_dimension_spec = '{}'::jsonb;

UPDATE public.order_lines
SET configuration_spec = NULL
WHERE configuration_spec = 'null'::jsonb OR configuration_spec = '{}'::jsonb;

-- 2. Integrale herdefinitie van public.ingest_logictrade_order(jsonb)
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
    v_header := CASE
        WHEN p_order ? 'order' AND jsonb_typeof(p_order->'order') = 'object' THEN p_order->'order'
        ELSE p_order
    END;

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

    -- Stap 1: Upsert Order Header
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
        order_number = COALESCE(NULLIF(TRIM(EXCLUDED.order_number), ''), orders.order_number),
        customer_name = COALESCE(NULLIF(TRIM(EXCLUDED.customer_name), ''), orders.customer_name),
        city = COALESCE(NULLIF(TRIM(EXCLUDED.city), ''), orders.city),
        quotation_number = COALESCE(NULLIF(TRIM(EXCLUDED.quotation_number), ''), orders.quotation_number),
        order_date = COALESCE(EXCLUDED.order_date, orders.order_date),
        sales_rep = COALESCE(NULLIF(TRIM(EXCLUDED.sales_rep), ''), orders.sales_rep),
        branch = COALESCE(NULLIF(TRIM(EXCLUDED.branch), ''), orders.branch),
        fsm_phase = COALESCE(NULLIF(TRIM(EXCLUDED.fsm_phase), ''), orders.fsm_phase),
        fsm_step = COALESCE(EXCLUDED.fsm_step, orders.fsm_step),
        scope_description = COALESCE(NULLIF(TRIM(EXCLUDED.scope_description), ''), orders.scope_description),
        total_amount_cents = EXCLUDED.total_amount_cents,
        status = CASE WHEN orders.status = 'Geconverteerd naar order' THEN orders.status ELSE COALESCE(NULLIF(TRIM(EXCLUDED.status), ''), orders.status) END,
        converted_to_order_id = COALESCE(EXCLUDED.converted_to_order_id, orders.converted_to_order_id),
        raw_data = CASE
            WHEN EXCLUDED.raw_data IS NOT NULL
             AND jsonb_typeof(EXCLUDED.raw_data) = 'object'
             AND EXCLUDED.raw_data <> '{}'::jsonb
            THEN EXCLUDED.raw_data
            ELSE orders.raw_data
        END,
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
            COALESCE(NULLIF(NULLIF(l->>'product_group_code', ''), '9.9'), lp.product_group_code, '9.9'),
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
            CASE
                WHEN l->'dimension_spec' IS NOT NULL
                 AND jsonb_typeof(l->'dimension_spec') = 'object'
                 AND l->'dimension_spec' <> '{}'::jsonb
                 AND l->'dimension_spec' <> 'null'::jsonb
                THEN l->'dimension_spec'
                ELSE NULL
            END,
            CASE
                WHEN l->'configuration_spec' IS NOT NULL
                 AND jsonb_typeof(l->'configuration_spec') = 'object'
                 AND l->'configuration_spec' <> '{}'::jsonb
                 AND l->'configuration_spec' <> 'null'::jsonb
                THEN l->'configuration_spec'
                ELSE NULL
            END,
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
            etage_name = COALESCE(NULLIF(TRIM(EXCLUDED.etage_name), ''), order_lines.etage_name),
            room_name = COALESCE(NULLIF(TRIM(EXCLUDED.room_name), ''), order_lines.room_name),
            window_name = COALESCE(NULLIF(TRIM(EXCLUDED.window_name), ''), order_lines.window_name),
            position_id = COALESCE(NULLIF(TRIM(EXCLUDED.position_id), ''), order_lines.position_id),
            dim = COALESCE(NULLIF(TRIM(EXCLUDED.dim), ''), order_lines.dim),
            notes = COALESCE(NULLIF(TRIM(EXCLUDED.notes), ''), order_lines.notes),
            dimension_spec = CASE
                WHEN EXCLUDED.dimension_spec IS NOT NULL
                 AND jsonb_typeof(EXCLUDED.dimension_spec) = 'object'
                 AND EXCLUDED.dimension_spec <> '{}'::jsonb
                 AND EXCLUDED.dimension_spec <> 'null'::jsonb
                THEN EXCLUDED.dimension_spec
                ELSE NULL
            END,
            configuration_spec = CASE
                WHEN EXCLUDED.configuration_spec IS NOT NULL
                 AND jsonb_typeof(EXCLUDED.configuration_spec) = 'object'
                 AND EXCLUDED.configuration_spec <> '{}'::jsonb
                 AND EXCLUDED.configuration_spec <> 'null'::jsonb
                THEN EXCLUDED.configuration_spec
                ELSE NULL
            END,
            updated_at = now();

        GET DIAGNOSTICS v_lines_count = ROW_COUNT;

        -- 4. Sanering van vervallen regels binnen dezelfde order
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
