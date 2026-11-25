-- 1. Seed Categories (0 en 7)
INSERT INTO public.categories (id, code, name) VALUES
  (0, 'informatief_niet_product', 'Informatief / Niet-Product'),
  (7, 'meubels_interieur', 'Meubels & Interieur')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code;

-- 2. Seed Product Groups (0.0, 0.1, 2.5, 2.6, 3.9, 7.1)
INSERT INTO public.product_groups (code, category_id, name, default_uom) VALUES
  ('0.0', 0, 'Informatieve Tekst / Clausule', 'stuks'),
  ('0.1', 0, 'Korting / Actie / Cadeaubon', 'stuks'),
  ('2.5', 2, 'Horren & Insectenwering', 'stuks'),
  ('2.6', 2, 'Domotica & Toebehoren', 'stuks'),
  ('3.9', 3, 'Vinyl & Marmoleum', 'm2'),
  ('7.1', 7, 'Meubels & Interieurtoebehoren', 'stuks')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category_id = EXCLUDED.category_id,
  default_uom = EXCLUDED.default_uom;

-- 2a. Maak deterministische snapshot tabel aan voor bijectieve rollback (met surrogate PK 'id bigint')
CREATE TABLE IF NOT EXISTS public._migration_20261124_products_snapshot (
    id bigint PRIMARY KEY,
    code text NOT NULL,
    old_product_group_code text
);

-- Leg pre-migratie toestand vast van ALLE SKUs die geraakt kunnen worden door stap 2b (inclusief pre-migratie NULL waarden)
INSERT INTO public._migration_20261124_products_snapshot (id, code, old_product_group_code)
SELECT id, code, product_group_code
FROM public.logictrade_products
WHERE (
    -- Criteria voor zuivere diensten
    (
        (LOWER(name) ~ '^(legkosten|montagekosten|inmeetservice|inmeet|2mm egaliseren|egaliseren|verwijderen|afvoer|bocht buigen|uurtarief|arbeid)'
         OR code IN ('A00033263', 'A00038387', 'A00038400', 'A00039708', 'A00036806', 'A00036786', 'A00038024', 'A00036805', 'A00046078', 'A00064287', 'A00067288'))
        AND NOT (
            (LOWER(name) LIKE '%plint%' OR LOWER(name) LIKE '%profiel%' OR LOWER(name) LIKE '%ondervloer%' OR LOWER(name) LIKE '%thermofelt%' OR LOWER(name) LIKE '%jumpax%' OR LOWER(name) LIKE '%egalsoft%')
            OR (LOWER(name) LIKE '%rail%' AND LOWER(name) NOT LIKE '%montagekosten%' AND LOWER(name) NOT LIKE '%bocht buigen%')
            OR (LOWER(name) !~ '^(legkosten|montagekosten|inmeetservice|inmeet|2mm egaliseren)' AND LOWER(name) LIKE '%incl.%')
        )
        AND (product_group_code IS NULL OR NOT product_group_code LIKE '6.%' OR (code = 'A00033263' AND product_group_code = '6.9'))
        AND COALESCE(is_generic_container, false) = false
    )
    -- Criteria voor nieuwe groepen (2.5, 2.6, 3.9) & kortingsartikelen (0.1)
    OR (
        (product_group_code IN ('2.4', '9.9') OR product_group_code IS NULL)
        AND COALESCE(is_generic_container, false) = false
        AND (LOWER(name) LIKE '%hor%' OR LOWER(name) LIKE '%plisséhor%' OR LOWER(name) LIKE '%inzethor%')
        AND LOWER(name) NOT LIKE '%montage%' AND LOWER(name) NOT LIKE '%service%'
    )
    OR (
        (product_group_code IN ('2.4', '9.9') OR product_group_code IS NULL)
        AND COALESCE(is_generic_container, false) = false
        AND (LOWER(name) LIKE '%somfy%' OR LOWER(name) LIKE '%motor%' OR LOWER(name) LIKE '%afstandsbediening%')
        AND LOWER(name) NOT LIKE '%montage%'
    )
    OR (
        (product_group_code IN ('3.3', '9.9') OR product_group_code IS NULL)
        AND COALESCE(is_generic_container, false) = false
        AND (LOWER(name) LIKE '%marmoleum%' OR LOWER(name) LIKE '%linoleum%' OR LOWER(name) LIKE '%vinyl%')
        AND LOWER(name) NOT LIKE '%legkosten%' AND LOWER(name) NOT LIKE '%reiniger%'
    )
    OR code IN ('A00044570', 'A00014590', 'A00036356')
)
ON CONFLICT (id) DO NOTHING;

