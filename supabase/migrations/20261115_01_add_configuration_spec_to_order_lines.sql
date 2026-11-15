-- ==============================================================================
-- Migration: 20261115_01_add_configuration_spec_to_order_lines.sql
-- Description: Toevoegen van configuration_spec (JSONB) aan order_lines en
--              causale sanering van public.ingest_logictrade_order ON CONFLICT lock.
-- ==============================================================================

-- 1. Toevoegen van de configuration_spec kolom aan order_lines (idempotent)
ALTER TABLE public.order_lines
ADD COLUMN IF NOT EXISTS configuration_spec jsonb;

-- 2. GIN Index voor performante JSONB query-patronen
CREATE INDEX IF NOT EXISTS idx_order_lines_config_spec
ON public.order_lines USING gin (configuration_spec);

-- 3. Integrale herdefinitie van public.ingest_logictrade_order(jsonb)
CREATE OR REPLACE FUNCTION public.ingest_logictrade_order(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id text;
    v_lines_count int := 0;
BEGIN
    v_order_id := p_order->>'id';
    IF v_order_id IS NULL OR v_order_id = '' THEN
        RAISE EXCEPTION 'Order ID is verplicht in payload';
    END IF;

    -- 1. Upsert Order Header
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
        updated_at
    ) VALUES (
        v_order_id,
        COALESCE(p_order->>'order_number', v_order_id),
        COALESCE(p_order->>'customer_name', 'Onbekende Klant'),
        p_order->>'city',
        p_order->>'quotation_number',
        CASE
            WHEN p_order->>'order_date' ~ '^\d{4}-\d{2}-\d{2}' THEN (p_order->>'order_date')::date
            ELSE CURRENT_DATE
        END,
        p_order->>'sales_rep',
        p_order->>'branch',
        COALESCE(p_order->>'fsm_phase', 'Lead / Intake'),
        COALESCE((p_order->>'fsm_step')::int, 1),
        p_order->>'scope_description',
        COALESCE((p_order->>'total_amount_cents')::bigint, 0),
        COALESCE(p_order->>'status', 'concept'),
        COALESCE(p_order->'raw_data', '{}'::jsonb),
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
        status = EXCLUDED.status,
        raw_data = EXCLUDED.raw_data,
        updated_at = now();

    -- 2. Upsert Order Lines met configuration_spec en causale ON CONFLICT resolutie
    IF p_order->'lines' IS NOT NULL AND jsonb_array_length(p_order->'lines') > 0 THEN
        INSERT INTO public.order_lines (
            order_id,
            line_number,
            sub_line,
            product_id,
            product_code,
            product_group_code,
            description,
            quantity,
            unit,
            unit_price_cents,
            total_price_cents,
            is_hybrid,
            is_inbegrepen,
            etage_name,
            room_name,
            window_name,
            position_id,
            dim,
            notes,
            dimension_spec,
            configuration_spec,
            updated_at
        )
        SELECT
            v_order_id,
            (l->>'line_number')::int,
            COALESCE((l->>'sub_line')::int, 0),
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
            dimension_spec = COALESCE(order_lines.dimension_spec, EXCLUDED.dimension_spec),
            configuration_spec = EXCLUDED.configuration_spec,
            updated_at = now();

        GET DIAGNOSTICS v_lines_count = ROW_COUNT;

        -- 3. Sanering van vervallen regels binnen dezelfde order
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
