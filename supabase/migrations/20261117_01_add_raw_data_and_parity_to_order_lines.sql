-- ==============================================================================
-- 1. Tabel-uitbreiding public.order_lines met Bronze lt_ Kolommen & Aliassen
-- ==============================================================================
ALTER TABLE public.order_lines
    ADD COLUMN IF NOT EXISTS lt_raw_data JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_id TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_configuration_json JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_configuration JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_width_mm INT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_height_mm INT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_options JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS lt_supplier_name TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_supplier_code TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_comment_extern TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_comment_intern TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_vat_code TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_vat_percentage NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_discount_percentage NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_base_price_cents BIGINT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_reservations JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS lt_stock_status TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_delivery_status TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_invoice_status TEXT DEFAULT NULL;

-- Robuuste mitigatie voor fysieke schema-constraint op external_line_id (P0-Bevinding 1, Ronde 19 & P1-Bevinding 3, Ronde 20)
ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS external_line_id TEXT DEFAULT NULL;
ALTER TABLE public.order_lines ALTER COLUMN external_line_id DROP NOT NULL;
ALTER TABLE public.order_lines ALTER COLUMN external_line_id SET DEFAULT NULL;

-- Orders Bronze uitbreiding (Zuiver instant DDL: geen synchrone monolithische updates)
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS lt_id TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lt_raw_data JSONB DEFAULT NULL;

-- Catalogus Bronze uitbreiding (100% pariteit over alle EasyM2M tabellen)
ALTER TABLE public.logictrade_products
    ADD COLUMN IF NOT EXISTS lt_raw_data JSONB DEFAULT NULL;

-- ==============================================================================
-- 2. View Vernieuwing: SSOT Views met View-Level Backwards Compatibility Aliassen
-- ==============================================================================
CREATE OR REPLACE VIEW public.active_orders WITH (security_invoker = true) AS
SELECT * FROM public.orders WHERE fsm_step IS DISTINCT FROM 2;

CREATE OR REPLACE VIEW public.active_quotes WITH (security_invoker = true) AS
SELECT * FROM public.orders WHERE fsm_step = 2 AND status IS DISTINCT FROM 'Geconverteerd naar order';

CREATE OR REPLACE VIEW public.active_catalog WITH (security_invoker = true) AS
SELECT * FROM public.orders WHERE status IS DISTINCT FROM 'Geconverteerd naar order';

CREATE OR REPLACE VIEW public.active_order_lines WITH (security_invoker = true) AS
SELECT 
    ol.*,
    ol.lt_comment_extern AS comment_extern,
    ol.lt_comment_intern AS comment_intern,
    ol.lt_raw_data AS raw_data
FROM public.order_lines ol
JOIN public.orders o ON o.id = ol.order_id
WHERE o.fsm_step IS DISTINCT FROM 2;

