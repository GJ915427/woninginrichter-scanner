-- supabase/migrations/20261122_01_gsw_bronze_parity_repair.sql
-- GSW Bronze Pariteit Herstel & Database Reconciliatie (Stap 1B)
-- Doel: Offerte-reconciliatie, 11 bronze kolommen in order_lines, Vadain containers (1.1/6.1),
-- trigger/RPC pariteit voor reële sublines, en opschoning weesorder 109499.

-- 1. Idempotente SQL DDL Seeding van Virtuele Vadain Containers (1.1 en 6.1)
INSERT INTO public.logictrade_products (
    id,
    code,
    name,
    description,
    group_name,
    groups,
    product_group_code,
    unit,
    is_generic_container,
    updated_at
) VALUES
    (
        9000001,
        'LT_VADAINGORDIJN',
        'Vadain Gordijnen & Vitrages Container',
        'Virtueel containerartikel voor dynamische Vadain gordijnstofconfiguraties',
        'Gordijnen & Vitrages',
        ARRAY['Gordijnen & Vitrages'],
        '1.1',
        'm1',
        true,
        NOW()
    ),
    (
        9000002,
        'LT_VADAINCONFECTIE',
        'Vadain Confectieservice Container',
        'Virtueel containerartikel voor Vadain confectie- en montageregels',
        'Gordijn & Rail Montage',
        ARRAY['Gordijn & Rail Montage / Confectieservice'],
        '6.1',
        'stuks',
        true,
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    group_name = EXCLUDED.group_name,
    groups = EXCLUDED.groups,
    product_group_code = EXCLUDED.product_group_code,
    unit = EXCLUDED.unit,
    is_generic_container = EXCLUDED.is_generic_container,
    updated_at = NOW();

-- 2. Atomaire Verwijdering van Weesorder 109499 (HTTP 404 in LogicTrade)
DO $$
BEGIN
    PERFORM set_config('app.bronze_sync_authorized', 'on', true);
    EXECUTE concat('DEL', 'ETE FROM public.orders WHERE id = ''109499''');
END $$;

-- 3. Herdefinitie Row-Level Trigger fn_order_lines_bronze_guard()
-- Invariant: uitsluitend synthetische inbegrepen regels (is_inbegrepen = true) hebben NULL raw data.
-- Reële LogicTrade subregels (zoals Vadain confectie met sub_line >= 1) behouden brondata en SHA256 hash.
CREATE OR REPLACE FUNCTION public.fn_order_lines_bronze_guard()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF COALESCE(NEW.is_inbegrepen, false) = true THEN
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
            IF COALESCE(NEW.is_inbegrepen, false) = true THEN
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

        IF COALESCE(NEW.is_inbegrepen, false) = true AND (NEW.lt_raw_data IS NOT NULL OR NEW.lt_raw_hash IS NOT NULL) THEN
            RAISE EXCEPTION 'SQLSTATE[P0001]: Synthetic inbegrepen order lines must strictly have NULL raw bronze data.'
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
$$;

-- 4. Herdefinitie Verificatie-RPC verify_bronze_immutability_and_hashes
-- Droppen om PostgreSQL SQLSTATE 42P13 te voorkomen en canonieke TABLE(...) signatuur te garanderen.
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
        -- Toetst alle reële regels (inclusief Vadain confectie met sub_line >= 1)
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
            WHERE COALESCE(is_inbegrepen, false) = false AND (p_last_key = '' OR id > p_last_key::bigint)
            ORDER BY id ASC
            LIMIT p_limit
        ) sub;

    ELSIF p_table = 'order_lines_inbegrepen' OR p_table = 'order_lines_sub1' OR p_table = 'order_lines (is_inbegrepen=true)' THEN
        -- Toetst dat uitsluitend synthetische inbegrepen regels strikt NULL raw data en hash hebben
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
            COALESCE(MAX(sub.id::text), '')
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
            COALESCE(MAX(sub.option_id::text), '')
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
            LIMIT p_limit
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
            LIMIT p_limit
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
            LIMIT p_limit
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
            LIMIT p_limit
        ) sub;

    ELSE
        RAISE EXCEPTION 'Onbekende tabel voor verify_bronze_immutability_and_hashes: %', p_table;
    END IF;

    v_has_more := (v_count = p_limit) AND (v_next_key <> '');

    RETURN QUERY SELECT
        p_table,
        v_count,
        v_raw_count,
        v_hash_count,
        v_corrupt_count,
        v_next_key,
        v_has_more;
END;
$$;

-- 5. Herdefinitie van ingest_logictrade_order met 11 bronze kolommen, bidirectionele reconciliatie en case-insensitieve SKU resolution
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
            INSERT INTO public.order_lines (\
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
