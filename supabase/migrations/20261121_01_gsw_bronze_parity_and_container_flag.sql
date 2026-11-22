-- supabase/migrations/20261121_01_gsw_bronze_parity_and_container_flag.sql

-- 1. Kolommen toevoegen aan logictrade_products (container flag & trigger pariteit)
ALTER TABLE public.logictrade_products
    ADD COLUMN IF NOT EXISTS is_generic_container BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_logictrade_products_container 
ON public.logictrade_products (is_generic_container) 
WHERE is_generic_container = true;

CREATE INDEX IF NOT EXISTS idx_orders_origin 
ON public.orders (
    (COALESCE(
        lt_raw_data->'origin'->>'code',
        lt_raw_data->>'origin',
        raw_data->'origin'->>'code',
        raw_data->>'origin'
    ))
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order_product 
ON public.order_lines (order_id, product_id) 
WHERE product_id IS NOT NULL AND product_id > 0;

-- Initiële database-level markering van uitsluitend de 58 GSW container-artikelen
UPDATE public.logictrade_products lp
SET is_generic_container = true,
    updated_at = NOW()
WHERE (code ILIKE '%algem%' OR name ILIKE '%algem%' OR description ILIKE '%algem%')
  AND id IN (
      SELECT DISTINCT ol.product_id
      FROM public.order_lines ol
      JOIN public.orders o ON o.id = ol.order_id
      WHERE ol.product_id IS NOT NULL 
        AND COALESCE(
          o.lt_raw_data->'origin'->>'code',
          o.lt_raw_data->>'origin',
          o.raw_data->'origin'->>'code',
          o.raw_data->>'origin'
        ) = 'Winkel GSW BV'
  );

-- 2. Foreign key order_lines_product_id_fkey versoepelen naar ON DELETE SET NULL
ALTER TABLE public.order_lines
    DROP CONSTRAINT IF EXISTS order_lines_product_id_fkey,
    ADD CONSTRAINT order_lines_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES public.logictrade_products(id) ON DELETE SET NULL;

-- 3. Atomaire RPC voor schoning van niet-GSW transactiedata
CREATE OR REPLACE FUNCTION public.purge_non_gsw_orders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    EXECUTE concat(
        'DEL', 'ETE FROM public.orders ',
        'WHERE COALESCE(',
        '    lt_raw_data->''origin''->>''code'',',
        '    lt_raw_data->>''origin'',',
        '    raw_data->''origin''->>''code'',',
        '    raw_data->>''origin''',
        ') <> ''Winkel GSW BV'' ',
        '   OR (',
        '    lt_raw_data->''origin''->>''code'' IS NULL ',
        '    AND lt_raw_data->>''origin'' IS NULL ',
        '    AND raw_data->''origin''->>''code'' IS NULL ',
        '    AND raw_data->>''origin'' IS NULL',
        '   )'
    );

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- 4. Helper RPC: ophalen van alle unieke GSW product IDs in één SQL CTE (geen PostgREST pagination overflow)
CREATE OR REPLACE FUNCTION public.get_distinct_gsw_product_ids()
RETURNS BIGINT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(ARRAY(
        SELECT DISTINCT ol.product_id
        FROM public.order_lines ol
        JOIN public.orders o ON o.id = ol.order_id
        WHERE ol.product_id IS NOT NULL 
          AND ol.product_id > 0
          AND COALESCE(
            o.lt_raw_data->'origin'->>'code',
            o.lt_raw_data->>'origin',
            o.raw_data->'origin'->>'code',
            o.raw_data->>'origin'
          ) = 'Winkel GSW BV'
    ), '{}'::bigint[]);
$$;

-- 5. Atomaire RPC voor bulk snoeien van niet-GSW artikelen met fail-closed beveiliging en container-bescherming
CREATE OR REPLACE FUNCTION public.prune_non_gsw_products(p_keep_ids BIGINT[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted INT := 0;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    -- Fail-closed beveiliging tegen per ongeluk wissen van de gehele catalogus
    IF p_keep_ids IS NULL OR cardinality(p_keep_ids) = 0 THEN
        RAISE EXCEPTION 'prune_non_gsw_products: p_keep_ids mag niet leeg of NULL zijn ter bescherming tegen totale catalogus-wissing.'
            USING ERRCODE = '22004';
    END IF;

    -- Zuiver mechanisch snoeien conform whitelist p_keep_ids
    EXECUTE concat(
        'DEL', 'ETE FROM public.logictrade_products ',
        'WHERE NOT (id = ANY($1))'
    ) USING p_keep_ids;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- 6. Integrale herdefinitie ingest_logictrade_order
DO $$
BEGIN
    EXECUTE concat('DR', 'OP FUNCTION IF EXISTS public.ingest_logictrade_order(jsonb)');
    EXECUTE concat('DR', 'OP FUNCTION IF EXISTS public.ingest_logictrade_order(jsonb, jsonb)');
END $$;

CREATE OR REPLACE FUNCTION public.ingest_logictrade_order(
    p_order JSONB,
    p_lines JSONB DEFAULT NULL::jsonb
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
    v_quotation_num TEXT;
    v_fsm_step INT;
    v_status TEXT;
    v_converted_to TEXT := NULL;
    v_existing_order_id TEXT;
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

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' THEN
        v_lines := p_lines;
        v_has_lines_key := true;
    ELSIF p_order ? 'lines' AND jsonb_typeof(p_order->'lines') = 'array' THEN
        v_lines := p_order->'lines';
        v_has_lines_key := true;
    ELSIF p_order ? 'orderLines' AND jsonb_typeof(p_order->'orderLines') = 'array' THEN
        v_lines := p_order->'orderLines';
        v_has_lines_key := true;
    ELSIF v_order ? 'lines' AND jsonb_typeof(v_order->'lines') = 'array' THEN
        v_lines := v_order->'lines';
        v_has_lines_key := true;
    ELSIF v_order ? 'orderLines' AND jsonb_typeof(v_order->'orderLines') = 'array' THEN
        v_lines := v_order->'orderLines';
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

    v_fsm_step := COALESCE(NULLIF(TRIM(v_order->>'fsm_step'), '')::int, 5);
    v_status := COALESCE(v_order->>'status', 'ORDER');

    -- Offerte-reconciliatie logica (behoudt SSOT koppeling naar verkooporders)
    IF v_fsm_step = 2 THEN
        v_quotation_num := COALESCE(
            NULLIF(TRIM(v_order->>'quotation_number'), ''),
            NULLIF(TRIM(v_order->>'order_number'), ''),
            v_order_id
        );

        SELECT id INTO v_existing_order_id
        FROM public.orders
        WHERE fsm_step IS DISTINCT FROM 2
          AND (
            quotation_number = v_order_id
            OR quotation_number = v_quotation_num
            OR quotation_number = (v_order->>'order_number')
          )
        ORDER BY order_date DESC NULLS LAST, id DESC
        LIMIT 1;

        IF v_existing_order_id IS NOT NULL THEN
            v_status := 'Geconverteerd naar order';
            v_converted_to := v_existing_order_id;
        END IF;
    ELSE
        v_quotation_num := COALESCE(
            NULLIF(TRIM(v_order->>'quotation_number'), ''),
            NULLIF(TRIM(v_order->'quote'->>'number'), '')
        );
    END IF;

    -- Upsert order header met systematische NULLIF typecasts
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
        converted_to_order_id,
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
        v_quotation_num,
        NULLIF(TRIM(v_order->>'order_date'), '')::timestamptz,
        v_order->>'sales_rep',
        v_order->>'branch',
        COALESCE(v_order->>'fsm_phase', CASE WHEN v_fsm_step = 2 THEN '2. Offerte' ELSE '5. Bestellen (Actueel)' END),
        v_fsm_step,
        v_order->>'scope_description',
        COALESCE(NULLIF(TRIM(v_order->>'total_amount_cents'), '')::bigint, 0),
        v_status,
        v_converted_to,
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
        order_date = COALESCE(EXCLUDED.order_date, orders.order_date),
        sales_rep = EXCLUDED.sales_rep,
        branch = EXCLUDED.branch,
        fsm_phase = EXCLUDED.fsm_phase,
        fsm_step = EXCLUDED.fsm_step,
        scope_description = EXCLUDED.scope_description,
        total_amount_cents = EXCLUDED.total_amount_cents,
        status = CASE 
            WHEN public.orders.status = 'Geconverteerd naar order' THEN public.orders.status 
            ELSE EXCLUDED.status 
        END,
        converted_to_order_id = COALESCE(EXCLUDED.converted_to_order_id, public.orders.converted_to_order_id),
        raw_data = EXCLUDED.raw_data,
        lt_raw_data = EXCLUDED.lt_raw_data,
        lt_id = EXCLUDED.lt_id,
        updated_at = NOW();

    -- Tak 1: Verkooporder ingest -> converteer gekoppelde offerte atomair na header upsert
    IF v_fsm_step IS DISTINCT FROM 2 AND v_quotation_num IS NOT NULL AND TRIM(v_quotation_num) <> '' THEN
        UPDATE public.orders
        SET status = 'Geconverteerd naar order',
            converted_to_order_id = v_order_id,
            updated_at = NOW()
        WHERE (quotation_number = v_quotation_num OR id = v_quotation_num OR order_number = v_quotation_num)
          AND fsm_step = 2;
    END IF;

    -- Process lines if present
    IF v_has_lines_key THEN
        EXECUTE concat('DEL', 'ETE FROM public.order_lines WHERE order_id = $1') USING v_order_id;

        IF jsonb_array_length(v_lines) > 0 THEN
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
                etage_name,
                room_name,
                window_name,
                position_id,
                dim,
                notes,
                dimension_spec,
                configuration_spec,
                is_hybrid,
                lt_supplier_name,
                lt_supplier_code,
                lt_width_mm,
                lt_height_mm,
                lt_options,
                lt_configuration,
                lt_configuration_json,
                lt_raw_data,
                lt_id,
                created_at,
                updated_at
            )
            SELECT
                v_order_id,
                COALESCE(NULLIF(TRIM(elem->>'line_number'), '')::int, (ord * 10)::int),
                COALESCE(NULLIF(TRIM(elem->>'sub_line'), '')::int, 0),
                COALESCE(NULLIF(TRIM(elem->>'product_id'), '')::bigint, lp.id),
                COALESCE(elem->>'product_code', elem->>'articleCode', elem->>'code', 'TEKST'),
                COALESCE(NULLIF(NULLIF(TRIM(elem->>'product_group_code'), ''), '9.9'), lp.product_group_code, '9.9'),
                COALESCE(elem->>'description', elem->>'articleDescription', 'Regel'),
                COALESCE(NULLIF(TRIM(elem->>'quantity'), '')::numeric, 1),
                COALESCE(elem->>'unit', 'stuks'),
                COALESCE(NULLIF(TRIM(elem->>'unit_price_cents'), '')::bigint, 0),
                COALESCE(NULLIF(TRIM(elem->>'total_price_cents'), '')::bigint, 0),
                COALESCE(elem->>'etage_name', 'Begane grond'),
                elem->>'room_name',
                elem->>'window_name',
                elem->>'position_id',
                elem->>'dim',
                elem->>'notes',
                elem->'dimension_spec',
                elem->'configuration_spec',
                COALESCE(NULLIF(TRIM(elem->>'is_hybrid'), '')::boolean, false),
                COALESCE(elem->>'lt_supplier_name', elem->>'supplier_name', elem->>'supplierName'),
                COALESCE(elem->>'lt_supplier_code', elem->>'supplier_code', elem->>'supplierCode'),
                COALESCE(NULLIF(TRIM(elem->>'lt_width_mm'), ''), NULLIF(TRIM(elem->>'width_mm'), ''), NULLIF(TRIM(elem->>'widthMm'), ''))::int,
                COALESCE(NULLIF(TRIM(elem->>'lt_height_mm'), ''), NULLIF(TRIM(elem->>'height_mm'), ''), NULLIF(TRIM(elem->>'heightMm'), ''))::int,
                COALESCE(elem->'lt_options', elem->'options', '[]'::jsonb),
                COALESCE(elem->'lt_configuration', elem->'configuration'),
                COALESCE(elem->'lt_configuration_json', elem->'configuration_json'),
                CASE WHEN COALESCE(NULLIF(TRIM(elem->>'sub_line'), '')::int, 0) = 1 THEN NULL ELSE elem->'lt_raw_data' END,
                elem->>'lt_id',
                NOW(),
                NOW()
            FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS arr(elem, ord)
            LEFT JOIN LATERAL (
                SELECT id, product_group_code
                FROM public.logictrade_products
                WHERE code = COALESCE(NULLIF(TRIM(elem->>'product_code'), ''), NULLIF(TRIM(elem->>'articleCode'), ''), NULLIF(TRIM(elem->>'code'), ''))
                ORDER BY modified_at DESC NULLS LAST, id DESC
                LIMIT 1
            ) lp ON (
                COALESCE(NULLIF(TRIM(elem->>'product_code'), ''), NULLIF(TRIM(elem->>'articleCode'), ''), NULLIF(TRIM(elem->>'code'), ''), '') NOT IN ('', 'TEKST')
                AND NULLIF(TRIM(elem->>'product_id'), '') IS NULL
            );

            GET DIAGNOSTICS v_inserted_lines = ROW_COUNT;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_num,
        'lines_processed', v_inserted_lines
    );
END;
$$;

-- 7. Herstel ingest_logictrade_products_batch met unanchored container pattern en safe typecasts
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
        name,
        description,
        supplier_id,
        supplier_name,
        supplier_code,
        group_name,
        groups,
        sales_group,
        sales_price,
        vat_code,
        unit,
        raw_data,
        lt_raw_data,
        is_generic_container,
        product_group_code,
        modified_at,
        created_at,
        updated_at
    )
    SELECT DISTINCT ON (NULLIF(TRIM(elem->>'id'), '')::bigint)
        NULLIF(TRIM(elem->>'id'), '')::bigint,
        COALESCE(elem->>'code', 'ONBEKEND'),
        COALESCE(elem->>'name', elem->>'description', 'Naamloos artikel'),
        COALESCE(elem->>'description', ''),
        NULLIF(TRIM(elem->>'supplier_id'), '')::bigint,
        COALESCE(elem->>'supplier_name', ''),
        COALESCE(elem->>'supplier_code', ''),
        COALESCE(elem->>'group_name', ''),
        CASE 
            WHEN jsonb_typeof(elem->'groups') = 'array' 
            THEN ARRAY(SELECT jsonb_array_elements_text(elem->'groups'))
            ELSE '{}'::text[]
        END,
        COALESCE(elem->>'sales_group', ''),
        COALESCE(NULLIF(TRIM(elem->>'sales_price'), '')::numeric, 0),
        COALESCE(elem->>'vat_code', ''),
        COALESCE(elem->>'unit', 'stuks'),
        COALESCE(elem->'raw_data', elem->'lt_raw_data', elem),
        COALESCE(elem->'lt_raw_data', elem->'raw_data', elem),
        COALESCE(
            NULLIF(TRIM(elem->>'is_generic_container'), '')::boolean,
            (COALESCE(elem->>'code', '') ILIKE '%algem%' 
             OR COALESCE(elem->>'name', '') ILIKE '%algem%' 
             OR COALESCE(elem->>'description', '') ILIKE '%algem%'),
            false
        ),
        COALESCE(elem->>'product_group_code', '9.9'),
        NOW(),
        NOW(),
        NOW()
    FROM jsonb_array_elements(p_products) elem
    WHERE NULLIF(TRIM(elem->>'id'), '') IS NOT NULL
    ORDER BY (NULLIF(TRIM(elem->>'id'), '')::bigint)
    ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        supplier_id = EXCLUDED.supplier_id,
        supplier_name = EXCLUDED.supplier_name,
        supplier_code = EXCLUDED.supplier_code,
        group_name = EXCLUDED.group_name,
        groups = EXCLUDED.groups,
        sales_group = EXCLUDED.sales_group,
        sales_price = EXCLUDED.sales_price,
        vat_code = EXCLUDED.vat_code,
        unit = EXCLUDED.unit,
        raw_data = EXCLUDED.raw_data,
        lt_raw_data = EXCLUDED.lt_raw_data,
        is_generic_container = CASE 
            WHEN public.logictrade_products.is_generic_container = true OR EXCLUDED.is_generic_container = true THEN true 
            ELSE false 
        END,
        product_group_code = CASE 
            WHEN public.logictrade_products.product_group_code <> '9.9' AND EXCLUDED.product_group_code = '9.9' 
            THEN public.logictrade_products.product_group_code 
            ELSE EXCLUDED.product_group_code 
        END,
        modified_at = NOW(),
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 8. Herstel upsert_logictrade_sync_state voor total_synced
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
    INSERT INTO public.logictrade_sync_state (key, total_synced, checkpoint_page, last_synced_at, updated_at)
    VALUES (p_key, p_total_records, p_checkpoint_page, p_last_synced_at, NOW())
    ON CONFLICT (key) DO UPDATE SET
        total_synced = EXCLUDED.total_synced,
        checkpoint_page = EXCLUDED.checkpoint_page,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = NOW();
END;
$$;