-- 2b. Synchroniseer catalogus taxonomie voor ZUIVERE diensten en nieuwe groepen (2.5, 2.6, 3.9)
UPDATE public.logictrade_products
SET product_group_code = CASE
    -- Prioriteit 1: Traprenovatie / treden
    WHEN LOWER(name) LIKE '%trap%' OR LOWER(name) LIKE '%trede%' THEN '6.4'
    -- Prioriteit 2: Inmeet & Schouw
    WHEN LOWER(name) LIKE '%inmeet%' OR LOWER(name) LIKE '%schouw%' THEN '6.6'
    -- Prioriteit 3: Egalisatie, sloop, verwijderen & afvoer
    WHEN LOWER(name) LIKE '%egalis%' OR LOWER(name) LIKE '%sloop%' OR LOWER(name) LIKE '%verwijder%' OR LOWER(name) LIKE '%afvoer%' THEN '6.7'
    -- Prioriteit 4: Binnenzonwering & insectenwering / horren montage
    WHEN LOWER(name) LIKE '%zonwering%' OR LOWER(name) LIKE '%insecten%' OR LOWER(name) LIKE '%hor%' THEN '6.2'
    -- Prioriteit 5: Rails, gordijnen & bochten buigen
    WHEN LOWER(name) LIKE '%rail%' OR LOWER(name) LIKE '%bocht buigen%' OR LOWER(name) LIKE '%gordijn%' THEN '6.1'
    -- Prioriteit 6: Vloeren leggen & legkosten
    WHEN LOWER(name) LIKE '%legkosten%' OR LOWER(name) LIKE '%leggen%' THEN '6.3'
    -- Prioriteit 7: Bezorg & transport
    WHEN LOWER(name) LIKE '%bezorg%' OR LOWER(name) LIKE '%transport%' OR LOWER(name) LIKE '%materieel%' THEN '6.8'
    ELSE '6.9'
END
WHERE (
    LOWER(name) ~ '^(legkosten|montagekosten|inmeetservice|inmeet|2mm egaliseren|egaliseren|verwijderen|afvoer|bocht buigen|uurtarief|arbeid)'
    OR code IN ('A00033263', 'A00038387', 'A00038400', 'A00039708', 'A00036806', 'A00036786', 'A00038024', 'A00036805', 'A00046078', 'A00064287', 'A00067288')
)
AND NOT (
    (LOWER(name) LIKE '%plint%' OR LOWER(name) LIKE '%profiel%' OR LOWER(name) LIKE '%ondervloer%' OR LOWER(name) LIKE '%thermofelt%' OR LOWER(name) LIKE '%jumpax%' OR LOWER(name) LIKE '%egalsoft%')
    OR (LOWER(name) LIKE '%rail%' AND LOWER(name) NOT LIKE '%montagekosten%' AND LOWER(name) NOT LIKE '%bocht buigen%')
    OR (LOWER(name) !~ '^(legkosten|montagekosten|inmeetservice|inmeet|2mm egaliseren)' AND LOWER(name) LIKE '%incl.%')
)
AND (
    product_group_code IS NULL 
    OR NOT product_group_code LIKE '6.%' 
    OR (code = 'A00033263' AND product_group_code = '6.9')
)
AND COALESCE(is_generic_container, false) = false;

-- 2b.2 Nieuwe groepen (2.5 Horren, 2.6 Domotica, 3.9 Vinyl & Marmoleum) & Kortingsartikelen (0.1)
UPDATE public.logictrade_products
SET product_group_code = '2.5'
WHERE (product_group_code IN ('2.4', '9.9') OR product_group_code IS NULL)
  AND COALESCE(is_generic_container, false) = false
  AND (LOWER(name) LIKE '%hor%' OR LOWER(name) LIKE '%plisséhor%' OR LOWER(name) LIKE '%inzethor%')
  AND LOWER(name) NOT LIKE '%montage%' AND LOWER(name) NOT LIKE '%service%';

UPDATE public.logictrade_products
SET product_group_code = '2.6'
WHERE (product_group_code IN ('2.4', '9.9') OR product_group_code IS NULL)
  AND COALESCE(is_generic_container, false) = false
  AND (LOWER(name) LIKE '%somfy%' OR LOWER(name) LIKE '%motor%' OR LOWER(name) LIKE '%afstandsbediening%')
  AND LOWER(name) NOT LIKE '%montage%';