-- ==============================================================================
-- 3. Integrale Herdefinitie public.ingest_logictrade_order(jsonb)
-- ==============================================================================
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
    v_lines jsonb;
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

    -- Extractie van regels met ondersteuning voor zowel 'lines' als 'orderLines' (P0-Bevinding 1)
    v_lines := CASE
        WHEN p_order ? 'lines' AND jsonb_typeof(p_order->'lines') = 'array' THEN p_order->'lines'
        WHEN p_order ? 'orderLines' AND jsonb_typeof(p_order->'orderLines') = 'array' THEN p_order->'orderLines'
        WHEN v_header ? 'lines' AND jsonb_typeof(v_header->'lines') = 'array' THEN v_header->'lines'
        WHEN v_header ? 'orderLines' AND jsonb_typeof(v_header->'orderLines') = 'array' THEN v_header->'orderLines'
        ELSE '[]'::jsonb
    END;

    v_fsm_step := COALESCE(
        NULLIF(TRIM(v_header->>'fsm_step'), '')::int,
        CASE 
            WHEN (v_header->>'number' ILIKE 'O%' OR v_header ? 'quote' OR v_header->>'status' ILIKE '%offerte%') THEN 2 
            ELSE 5 
        END
    );
    v_order_number := COALESCE(v_header->>'order_number', v_header->>'number', v_order_id);
    v_status := COALESCE(v_header->>'status', 'concept');
    v_converted_to := NULL;

    IF v_fsm_step = 2 THEN
        v_quotation_number := COALESCE(NULLIF(TRIM(v_header->>'quotation_number'), ''), NULLIF(TRIM(v_header->>'order_number'), ''), NULLIF(TRIM(v_header->>'number'), ''), v_order_id);
    ELSE
        v_quotation_number := COALESCE(NULLIF(TRIM(v_header->>'quotation_number'), ''), NULLIF(TRIM(v_header->'quote'->>'number'), ''));
    END IF;

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

    -- Stap 1: Upsert Order Header met defensieve inspectie voor lt_raw_data
    INSERT INTO public.orders (
        id, order_number, customer_name, city, quotation_number, order_date,
        sales_rep, branch, fsm_phase, fsm_step, scope_description,
        total_amount_cents, status, converted_to_order_id, raw_data, lt_raw_data, lt_id, updated_at
    ) VALUES (
        v_order_id,
        v_order_number,
        COALESCE(v_header->>'customer_name', 'Onbekende Klant'),
        v_header->>'city',
        v_quotation_number,
        CASE 
            WHEN v_header->>'order_date' ~ '^\d{4}-\d{2}-\d{2}' THEN (v_header->>'order_date')::date 
            WHEN v_header->>'date' ~ '^\d{4}-\d{2}-\d{2}' THEN (v_header->>'date')::date 
            WHEN v_header->>'createdDate' ~ '^\d{4}-\d{2}-\d{2}' THEN (v_header->>'createdDate')::date 
            ELSE CURRENT_DATE 
        END,
        v_header->>'sales_rep',
        v_header->>'branch',
        COALESCE(v_header->>'fsm_phase', CASE WHEN v_fsm_step = 2 THEN '2. Offerte' ELSE '5. Bestellen (Actueel)' END),
        v_fsm_step,
        v_header->>'scope_description',
        COALESCE(
            NULLIF(TRIM(v_header->>'total_amount_cents'), '')::bigint,
            ROUND(NULLIF(TRIM(v_header->>'totalAmount'), '')::numeric * 100)::bigint,
            0
        ),
        v_status,
        v_converted_to,
        COALESCE(
            CASE WHEN v_header ? 'raw_data' AND jsonb_typeof(v_header->'raw_data') = 'object' AND v_header->'raw_data' <> '{}'::jsonb THEN v_header->'raw_data'
                 WHEN v_header ? 'lt_raw_data' AND jsonb_typeof(v_header->'lt_raw_data') = 'object' AND v_header->'lt_raw_data' <> '{}'::jsonb THEN v_header->'lt_raw_data'
                 WHEN jsonb_typeof(v_header) = 'object' AND (v_header ? 'number' OR v_header ? 'id' OR v_header ? 'lines') THEN v_header
                 ELSE '{}'::jsonb END,
            '{}'::jsonb
        ),
        COALESCE(
            CASE WHEN v_header ? 'lt_raw_data' AND jsonb_typeof(v_header->'lt_raw_data') = 'object' AND v_header->'lt_raw_data' <> '{}'::jsonb THEN v_header->'lt_raw_data'
                 WHEN v_header ? 'raw_data' AND jsonb_typeof(v_header->'raw_data') = 'object' AND v_header->'raw_data' <> '{}'::jsonb THEN v_header->'raw_data'
                 WHEN jsonb_typeof(v_header) = 'object' AND (v_header ? 'number' OR v_header ? 'id' OR v_header ? 'lines') THEN v_header
                 ELSE '{}'::jsonb END,
            '{}'::jsonb
        ),
        v_order_id,
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        order_number = COALESCE(NULLIF(TRIM(EXCLUDED.order_number), ''), orders.order_number),
        quotation_number = COALESCE(NULLIF(TRIM(EXCLUDED.quotation_number), ''), orders.quotation_number),
        order_date = COALESCE(EXCLUDED.order_date, orders.order_date),
        customer_name = COALESCE(NULLIF(TRIM(EXCLUDED.customer_name), ''), orders.customer_name),
        city = COALESCE(NULLIF(TRIM(EXCLUDED.city), ''), orders.city),
        sales_rep = COALESCE(NULLIF(TRIM(EXCLUDED.sales_rep), ''), orders.sales_rep),
        branch = COALESCE(NULLIF(TRIM(EXCLUDED.branch), ''), orders.branch),
        fsm_phase = COALESCE(NULLIF(TRIM(EXCLUDED.fsm_phase), ''), orders.fsm_phase),
        fsm_step = COALESCE(EXCLUDED.fsm_step, orders.fsm_step),
        scope_description = COALESCE(NULLIF(TRIM(EXCLUDED.scope_description), ''), orders.scope_description),
        total_amount_cents = EXCLUDED.total_amount_cents,
        status = CASE WHEN orders.status = 'Geconverteerd naar order' THEN orders.status ELSE COALESCE(NULLIF(TRIM(EXCLUDED.status), ''), orders.status) END,
        converted_to_order_id = COALESCE(EXCLUDED.converted_to_order_id, orders.converted_to_order_id),
        raw_data = CASE
            WHEN EXCLUDED.raw_data IS NOT NULL AND jsonb_typeof(EXCLUDED.raw_data) = 'object' AND EXCLUDED.raw_data <> '{}'::jsonb
            THEN EXCLUDED.raw_data ELSE orders.raw_data END,
        lt_raw_data = CASE
            WHEN EXCLUDED.lt_raw_data IS NOT NULL AND jsonb_typeof(EXCLUDED.lt_raw_data) = 'object' AND EXCLUDED.lt_raw_data <> '{}'::jsonb
            THEN EXCLUDED.lt_raw_data ELSE orders.lt_raw_data END,
        lt_id = COALESCE(EXCLUDED.lt_id, orders.lt_id),
        updated_at = now();

    -- Stap 2: Converteer gekoppelde offerte
    IF v_quotation_number IS NOT NULL AND TRIM(v_quotation_number) <> '' AND v_fsm_step IS DISTINCT FROM 2 THEN
        UPDATE public.orders
        SET status = 'Geconverteerd naar order',
            converted_to_order_id = v_order_id,
            updated_at = now()
        WHERE (quotation_number = v_quotation_number OR id = v_quotation_number OR order_number = v_quotation_number)
          AND fsm_step = 2;
    END IF;

    -- Stap 3: Upsert Order Lines met zuiver geharmoniseerde lt_* Bronze Kolommen (P0-Bevinding 1)
    IF jsonb_array_length(v_lines) > 0 THEN
        INSERT INTO public.order_lines (
            order_id, line_number, sub_line, external_line_id, lt_id, product_id, product_code, product_group_code,
            description, quantity, unit, unit_price_cents, total_price_cents,
            is_hybrid, is_inbegrepen, etage_name, room_name, window_name,
            position_id, dim, notes, dimension_spec, configuration_spec,
            lt_raw_data, lt_configuration_json, lt_configuration,
            lt_width_mm, lt_height_mm, lt_options,
            lt_supplier_name, lt_supplier_code,
            lt_comment_extern, lt_comment_intern, lt_vat_code,
            lt_vat_percentage, lt_discount_percentage,
            lt_base_price_cents, lt_reservations,
            lt_stock_status, lt_delivery_status,
            lt_invoice_status, updated_at
        )
        SELECT
            v_order_id,
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'line_number'), '')::int,
                NULLIF(TRIM(l_ord.l->>'lineNumber'), '')::int,
                (l_ord.ord * 10)
            ),
            COALESCE(NULLIF(TRIM(l_ord.l->>'sub_line'), '')::int, 0),
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'external_line_id'), ''),
                NULLIF(TRIM(l_ord.l->>'lt_id'), ''),
                NULLIF(TRIM(l_ord.l->>'id'), ''),
                (COALESCE(NULLIF(TRIM(l_ord.l->>'line_number'), ''), NULLIF(TRIM(l_ord.l->>'lineNumber'), ''), (l_ord.ord * 10)::text) || '.' || COALESCE(NULLIF(TRIM(l_ord.l->>'sub_line'), ''), '0'))
            ),
            COALESCE(NULLIF(TRIM(l_ord.l->>'lt_id'), ''), NULLIF(TRIM(l_ord.l->>'id'), '')),
            COALESCE(NULLIF(TRIM(l_ord.l->>'product_id'), '')::bigint, lp.id),
            COALESCE(NULLIF(TRIM(l_ord.l->>'product_code'), ''), NULLIF(TRIM(l_ord.l->>'articleCode'), ''), NULLIF(TRIM(l_ord.l->>'code'), ''), 'TEKST'),
            COALESCE(NULLIF(NULLIF(TRIM(l_ord.l->>'product_group_code'), ''), '9.9'), lp.product_group_code, '9.9'),
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'description'), ''),
                NULLIF(TRIM(l_ord.l->>'articleDescription'), ''),
                'Vrije tekstregel'
            ),
            COALESCE(NULLIF(TRIM(l_ord.l->>'quantity'), '')::numeric, 1),
            COALESCE(NULLIF(TRIM(l_ord.l->>'unit'), ''), 'stuks'),
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'unit_price_cents'), '')::bigint,
                ROUND(NULLIF(TRIM(l_ord.l->>'partPrice'), '')::numeric * 100)::bigint,
                0
            ),
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'total_price_cents'), '')::bigint,
                ROUND(NULLIF(TRIM(l_ord.l->>'linePrice'), '')::numeric * 100)::bigint,
                ROUND(NULLIF(TRIM(l_ord.l->>'totalPrice'), '')::numeric * 100)::bigint,
                (COALESCE(
                    NULLIF(TRIM(l_ord.l->>'unit_price_cents'), '')::bigint,
                    ROUND(NULLIF(TRIM(l_ord.l->>'partPrice'), '')::numeric * 100)::bigint,
                    0
                ) * COALESCE(NULLIF(TRIM(l_ord.l->>'quantity'), '')::numeric, 1))::bigint
            ),
            COALESCE((l_ord.l->>'is_hybrid')::boolean, false),
            COALESCE((l_ord.l->>'is_inbegrepen')::boolean, false),
            COALESCE(NULLIF(TRIM(l_ord.l->>'etage_name'), ''), 'Begane grond'),
            l_ord.l->>'room_name',
            l_ord.l->>'window_name',
            l_ord.l->>'position_id',
            l_ord.l->>'dim',
            l_ord.l->>'notes',
            CASE
                WHEN l_ord.l->'dimension_spec' IS NOT NULL AND jsonb_typeof(l_ord.l->'dimension_spec') = 'object' AND l_ord.l->'dimension_spec' <> '{}'::jsonb AND l_ord.l->'dimension_spec' <> 'null'::jsonb
                THEN l_ord.l->'dimension_spec' ELSE NULL
            END,
            CASE
                WHEN l_ord.l->'configuration_spec' IS NOT NULL AND jsonb_typeof(l_ord.l->'configuration_spec') = 'object' AND l_ord.l->'configuration_spec' <> '{}'::jsonb AND l_ord.l->'configuration_spec' <> 'null'::jsonb
                THEN l_ord.l->'configuration_spec' ELSE NULL
            END,
            -- lt_raw_data: 100% integraal onvervormd bronsysteem payload (SSOT)
            CASE 
                WHEN l_ord.l ? 'lt_raw_data' AND jsonb_typeof(l_ord.l->'lt_raw_data') = 'object' AND l_ord.l->'lt_raw_data' <> '{}'::jsonb THEN l_ord.l->'lt_raw_data'
                WHEN l_ord.l ? 'raw_data' AND jsonb_typeof(l_ord.l->'raw_data') = 'object' AND l_ord.l->'raw_data' <> '{}'::jsonb THEN l_ord.l->'raw_data'
                WHEN jsonb_typeof(l_ord.l) = 'object' AND (l_ord.l ? 'lineNumber' OR l_ord.l ? 'articleCode' OR l_ord.l ? 'articleDescription' OR l_ord.l ? 'partPrice' OR l_ord.l ? 'grossPrice' OR l_ord.l ? 'linePrice' OR l_ord.l ? 'configurationJson') THEN l_ord.l
                ELSE NULL 
            END,
            -- lt_configuration_json (Decoloop e-Order SSOT)
            CASE
                WHEN l_ord.l ? 'lt_configuration_json' AND l_ord.l->'lt_configuration_json' IS NOT NULL AND l_ord.l->'lt_configuration_json' <> 'null'::jsonb THEN l_ord.l->'lt_configuration_json'
                WHEN l_ord.l ? 'configurationJson' AND l_ord.l->'configurationJson' IS NOT NULL AND l_ord.l->'configurationJson' <> 'null'::jsonb THEN l_ord.l->'configurationJson'
                WHEN l_ord.l ? 'configuration_json' AND l_ord.l->'configuration_json' IS NOT NULL AND l_ord.l->'configuration_json' <> 'null'::jsonb THEN l_ord.l->'configuration_json'
                ELSE NULL
            END,
            -- lt_configuration (Decoloop wizardstappen en items array)
            CASE
                WHEN l_ord.l ? 'lt_configuration' AND jsonb_typeof(l_ord.l->'lt_configuration') = 'object' THEN l_ord.l->'lt_configuration'
                WHEN l_ord.l ? 'configuration' AND jsonb_typeof(l_ord.l->'configuration') = 'object' THEN l_ord.l->'configuration'
                ELSE NULL
            END,
            -- lt_width_mm en lt_height_mm
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'lt_width_mm'), '')::int,
                NULLIF(TRIM(l_ord.l->>'widthMm'), '')::int,
                NULLIF(TRIM(l_ord.l->>'width_mm'), '')::int
            ),
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'lt_height_mm'), '')::int,
                NULLIF(TRIM(l_ord.l->>'heightMm'), '')::int,
                NULLIF(TRIM(l_ord.l->>'height_mm'), '')::int
            ),
            -- lt_options
            CASE
                WHEN l_ord.l ? 'lt_options' AND jsonb_typeof(l_ord.l->'lt_options') = 'array' THEN l_ord.l->'lt_options'
                WHEN l_ord.l ? 'options' AND jsonb_typeof(l_ord.l->'options') = 'array' THEN l_ord.l->'options'
                ELSE NULL
            END,
            -- lt_supplier_name en lt_supplier_code
            COALESCE(NULLIF(TRIM(l_ord.l->>'lt_supplier_name'), ''), NULLIF(TRIM(l_ord.l->>'supplierName'), ''), NULLIF(TRIM(l_ord.l->>'supplier_name'), '')),
            COALESCE(NULLIF(TRIM(l_ord.l->>'lt_supplier_code'), ''), NULLIF(TRIM(l_ord.l->>'supplierCode'), ''), NULLIF(TRIM(l_ord.l->>'supplier_code'), '')),
            -- lt_comment_extern
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'lt_comment_extern'), ''),
                NULLIF(TRIM(l_ord.l->>'comment_extern'), ''),
                CASE 
                    WHEN jsonb_typeof(l_ord.l->'comment') = 'object' THEN NULLIF(TRIM(l_ord.l->'comment'->>'extern'), '')
                    WHEN jsonb_typeof(l_ord.l->'comment') = 'string' THEN NULLIF(TRIM(l_ord.l->>'comment'), '')
                    ELSE NULL
                END
            ),
            -- lt_comment_intern
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'lt_comment_intern'), ''),
                NULLIF(TRIM(l_ord.l->>'comment_intern'), ''),
                CASE 
                    WHEN jsonb_typeof(l_ord.l->'comment') = 'object' THEN NULLIF(TRIM(l_ord.l->'comment'->>'intern'), '')
                    ELSE NULL
                END
            ),
            -- lt_vat_code
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'lt_vat_code'), ''),
                NULLIF(TRIM(l_ord.l->>'vat_code'), ''),
                NULLIF(TRIM(l_ord.l->'vat'->>'code'), ''),
                NULLIF(TRIM(l_ord.l->>'vatCode'), '')
            ),
            -- lt_vat_percentage
            COALESCE(
                NULLIF(TRIM(l_ord.l->>'lt_vat_percentage'), '')::numeric,
                NULLIF(TRIM(l_ord.l->>'vat_percentage'), '')::numeric,
                NULLIF(TRIM(l_ord.l->'vat'->>'percentage'), '')::numeric,
                NULLIF(TRIM(l_ord.l->>'vatPercentage'), '')::numeric
            ),
            -- lt_discount_percentage
            COALESCE(NULLIF(TRIM(l_ord.l->>'lt_discount_percentage'), '')::numeric, NULLIF(TRIM(l_ord.l->>'discount_percentage'), '')::numeric, NULLIF(TRIM(l_ord.l->>'discount'), '')::numeric, NULLIF(TRIM(l_ord.l->>'discountPercentage'), '')::numeric),
            -- lt_base_price_cents
            COALESCE(NULLIF(TRIM(l_ord.l->>'lt_base_price_cents'), '')::bigint, NULLIF(TRIM(l_ord.l->>'base_price_cents'), '')::bigint, ROUND(NULLIF(TRIM(l_ord.l->>'basePartPrice'), '')::numeric * 100)::bigint),
            -- lt_reservations
            CASE
                WHEN l_ord.l ? 'lt_reservations' AND jsonb_typeof(l_ord.l->'lt_reservations') = 'array' THEN l_ord.l->'lt_reservations'
                WHEN l_ord.l ? 'reservations' AND jsonb_typeof(l_ord.l->'reservations') = 'array' THEN l_ord.l->'reservations'
                ELSE '[]'::jsonb
            END,
            -- lt_stock_status
            COALESCE(NULLIF(TRIM(l_ord.l->>'lt_stock_status'), ''), NULLIF(TRIM(l_ord.l->>'stock_status'), ''), NULLIF(TRIM(l_ord.l->>'stockStatus'), '')),
            -- lt_delivery_status
            COALESCE(NULLIF(TRIM(l_ord.l->>'lt_delivery_status'), ''), NULLIF(TRIM(l_ord.l->>'delivery_status'), ''), NULLIF(TRIM(l_ord.l->>'deliveryStatus'), '')),
            -- lt_invoice_status
            COALESCE(NULLIF(TRIM(l_ord.l->>'lt_invoice_status'), ''), NULLIF(TRIM(l_ord.l->>'invoice_status'), ''), NULLIF(TRIM(l_ord.l->>'invoiceStatus'), '')),
            now()
        FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS l_ord(l, ord)
        -- Deterministische LATERAL join met LIMIT 1, tie-breaker en dubbele code-inspectie
        LEFT JOIN LATERAL (
            SELECT id, product_group_code
            FROM public.logictrade_products
            WHERE code = COALESCE(NULLIF(TRIM(l_ord.l->>'product_code'), ''), NULLIF(TRIM(l_ord.l->>'articleCode'), ''), NULLIF(TRIM(l_ord.l->>'code'), ''))
            ORDER BY modified_at DESC NULLS LAST, id DESC
            LIMIT 1
        ) lp ON (
            COALESCE(NULLIF(TRIM(l_ord.l->>'product_code'), ''), NULLIF(TRIM(l_ord.l->>'articleCode'), ''), NULLIF(TRIM(l_ord.l->>'code'), ''), '') NOT IN ('', 'TEKST')
            AND NULLIF(l_ord.l->>'product_id', '') IS NULL
        )
        ON CONFLICT (order_id, line_number, sub_line) DO UPDATE SET
            external_line_id = COALESCE(NULLIF(TRIM(EXCLUDED.external_line_id), ''), order_lines.external_line_id),
            lt_id = COALESCE(NULLIF(TRIM(EXCLUDED.lt_id), ''), order_lines.lt_id),
            product_id = COALESCE(EXCLUDED.product_id, order_lines.product_id),
            product_code = COALESCE(NULLIF(TRIM(EXCLUDED.product_code), ''), order_lines.product_code),
            product_group_code = CASE
                WHEN order_lines.product_group_code IS NOT NULL AND order_lines.product_group_code <> '9.9'
                THEN order_lines.product_group_code ELSE EXCLUDED.product_group_code END,
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
                WHEN EXCLUDED.dimension_spec IS NOT NULL AND jsonb_typeof(EXCLUDED.dimension_spec) = 'object' AND EXCLUDED.dimension_spec <> '{}'::jsonb AND EXCLUDED.dimension_spec <> 'null'::jsonb
                THEN EXCLUDED.dimension_spec ELSE NULL END,
            configuration_spec = CASE
                WHEN EXCLUDED.configuration_spec IS NOT NULL AND jsonb_typeof(EXCLUDED.configuration_spec) = 'object' AND EXCLUDED.configuration_spec <> '{}'::jsonb AND EXCLUDED.configuration_spec <> 'null'::jsonb
                THEN EXCLUDED.configuration_spec ELSE NULL END,
            lt_raw_data = CASE
                WHEN EXCLUDED.lt_raw_data IS NOT NULL AND jsonb_typeof(EXCLUDED.lt_raw_data) = 'object' AND EXCLUDED.lt_raw_data <> '{}'::jsonb
                THEN EXCLUDED.lt_raw_data ELSE order_lines.lt_raw_data END,
            lt_configuration_json = CASE
                WHEN EXCLUDED.lt_configuration_json IS NOT NULL AND EXCLUDED.lt_configuration_json <> 'null'::jsonb
                THEN EXCLUDED.lt_configuration_json ELSE order_lines.lt_configuration_json END,
            lt_configuration = CASE
                WHEN EXCLUDED.lt_configuration IS NOT NULL AND jsonb_typeof(EXCLUDED.lt_configuration) = 'object'
                THEN EXCLUDED.lt_configuration ELSE order_lines.lt_configuration END,
            lt_width_mm = COALESCE(EXCLUDED.lt_width_mm, order_lines.lt_width_mm),
            lt_height_mm = COALESCE(EXCLUDED.lt_height_mm, order_lines.lt_height_mm),
            lt_options = COALESCE(EXCLUDED.lt_options, order_lines.lt_options),
            lt_supplier_name = COALESCE(NULLIF(TRIM(EXCLUDED.lt_supplier_name), ''), order_lines.lt_supplier_name),
            lt_supplier_code = COALESCE(NULLIF(TRIM(EXCLUDED.lt_supplier_code), ''), order_lines.lt_supplier_code),
            lt_comment_extern = COALESCE(NULLIF(TRIM(EXCLUDED.lt_comment_extern), ''), order_lines.lt_comment_extern),
            lt_comment_intern = COALESCE(NULLIF(TRIM(EXCLUDED.lt_comment_intern), ''), order_lines.lt_comment_intern),
            lt_vat_code = COALESCE(NULLIF(TRIM(EXCLUDED.lt_vat_code), ''), order_lines.lt_vat_code),
            lt_vat_percentage = COALESCE(EXCLUDED.lt_vat_percentage, order_lines.lt_vat_percentage),
            lt_discount_percentage = COALESCE(EXCLUDED.lt_discount_percentage, order_lines.lt_discount_percentage),
            lt_base_price_cents = COALESCE(EXCLUDED.lt_base_price_cents, order_lines.lt_base_price_cents),
            lt_reservations = COALESCE(EXCLUDED.lt_reservations, order_lines.lt_reservations),
            lt_stock_status = COALESCE(NULLIF(TRIM(EXCLUDED.lt_stock_status), ''), order_lines.lt_stock_status),
            lt_delivery_status = COALESCE(NULLIF(TRIM(EXCLUDED.lt_delivery_status), ''), order_lines.lt_delivery_status),
            lt_invoice_status = COALESCE(NULLIF(TRIM(EXCLUDED.lt_invoice_status), ''), order_lines.lt_invoice_status),
            updated_at = now();

        GET DIAGNOSTICS v_lines_count = ROW_COUNT;

        -- Sanering van vervallen regels met behoud van synthetische serviceregels bij ruwe ERP ingest
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) AS chk_l WHERE COALESCE(NULLIF(TRIM(chk_l.value->>'sub_line'), '')::int, 0) > 0) THEN
            DELETE FROM public.order_lines
            WHERE order_id = v_order_id
              AND (line_number, sub_line) NOT IN (
                SELECT 
                    COALESCE(NULLIF(TRIM(del_l.l->>'line_number'), '')::int, NULLIF(TRIM(del_l.l->>'lineNumber'), '')::int, (del_l.ord * 10)),
                    COALESCE(NULLIF(TRIM(del_l.l->>'sub_line'), '')::int, 0)
                FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS del_l(l, ord)
              );
        ELSE
            -- Ruwe ERP payload (bevat geen sub_line): verwijder uitsluitend regels waarvan het hoofd-line_number is vervallen
            DELETE FROM public.order_lines
            WHERE order_id = v_order_id
              AND line_number NOT IN (
                SELECT COALESCE(NULLIF(TRIM(del_l.l->>'line_number'), '')::int, NULLIF(TRIM(del_l.l->>'lineNumber'), '')::int, (del_l.ord * 10))
                FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS del_l(l, ord)
              );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'lines_processed', v_lines_count
    );
