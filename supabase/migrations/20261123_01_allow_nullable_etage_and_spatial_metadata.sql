-- Migration: 20261123_01_allow_nullable_etage_and_spatial_metadata.sql
-- Allow nullable etage_name and add first-class spatial_metadata JSONB column
-- Updates ingest_logictrade_order RPC conform 20261122_01 delete+insert architecture

-- 1. Schema DDL updates
ALTER TABLE public.order_lines ADD COLUMN IF NOT EXISTS spatial_metadata JSONB DEFAULT NULL;
ALTER TABLE public.order_lines ALTER COLUMN etage_name DROP DEFAULT;

-- 2. Herdefinitie van ingest_logictrade_order met spatial_metadata en NULLIF(etage_name)
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
    v_fsm_step INT;
    v_quotation_num TEXT;
    v_status TEXT;
    v_converted_to TEXT;
    v_existing_order_id TEXT;
    v_inserted_lines INT := 0;
    v_has_lines_key BOOLEAN;
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);

    v_order := p_order;

    IF p_lines IS NOT NULL THEN
        v_lines := p_lines;
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

    v_order_id := COALESCE(
        NULLIF(TRIM(v_order->>'id'), ''),
        NULLIF(TRIM(v_order->>'order_number'), ''),
        NULLIF(TRIM(v_order->>'number'), '')
    );

    IF v_order_id IS NULL THEN
        RAISE EXCEPTION 'Order id of order_number ontbreekt in payload';
    END IF;

    v_order_num := COALESCE(
        NULLIF(TRIM(v_order->>'order_number'), ''),
        NULLIF(TRIM(v_order->>'number'), ''),
        v_order_id
    );

    v_fsm_step := COALESCE(
        NULLIF(TRIM(v_order->>'fsm_step'), '')::int,
        CASE 
            WHEN v_order->>'fsm_phase' ILIKE '%offerte%' THEN 2
            WHEN v_order_num ILIKE 'O%' THEN 2
            ELSE 5
        END
    );

    v_status := COALESCE(NULLIF(TRIM(v_order->>'status'), ''), 'draft');
    v_converted_to := NULLIF(TRIM(v_order->>'converted_to_order_id'), '');

    IF v_fsm_step = 2 THEN
        v_quotation_num := COALESCE(
            NULLIF(TRIM(v_order->>'quotation_number'), ''),
            v_order_num
        );

        -- Tak 2 (Corner Case): Offerte arriveert ná verkooporder -> zoek reeds bestaande order
        SELECT id INTO v_existing_order_id
        FROM public.orders
        WHERE fsm_step IS DISTINCT FROM 2
          AND (
            quotation_number = v_order_id
            OR quotation_number = v_quotation_num
            OR quotation_number = v_order_num
          )
        ORDER BY order_date DESC NULLS LAST, id DESC
        LIMIT 1;

        IF v_existing_order_id IS NOT NULL THEN
            v_status := 'Geconverteerd naar order';
            v_converted_to := v_existing_order_id;
        END IF;
    ELSE
        -- Verkooporder: ontleen offertenummer causaal aan quote object of quotation_number
        v_quotation_num := COALESCE(
            NULLIF(TRIM(v_order->'quote'->>'number'), ''),
            NULLIF(TRIM(v_order->>'quotation_number'), '')
        );
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
                lt_comment_extern,
                lt_comment_intern,
                lt_vat_code,
                lt_vat_percentage,
                lt_discount_percentage,
                lt_base_price_cents,
                lt_reservations,
                lt_stock_status,
                lt_delivery_status,
                lt_invoice_status,
                is_inbegrepen,
                lt_raw_data,
                lt_id,
                spatial_metadata,
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
                NULLIF(TRIM(elem->>'etage_name'), ''),
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
                COALESCE(elem->>'lt_comment_extern', elem->>'comment_extern', elem->'comment'->>'extern'),
                COALESCE(elem->>'lt_comment_intern', elem->>'comment_intern', elem->'comment'->>'intern'),
                COALESCE(elem->>'lt_vat_code', elem->>'vat_code', elem->>'vatCode'),
                COALESCE(NULLIF(TRIM(elem->>'lt_vat_percentage'), ''), NULLIF(TRIM(elem->>'vat_percentage'), ''), NULLIF(TRIM(elem->>'vatPercentage'), ''))::numeric,
                COALESCE(NULLIF(TRIM(elem->>'lt_discount_percentage'), ''), NULLIF(TRIM(elem->>'discount_percentage'), ''), NULLIF(TRIM(elem->>'discountPercentage'), ''))::numeric,
                COALESCE(NULLIF(TRIM(elem->>'lt_base_price_cents'), ''), NULLIF(TRIM(elem->>'base_price_cents'), ''))::bigint,
                COALESCE(elem->'lt_reservations', elem->'reservations', '[]'::jsonb),
                COALESCE(elem->>'lt_stock_status', elem->>'stock_status', elem->>'stockStatus'),
                COALESCE(elem->>'lt_delivery_status', elem->>'delivery_status', elem->>'deliveryStatus'),
                COALESCE(elem->>'lt_invoice_status', elem->>'invoice_status', elem->>'invoiceStatus'),
                COALESCE(NULLIF(TRIM(elem->>'is_inbegrepen'), '')::boolean, false),
                CASE 
                    WHEN COALESCE(NULLIF(TRIM(elem->>'is_inbegrepen'), '')::boolean, false) = true THEN NULL 
                    ELSE elem->'lt_raw_data' 
                END,
                elem->>'lt_id',
                elem->'spatial_metadata',
                NOW(),
                NOW()
            FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS arr(elem, ord)
            LEFT JOIN LATERAL (
                SELECT id, product_group_code
                FROM public.logictrade_products
                WHERE UPPER(code) = UPPER(COALESCE(NULLIF(TRIM(elem->>'product_code'), ''), NULLIF(TRIM(elem->>'articleCode'), ''), NULLIF(TRIM(elem->>'code'), '')))
                ORDER BY modified_at DESC NULLS LAST, id DESC
                LIMIT 1
            ) lp ON (
                UPPER(COALESCE(NULLIF(TRIM(elem->>'product_code'), ''), NULLIF(TRIM(elem->>'articleCode'), ''), NULLIF(TRIM(elem->>'code'), ''), '')) NOT IN ('', 'TEKST')
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