UPDATE public.logictrade_products
SET product_group_code = '3.9'
WHERE (product_group_code IN ('3.3', '9.9') OR product_group_code IS NULL)
  AND COALESCE(is_generic_container, false) = false
  AND (LOWER(name) LIKE '%marmoleum%' OR LOWER(name) LIKE '%linoleum%' OR LOWER(name) LIKE '%vinyl%')
  AND LOWER(name) NOT LIKE '%legkosten%' AND LOWER(name) NOT LIKE '%reiniger%';

UPDATE public.logictrade_products
SET product_group_code = '0.1'
WHERE code IN ('A00044570', 'A00014590', 'A00036356');

-- 3. Voorkom cascade blocker: Drop afhankelijke view tijdelijk
DROP VIEW IF EXISTS public.active_order_lines;

-- 4. Sanering van 6 dode kolommen & toevoegen van audit tracing
ALTER TABLE public.order_lines
  DROP COLUMN IF EXISTS lt_configuration_json,
  DROP COLUMN IF EXISTS lt_width_mm,
  DROP COLUMN IF EXISTS lt_height_mm,
  DROP COLUMN IF EXISTS lt_options,
  DROP COLUMN IF EXISTS lt_supplier_name,
  DROP COLUMN IF EXISTS lt_supplier_code;

ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS classification_stage text,
  ADD COLUMN IF NOT EXISTS requires_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_notes text[];

-- 5. Hercreatie van public.active_order_lines view
CREATE OR REPLACE VIEW public.active_order_lines WITH (security_invoker = true) AS
SELECT 
    ol.*,
    ol.lt_comment_extern AS comment_extern,
    ol.lt_comment_intern AS comment_intern,
    ol.lt_raw_data AS raw_data
FROM public.order_lines ol
JOIN public.orders o ON o.id = ol.order_id
WHERE o.fsm_step IS DISTINCT FROM 2;

GRANT SELECT ON public.active_order_lines TO anon, authenticated, service_role;

-- 6. Voorkom function overload ambiguïteit (SQLSTATE 42725 / PGRST300)
DROP FUNCTION IF EXISTS public.ingest_logictrade_order(jsonb);
DROP FUNCTION IF EXISTS public.ingest_logictrade_order(jsonb, jsonb);

