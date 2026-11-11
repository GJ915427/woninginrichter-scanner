-- Migration: 20261110_02_create_orders_schema.sql
-- Description: Orders & Order Lines Schema, Spatial Hierarchy, CPQ Integers & Transactionele Ingest Procedure

CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT,
    city TEXT,
    quotation_number TEXT,
    order_date DATE,
    sales_rep TEXT,
    branch TEXT,
    fsm_phase TEXT,
    fsm_step INT DEFAULT 5,
    scope_description TEXT,
    total_amount_cents BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    sub_line INT NOT NULL DEFAULT 0,
    product_id BIGINT REFERENCES public.logictrade_products(id),
    product_code TEXT NOT NULL,
    product_group_code TEXT NOT NULL REFERENCES public.product_groups(code),
    description TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'stuks',
    unit_price_cents BIGINT NOT NULL DEFAULT 0,
    total_price_cents BIGINT NOT NULL DEFAULT 0,
    is_hybrid BOOLEAN NOT NULL DEFAULT false,
    is_inbegrepen BOOLEAN NOT NULL DEFAULT false,
    etage_name TEXT DEFAULT 'Begane grond',
    room_name TEXT,
    window_name TEXT,
    position_id TEXT,
    dim TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    dimension_spec JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_order_lines_order_line_subline UNIQUE (order_id, line_number, sub_line)
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON public.order_lines (order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_product_id ON public.order_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_product_group ON public.order_lines (product_group_code);

-- RLS & Policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read orders' AND tablename = 'orders') THEN
        CREATE POLICY "Allow public read orders" ON public.orders FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service_role write orders' AND tablename = 'orders') THEN
        CREATE POLICY "Allow service_role write orders" ON public.orders FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read order_lines' AND tablename = 'order_lines') THEN
        CREATE POLICY "Allow public read order_lines" ON public.order_lines FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service_role write order_lines' AND tablename = 'order_lines') THEN
        CREATE POLICY "Allow service_role write order_lines" ON public.order_lines FOR ALL TO service_role USING (true);
    END IF;
END $$;

-- Transactionele Ingest Procedure
CREATE OR REPLACE FUNCTION public.ingest_logictrade_order(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id text;
    v_order_header jsonb;
    v_lines_count integer := 0;
BEGIN
    v_order_header := p_order->'order';
    v_order_id := v_order_header->>'id';

    IF v_order_id IS NULL OR v_order_id = '' THEN
        RAISE EXCEPTION 'ingest_logictrade_order: order.id is verplicht';
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
    )
    VALUES (
        v_order_id,
        v_order_header->>'order_number',
        v_order_header->>'customer_name',
        v_order_header->>'city',
        v_order_header->>'quotation_number',
        NULLIF(v_order_header->>'order_date', '')::date,
        v_order_header->>'sales_rep',
        v_order_header->>'branch',
        COALESCE(v_order_header->>'fsm_phase', '5. Bestellen (Actueel)'),
        COALESCE((v_order_header->>'fsm_step')::int, 5),
        v_order_header->>'scope_description',
        COALESCE((v_order_header->>'total_amount_cents')::bigint, 0),
        COALESCE(v_order_header->>'status', 'draft'),
        COALESCE(v_order_header->'raw_data', '{}'::jsonb),
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

    -- 2. Upsert Order Lines met COALESCE bescherming voor ruimtelijke stoffeerder-annotaties
    IF p_order ? 'lines' AND jsonb_array_length(p_order->'lines') > 0 THEN
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
                WHEN order_lines.product_code = EXCLUDED.product_code THEN COALESCE(NULLIF(order_lines.product_group_code, '9.9'), EXCLUDED.product_group_code)
                ELSE EXCLUDED.product_group_code
            END,
            description = EXCLUDED.description,
            quantity = EXCLUDED.quantity,
            unit = EXCLUDED.unit,
            unit_price_cents = EXCLUDED.unit_price_cents,
            total_price_cents = EXCLUDED.total_price_cents,
            is_hybrid = EXCLUDED.is_hybrid,
            is_inbegrepen = EXCLUDED.is_inbegrepen,
            -- Behoud bestaande ruimtelijke annotaties via COALESCE
            etage_name = COALESCE(order_lines.etage_name, EXCLUDED.etage_name),
            room_name = COALESCE(order_lines.room_name, EXCLUDED.room_name),
            window_name = COALESCE(order_lines.window_name, EXCLUDED.window_name),
            position_id = COALESCE(order_lines.position_id, EXCLUDED.position_id),
            dim = COALESCE(order_lines.dim, EXCLUDED.dim),
            notes = COALESCE(order_lines.notes, EXCLUDED.notes),
            dimension_spec = COALESCE(order_lines.dimension_spec, EXCLUDED.dimension_spec),
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