END;
$$;

-- ==============================================================================
-- 4. Batch Backfill RPC voor Order Lines & Orders met lt_ Prefix Pariteit
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.backfill_order_lines_bronze_batch(p_order_ids text[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated_count int := 0;
    v_synth_count int := 0;
BEGIN
    -- Stap 0: Micro-batch update van public.orders (geen monolithische locks)
    UPDATE public.orders
    SET lt_id = COALESCE(lt_id, id),
        lt_raw_data = COALESCE(lt_raw_data, raw_data)
    WHERE id = ANY(p_order_ids)
      AND (lt_raw_data IS NULL OR lt_id IS NULL)
      AND raw_data IS NOT NULL;

    -- Stap 1: Update sub_line = 0 met inspectie voor zowel 'lines' als 'orderLines' (P0-Bevinding 1)
    WITH order_source AS (\n        SELECT 
            o.id,
            COALESCE(o.lt_raw_data, o.raw_data) AS payload
        FROM public.orders o
        WHERE o.id = ANY(p_order_ids)
          AND COALESCE(o.lt_raw_data, o.raw_data) IS NOT NULL
          AND COALESCE(o.lt_raw_data, o.raw_data) <> '{}'::jsonb
    ),
    raw_lines AS (
        SELECT 
            os.id AS order_id,
            COALESCE(
                NULLIF(TRIM(l.elem->>'line_number'), '')::int,
                NULLIF(TRIM(l.elem->>'lineNumber'), '')::int,
                (l.ord * 10)
            ) AS line_number,
            l.elem AS raw_line
        FROM order_source os
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(os.payload->'lines') = 'array' THEN os.payload->'lines'
                WHEN jsonb_typeof(os.payload->'orderLines') = 'array' THEN os.payload->'orderLines'
                ELSE '[]'::jsonb
            END
        ) WITH ORDINALITY AS l(elem, ord)
    )
    UPDATE public.order_lines ol
    SET 
        lt_raw_data = rl.raw_line,
        lt_configuration_json = CASE
            WHEN rl.raw_line ? 'configurationJson' AND rl.raw_line->'configurationJson' IS NOT NULL AND rl.raw_line->'configurationJson' <> 'null'::jsonb THEN rl.raw_line->'configurationJson'
            WHEN rl.raw_line ? 'configuration_json' AND rl.raw_line->'configuration_json' IS NOT NULL AND rl.raw_line->'configuration_json' <> 'null'::jsonb THEN rl.raw_line->'configuration_json'
            ELSE ol.lt_configuration_json
        END,
        lt_configuration = CASE
            WHEN rl.raw_line ? 'configuration' AND jsonb_typeof(rl.raw_line->'configuration') = 'object' THEN rl.raw_line->'configuration'
            ELSE ol.lt_configuration
        END,
        lt_width_mm = COALESCE(NULLIF(TRIM(rl.raw_line->>'widthMm'), '')::int, NULLIF(TRIM(rl.raw_line->>'width_mm'), '')::int, ol.lt_width_mm),
        lt_height_mm = COALESCE(NULLIF(TRIM(rl.raw_line->>'heightMm'), '')::int, NULLIF(TRIM(rl.raw_line->>'height_mm'), '')::int, ol.lt_height_mm),
        lt_options = CASE
            WHEN rl.raw_line ? 'options' AND jsonb_typeof(rl.raw_line->'options') = 'array' THEN rl.raw_line->'options'
            ELSE ol.lt_options
        END,
        lt_supplier_name = COALESCE(NULLIF(TRIM(rl.raw_line->>'supplierName'), ''), NULLIF(TRIM(rl.raw_line->>'supplier_name'), ''), ol.lt_supplier_name),
        lt_supplier_code = COALESCE(NULLIF(TRIM(rl.raw_line->>'supplierCode'), ''), NULLIF(TRIM(rl.raw_line->>'supplier_code'), ''), ol.lt_supplier_code),
        lt_comment_extern = CASE 
            WHEN jsonb_typeof(rl.raw_line->'comment') = 'object' THEN NULLIF(TRIM(rl.raw_line->'comment'->>'extern'), '')
            WHEN jsonb_typeof(rl.raw_line->'comment') = 'string' THEN NULLIF(TRIM(rl.raw_line->>'comment'), '')
            ELSE ol.lt_comment_extern
        END,
        lt_comment_intern = CASE 
            WHEN jsonb_typeof(rl.raw_line->'comment') = 'object' THEN NULLIF(TRIM(rl.raw_line->'comment'->>'intern'), '')
            ELSE ol.lt_comment_intern
        END,
        lt_vat_code = COALESCE(
            NULLIF(TRIM(rl.raw_line->'vat'->>'code'), ''),
            NULLIF(TRIM(rl.raw_line->>'vatCode'), ''),
            NULLIF(TRIM(rl.raw_line->>'vat_code'), ''),
            ol.lt_vat_code
        ),
        lt_vat_percentage = COALESCE(
            NULLIF(TRIM(rl.raw_line->'vat'->>'percentage'), '')::numeric,
            NULLIF(TRIM(rl.raw_line->>'vatPercentage'), '')::numeric,
            NULLIF(TRIM(rl.raw_line->>'vat_percentage'), '')::numeric,
            ol.lt_vat_percentage
        ),
        lt_discount_percentage = COALESCE(
            NULLIF(TRIM(rl.raw_line->>'discount'), '')::numeric,
            NULLIF(TRIM(rl.raw_line->>'discountPercentage'), '')::numeric,
            ol.lt_discount_percentage
        ),
        lt_base_price_cents = COALESCE(
            ROUND(NULLIF(TRIM(rl.raw_line->>'basePartPrice'), '')::numeric * 100)::bigint,
            ol.lt_base_price_cents
        ),
        lt_reservations = CASE 
            WHEN rl.raw_line->'reservations' IS NOT NULL AND jsonb_typeof(rl.raw_line->'reservations') = 'array'
            THEN rl.raw_line->'reservations'
            ELSE ol.lt_reservations
        END,
        lt_stock_status = COALESCE(NULLIF(TRIM(rl.raw_line->>'stockStatus'), ''), ol.lt_stock_status),
        lt_delivery_status = COALESCE(NULLIF(TRIM(rl.raw_line->>'deliveryStatus'), ''), ol.lt_delivery_status),
        lt_invoice_status = COALESCE(NULLIF(TRIM(rl.raw_line->>'invoiceStatus'), ''), ol.lt_invoice_status),
        lt_id = COALESCE(NULLIF(TRIM(rl.raw_line->>'id'), ''), ol.lt_id),
        updated_at = now()
    FROM raw_lines rl
    WHERE ol.order_id = rl.order_id
      AND (
        (ol.lt_id IS NOT NULL AND ol.lt_id = (rl.raw_line->>'id'))
        OR (ol.line_number = rl.line_number AND ol.sub_line = 0)
      );

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- Stap 2: Update sub_line = 1 (synthetische montagelijn): GEEN fake lt_raw_data fabriceren! (INV-RAW-IMMUTABILITY-01)
    UPDATE public.order_lines ol
    SET 
        lt_raw_data = NULL,
        lt_id = COALESCE(parent.lt_id || '.service', ol.line_number::text || '.service'),
        updated_at = now()
    FROM public.order_lines parent
    WHERE ol.order_id = parent.order_id
      AND ol.line_number = parent.line_number
      AND parent.sub_line = 0
      AND ol.sub_line = 1
      AND ol.order_id = ANY(p_order_ids);

    GET DIAGNOSTICS v_synth_count = ROW_COUNT;
    v_updated_count := v_updated_count + v_synth_count;

    RETURN v_updated_count;
END;
$$;

-- ==============================================================================
-- 5. Expliciete Permissies
-- ==============================================================================
GRANT EXECUTE ON FUNCTION public.ingest_logictrade_order(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_order_lines_bronze_batch(text[]) TO anon, authenticated, service_role;
GRANT SELECT ON public.active_orders, public.active_quotes, public.active_catalog, public.active_order_lines TO anon, authenticated, service_role;