-- 7. RPC ingest_logictrade_order met Delivered Freeze Guard, 5-Traps Credit Triage, Case-ongevoelige TEKST en LATERAL audit
CREATE OR REPLACE FUNCTION public.ingest_logictrade_order(
    p_order jsonb, 
    p_lines jsonb DEFAULT NULL::jsonb,
    p_force boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    v_is_delivered BOOLEAN := false;
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

    -- Toets of bestaande order reeds fysiek is uitgeleverd / voltooid (Header-level Forensische Grondwaarheid)
    SELECT COALESCE(
        (COALESCE(lt_raw_data->>'deliveryStatus', raw_data->>'deliveryStatus') ILIKE 'complete')
        OR (status ILIKE ANY(ARRAY['%geleverd%', '%afgerond%', '%compleet%'])),
        false
    ) INTO v_is_delivered
    FROM public.orders WHERE id = v_order_id;

    -- Freeze Guard: Sla mutaties op uitgeleverde orders over tenzij expliciet geforceerd
    IF v_is_delivered AND NOT p_force THEN
        RETURN jsonb_build_object(
            'success', true,
            'order_id', v_order_id,
            'order_number', v_order_num,
            'lines_processed', 0,
            'skipped_reason', 'Order is reeds uitgeleverd/voltooid (Freeze Guard actief)'
        );
    END IF;

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
        v_quotation_num := COALESCE(
            NULLIF(TRIM(v_order->'quote'->>'number'), ''),
            NULLIF(TRIM(v_order->>'quotation_number'), '')
        );
    END IF;

    -- Upsert order header
    INSERT INTO public.orders (
        id, order_number, customer_name, city, quotation_number, order_date,
        sales_rep, branch, fsm_phase, fsm_step, scope_description, total_amount_cents,
        status, converted_to_order_id, raw_data, lt_raw_data, lt_id, created_at, updated_at
    ) VALUES (
        v_order_id, v_order_num,
        COALESCE(v_order->>'customer_name', 'Onbekende Klant'),
        v_order->>'city', v_quotation_num,
        NULLIF(TRIM(v_order->>'order_date'), '')::timestamptz,
        v_order->>'sales_rep', v_order->>'branch',
        COALESCE(v_order->>'fsm_phase', CASE WHEN v_fsm_step = 2 THEN '2. Offerte' ELSE '5. Bestellen (Actueel)' END),
        v_fsm_step, v_order->>'scope_description',
        COALESCE(NULLIF(TRIM(v_order->>'total_amount_cents'), '')::bigint, 0),
        v_status, v_converted_to,
        COALESCE(v_order->'raw_data', v_order),
        COALESCE(v_order->'lt_raw_data', v_order),
        v_order->>'lt_id', NOW(), NOW()
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
                order_id, line_number, sub_line, product_id, product_code, product_group_code,
                description, quantity, unit, unit_price_cents, total_price_cents, etage_name,
                room_name, window_name, position_id, dim, notes, dimension_spec, configuration_spec,
                is_hybrid, lt_configuration, lt_comment_extern, lt_comment_intern, lt_vat_code,
                lt_vat_percentage, lt_discount_percentage, lt_base_price_cents, lt_reservations,
                lt_stock_status, lt_delivery_status, lt_invoice_status, is_inbegrepen, lt_raw_data,
                lt_id, spatial_metadata, classification_confidence, classification_stage,
                requires_review, extraction_notes,
                created_at, updated_at
            )
            SELECT
                v_order_id,
                COALESCE(NULLIF(TRIM(elem->>'line_number'), '')::int, (ord * 10)::int),
                COALESCE(NULLIF(TRIM(elem->>'sub_line'), '')::int, 0),
                COALESCE(NULLIF(TRIM(elem->>'product_id'), '')::bigint, lp.id),
                COALESCE(elem->>'product_code', elem->>'articleCode', elem->>'code', 'TEKST'),
                audit_eval.resolved_group,
                COALESCE(elem->>'description', elem->>'articleDescription', 'Regel'),
                COALESCE(NULLIF(TRIM(elem->>'quantity'), '')::numeric, 1),
                COALESCE(elem->>'unit', 'stuks'),
                COALESCE(NULLIF(TRIM(elem->>'unit_price_cents'), '')::bigint, 0),
                COALESCE(NULLIF(TRIM(elem->>'total_price_cents'), '')::bigint, 0),
                NULLIF(TRIM(elem->>'etage_name'), ''),
                elem->>'room_name', elem->>'window_name', elem->>'position_id', elem->>'dim', elem->>'notes',
                elem->'dimension_spec', elem->'configuration_spec',
                COALESCE(NULLIF(TRIM(elem->>'is_hybrid'), '')::boolean, false),
                COALESCE(elem->'lt_configuration', elem->'configuration'),
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
                    ELSE COALESCE(elem->'lt_raw_data', elem->'raw_data', elem) 
                END,
                elem->>'lt_id',
                elem->'spatial_metadata',
                audit_eval.resolved_confidence,
                audit_eval.resolved_stage,
                audit_eval.resolved_requires_review,
                -- Extraction Notes (Caller-supplied array extraction or empty array)
                CASE 
                    WHEN elem ? 'extraction_notes' AND jsonb_typeof(elem->'extraction_notes') = 'array' THEN
                        ARRAY(SELECT jsonb_array_elements_text(elem->'extraction_notes'))
                    WHEN elem ? 'extractionNotes' AND jsonb_typeof(elem->'extractionNotes') = 'array' THEN
                        ARRAY(SELECT jsonb_array_elements_text(elem->'extractionNotes'))
                    ELSE NULL::text[]
                END,
                NOW(), NOW()
            FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS arr(elem, ord)
            LEFT JOIN LATERAL (
                SELECT id, product_group_code, is_generic_container
                FROM public.logictrade_products
                WHERE (
                    (NULLIF(TRIM(elem->>'product_id'), '') IS NOT NULL AND id = (elem->>'product_id')::bigint)
                    OR (
                        NULLIF(TRIM(elem->>'product_id'), '') IS NULL
                        AND UPPER(code) = UPPER(COALESCE(NULLIF(TRIM(elem->>'product_code'), ''), NULLIF(TRIM(elem->>'articleCode'), ''), NULLIF(TRIM(elem->>'code'), '')))
                    )
                )
                ORDER BY modified_at DESC NULLS LAST, id DESC
                LIMIT 1
            ) lp ON (
                NULLIF(TRIM(elem->>'product_id'), '') IS NOT NULL
                OR UPPER(COALESCE(NULLIF(TRIM(elem->>'product_code'), ''), NULLIF(TRIM(elem->>'articleCode'), ''), NULLIF(TRIM(elem->>'code'), ''))) NOT IN ('', 'TEKST')
            )
            CROSS JOIN LATERAL (
                SELECT
                    CASE
                        -- 1. Expliciete caller classification stage aanwezig (NeuroSymbolicEngine resultaat)
                        WHEN NULLIF(TRIM(elem->>'classification_stage'), '') IS NOT NULL
                             OR NULLIF(TRIM(elem->>'stage'), '') IS NOT NULL
                        THEN COALESCE(NULLIF(TRIM(elem->>'product_group_code'), ''), '9.9')

                        -- 2. Informatieve Tekst / Nul-regels (case-ongevoelig)
                        WHEN UPPER(TRIM(COALESCE(elem->>'product_code', elem->>'articleCode', elem->>'code', 'TEKST'))) = 'TEKST'
                             AND COALESCE(NULLIF(TRIM(elem->>'total_price_cents'), '')::bigint, 0) = 0 THEN '0.0'

                        -- 3. Negatieve bedragen triage (Credit / Retour / Minderwerk)
                        WHEN COALESCE(NULLIF(TRIM(elem->>'total_price_cents'), '')::bigint, 0) < 0 THEN
                            CASE
                                -- Zuivere kortingen / acties / vouchers
                                WHEN UPPER(COALESCE(elem->>'product_code', elem->>'articleCode', elem->>'code', '')) IN ('A00044570', 'A00014590', 'A00036356')
                                     OR UPPER(TRIM(COALESCE(elem->>'product_code', elem->>'articleCode', elem->>'code', ''))) = 'TEKST'
                                     OR elem->>'description' ILIKE ANY(ARRAY['%korting%', '%actie%', '%cadeaubon%', '%voucher%', '%coupon%'])
                                THEN '0.1'
                                -- Fysieke materiaalretouren (quantity < 0) op materiële groepen
                                WHEN COALESCE(NULLIF(TRIM(elem->>'quantity'), '')::numeric, 1) < 0 
                                     AND lp.product_group_code ~ '^[1-57]\.'
                                THEN lp.product_group_code
                                -- Minderwerk service behoudt effectieve servicegroep
                                WHEN lp.product_group_code ~ '^6\.'
                                THEN lp.product_group_code
                                -- Fail-closed quarantaine voor overige negatieve regels
                                ELSE '9.9'
                            END

                        -- 4. Expliciete beller-code indien geldig en niet '9.9'
                        WHEN NULLIF(NULLIF(TRIM(elem->>'product_group_code'), ''), '9.9') IS NOT NULL
                        THEN TRIM(elem->>'product_group_code')

                        -- 5. Catalogus Match via lp
                        WHEN lp.product_group_code IS NOT NULL AND lp.product_group_code <> '9.9'
                        THEN lp.product_group_code

                        -- 6. Fail-closed fallback
                        ELSE '9.9'
                    END AS resolved_group
            ) rg
            CROSS JOIN LATERAL (
                SELECT
                    rg.resolved_group,
                    -- Confidence
                    COALESCE(
                        NULLIF(TRIM(elem->>'classification_confidence'), '')::numeric(4,3),
                        NULLIF(TRIM(elem->>'confidence'), '')::numeric(4,3),
                        CASE 
                            WHEN rg.resolved_group = '9.9' THEN 0.100
                            ELSE 1.000
                        END
                    ) AS resolved_confidence,
                    -- Stage
                    COALESCE(
                        NULLIF(TRIM(elem->>'classification_stage'), ''),
                        NULLIF(TRIM(elem->>'stage'), ''),
                        CASE 
                            WHEN rg.resolved_group = '9.9' THEN 'trap_4_fail_closed_quarantine'
                            ELSE 'trap_1_master_cache'
                        END
                    ) AS resolved_stage,
                    -- Requires Review
                    COALESCE(
                        NULLIF(TRIM(elem->>'requires_review'), '')::boolean,
                        NULLIF(TRIM(elem->>'requiresReview'), '')::boolean,
                        CASE 
                            WHEN rg.resolved_group = '9.9' THEN true
                            ELSE false
                        END
                    ) AS resolved_requires_review
            ) audit_eval;

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
$function$;

GRANT EXECUTE ON FUNCTION public.ingest_logictrade_order(jsonb, jsonb, boolean) TO anon, authenticated, service_role;
