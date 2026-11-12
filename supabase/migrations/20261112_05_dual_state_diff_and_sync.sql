-- migration: 20261112_05_dual_state_diff_and_sync.sql
-- Integrale Synchronisatie- & Verrijkingsarchitectuur (LogicTrade ERP <-> Supabase)
-- Dual-State Data Model op order_lines, Polymorfe Mechanische Diff Engine,
-- 100% Server CPQ update_matrix_cell met base_total_price_cents en Lazy Survey Lifecycle.

-- ============================================================================
-- Stap 1: Voeg nieuwe kolommen toe als nullable
-- ============================================================================
ALTER TABLE public.order_lines 
  ADD COLUMN IF NOT EXISTS external_line_id TEXT,
  ADD COLUMN IF NOT EXISTS base_total_price_cents BIGINT,
  ADD COLUMN IF NOT EXISTS erp_dimension_spec JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS measured_dimension_spec JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS diff_status TEXT NOT NULL DEFAULT 'in_sync',
  ADD COLUMN IF NOT EXISTS diff_details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS spatial_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- ============================================================================
-- Stap 2: Intelligente Reconciliatie & Backfill bestaande regels
-- ============================================================================
UPDATE public.order_lines ol
SET 
    external_line_id = COALESCE(
        (
            SELECT NULLIF(elem->>'id', '')
            FROM public.orders o,
                 jsonb_array_elements(COALESCE(o.raw_data->'lines', o.raw_data->'order'->'lines', '[]'::jsonb)) AS elem
            WHERE o.id = ol.order_id 
              AND COALESCE(elem->>'line_number', elem->>'lineNumber')::int = ol.line_number
            LIMIT 1
        ),
        ol.line_number::text
    ),
    erp_dimension_spec = COALESCE(ol.erp_dimension_spec, ol.dimension_spec),
    base_total_price_cents = COALESCE(ol.base_total_price_cents, ol.total_price_cents)
WHERE ol.external_line_id IS NULL OR ol.erp_dimension_spec IS NULL OR ol.base_total_price_cents IS NULL;

-- ============================================================================
-- Stap 3: Maak external_line_id NOT NULL en installeer uq_order_lines_external_line
-- ============================================================================
ALTER TABLE public.order_lines ALTER COLUMN external_line_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_order_lines_external_line'
    ) THEN
        ALTER TABLE public.order_lines ADD CONSTRAINT uq_order_lines_external_line UNIQUE (order_id, external_line_id, sub_line);
    END IF;
END $$;

-- ============================================================================
-- Stap 4: Ingest Function met Uniforme Lock Hiërarchie & Parent Reconciliatie
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ingest_logictrade_order(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_header jsonb;
    v_order_id text;
    v_lines_count integer := 0;
    v_lines_payload jsonb;
    l jsonb;
    v_ext_line_id text;
    v_line_num int;
    v_sub_line int;
BEGIN
    -- Polymorfe payload ondersteuning ({ order: {...}, lines: [...] } of plat orderobject)
    v_order_header := COALESCE(p_order->'order', p_order);
    v_order_id := v_order_header->>'id';
    v_lines_payload := COALESCE(p_order->'lines', v_order_header->'lines', '[]'::jsonb);

    IF v_order_id IS NULL THEN
        RAISE EXCEPTION 'Order ID ontbreekt in payload';
    END IF;

    -- Concurrency lock op order_id (Stap 1 in de Uniforme Lock Hiërarchie)
    PERFORM pg_advisory_xact_lock(hashtext(v_order_id));

    -- 1. Upsert Order Header conform HEAD schema
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
        COALESCE(v_order_header->'raw_data', p_order),
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

    -- 2. Upsert Order Lines met behoud van ruimtelijke annotaties en LATERAL product mapping
    IF jsonb_array_length(v_lines_payload) > 0 THEN
        -- Reconciliatiestap voor legacy rijen: update external_line_id voor hoofdregel én kind-serviceregels
        FOR l IN SELECT * FROM jsonb_array_elements(v_lines_payload)
        LOOP
            v_ext_line_id := COALESCE(
                NULLIF(l->>'id', ''),
                NULLIF(l->>'external_line_id', ''),
                COALESCE(l->>'line_number', l->>'lineNumber')::text,
                '0'
            );
            v_line_num := COALESCE((COALESCE(l->>'line_number', l->>'lineNumber'))::int, 1);

            UPDATE public.order_lines
            SET external_line_id = v_ext_line_id
            WHERE order_id = v_order_id 
              AND line_number = v_line_num 
              AND external_line_id != v_ext_line_id
              AND external_line_id ~ '^[0-9]+$';
        END LOOP;

        INSERT INTO public.order_lines (
            order_id,
            line_number,
            sub_line,
            external_line_id,
            product_id,
            product_code,
            product_group_code,
            description,
            quantity,
            unit,
            unit_price_cents,
            total_price_cents,
            base_total_price_cents,
            is_hybrid,
            is_inbegrepen,
            etage_name,
            room_name,
            window_name,
            position_id,
            dim,
            notes,
            erp_dimension_spec,
            updated_at
        )
        SELECT
            v_order_id,
            COALESCE((COALESCE(l->>'line_number', l->>'lineNumber'))::int, 1),
            COALESCE((l->>'sub_line')::int, 0),
            COALESCE(
                NULLIF(l->>'id', ''),
                NULLIF(l->>'external_line_id', ''),
                COALESCE(l->>'line_number', l->>'lineNumber')::text,
                '0'
            ),
            COALESCE(NULLIF(l->>'product_id', '')::bigint, lp.id),
            COALESCE(l->>'product_code', 'TEKST'),
            COALESCE(NULLIF(l->>'product_group_code', ''), lp.product_group_code, '9.9'),
            l->>'description',
            COALESCE((l->>'quantity')::numeric, 1),
            COALESCE(l->>'unit', 'stuks'),
            COALESCE((l->>'unit_price_cents')::bigint, 0),
            COALESCE((l->>'total_price_cents')::bigint, 0),
            COALESCE(
                NULLIF(l->>'base_total_price_cents', '')::bigint,
                CASE 
                    WHEN COALESCE((l->>'is_inbegrepen')::boolean, false) AND NULLIF(l->>'unit_price_cents', '') IS NOT NULL AND NULLIF(l->>'quantity', '') IS NOT NULL
                    THEN ROUND((l->>'unit_price_cents')::numeric * (l->>'quantity')::numeric)::bigint
                    ELSE NULLIF(l->>'total_price_cents', '')::bigint
                END,
                0
            ),
            COALESCE((l->>'is_hybrid')::boolean, false),
            COALESCE((l->>'is_inbegrepen')::boolean, false),
            COALESCE(l->>'etage_name', 'Begane grond'),
            l->>'room_name',
            l->>'window_name',
            l->>'position_id',
            l->>'dim',
            l->>'notes',
            COALESCE(l->'dimension_spec', l->'erp_dimension_spec'),
            now()
        FROM jsonb_array_elements(v_lines_payload) AS l
        LEFT JOIN LATERAL (
            SELECT p.id, p.product_group_code
            FROM public.logictrade_products p
            WHERE p.code = l->>'product_code'
            ORDER BY p.modified_at DESC NULLS LAST
            LIMIT 1
        ) lp ON (COALESCE(l->>'product_code', '') NOT IN ('', 'TEKST') AND NULLIF(l->>'product_id', '') IS NULL)
        ON CONFLICT (order_id, external_line_id, sub_line) DO UPDATE SET
            line_number = EXCLUDED.line_number,
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
            base_total_price_cents = CASE 
                WHEN EXCLUDED.is_inbegrepen AND order_lines.base_total_price_cents > 0 THEN order_lines.base_total_price_cents
                WHEN NULLIF(EXCLUDED.base_total_price_cents, 0) IS NOT NULL THEN EXCLUDED.base_total_price_cents
                ELSE EXCLUDED.total_price_cents 
            END,
            is_hybrid = EXCLUDED.is_hybrid,
            is_inbegrepen = EXCLUDED.is_inbegrepen,
            etage_name = COALESCE(order_lines.etage_name, EXCLUDED.etage_name),
            room_name = COALESCE(order_lines.room_name, EXCLUDED.room_name),
            window_name = COALESCE(order_lines.window_name, EXCLUDED.window_name),
            position_id = COALESCE(order_lines.position_id, EXCLUDED.position_id),
            dim = COALESCE(order_lines.dim, EXCLUDED.dim),
            notes = COALESCE(order_lines.notes, EXCLUDED.notes),
            erp_dimension_spec = EXCLUDED.erp_dimension_spec,
            updated_at = now();

        GET DIAGNOSTICS v_lines_count = ROW_COUNT;

        -- 3. Sanering van vervallen regels binnen dezelfde order op basis van parent external_line_id
        -- Behoudt regels die lokaal zijn ingemeten (measured_dimension_spec IS NOT NULL)
        DELETE FROM public.order_lines
        WHERE order_id = v_order_id
          AND measured_dimension_spec IS NULL
          AND external_line_id NOT IN (
            SELECT 
                COALESCE(
                    NULLIF(del_l->>'id', ''),
                    NULLIF(del_l->>'external_line_id', ''),
                    COALESCE(del_l->>'line_number', del_l->>'lineNumber')::text,
                    '0'
                )
            FROM jsonb_array_elements(v_lines_payload) AS del_l
          );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'lines_processed', v_lines_count
    );
END;
$$;

-- ============================================================================
-- Stap 5: Oude unieke constraint veilig verwijderen
-- ============================================================================
ALTER TABLE public.order_lines DROP CONSTRAINT IF EXISTS uq_order_lines_order_line_subline;

-- ============================================================================
-- Stap 6: Polymorfe Mechanische Diff Engine (Trigger recalculate_order_line_diff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_order_line_diff()
RETURNS trigger AS $$
DECLARE
    v_type text;
    v_diff jsonb := '{}'::jsonb;
    v_erp jsonb;
    v_meas jsonb;
BEGIN
    -- 0. Uitsluiting: uitsluitend afgeleide subregels (sub_line > 0) of regels zonder enige dimensiedata
    IF NEW.sub_line > 0 OR (NEW.erp_dimension_spec IS NULL AND NEW.measured_dimension_spec IS NULL) THEN
        NEW.diff_status := 'in_sync';
        NEW.diff_details := '{}'::jsonb;
        RETURN NEW;
    END IF;

    -- 1. Normaliseer JSONB null scalars ('null'::jsonb) en SQL NULLs defensief
    IF NEW.erp_dimension_spec = 'null'::jsonb THEN NEW.erp_dimension_spec := NULL; END IF;
    IF NEW.measured_dimension_spec = 'null'::jsonb THEN NEW.measured_dimension_spec := NULL; END IF;
    IF NEW.erp_dimension_spec IS NULL OR jsonb_typeof(NEW.erp_dimension_spec) != 'object' THEN
        v_erp := NULL;
    ELSE
        v_erp := NEW.erp_dimension_spec - 'areaM2' - 'grossAreaM2' - 'packageSizeM2' - 'packageCount';
    END IF;

    IF NEW.measured_dimension_spec IS NULL OR jsonb_typeof(NEW.measured_dimension_spec) != 'object' THEN
        v_meas := NULL;
    ELSE
        v_meas := NEW.measured_dimension_spec - 'areaM2' - 'grossAreaM2' - 'packageSizeM2' - 'packageCount';
    END IF;

    -- 2. Lazy Survey Lifecycle evaluatie
    IF v_meas IS NULL THEN
        NEW.diff_status := 'in_sync';
        NEW.diff_details := '{}'::jsonb;
        RETURN NEW;
    ELSIF v_meas IS NOT NULL AND v_erp IS NULL THEN
        NEW.diff_status := 'survey_diff';
        NEW.diff_details := jsonb_build_object('_status', 'Lokaal ingemeten, nog niet geconfigureerd in ERP');
        RETURN NEW;
    END IF;

    -- 3. Identieke genormaliseerde objecten zijn direct in_sync
    IF v_erp = v_meas THEN
        NEW.diff_status := 'in_sync';
        NEW.diff_details := '{}'::jsonb;
        RETURN NEW;
    END IF;

    -- 4. Toets eerst op typologie-ongelijkheid
    IF (v_meas->>'type') IS DISTINCT FROM (v_erp->>'type') THEN
        v_diff := jsonb_set(v_diff, '{type}', jsonb_build_object('erp', v_erp->'type', 'measured', v_meas->'type'));
    END IF;

    -- 5. Polymorfe inspectie per domeintype conform src/types/matrix.ts met defensieve casts
    v_type := COALESCE(v_meas->>'type', v_erp->>'type', 'unknown');

    IF v_type IN ('window_2d', 'curtain_linear') THEN
        IF NULLIF(v_meas->>'widthMm', '')::numeric IS DISTINCT FROM NULLIF(v_erp->>'widthMm', '')::numeric THEN
            v_diff := jsonb_set(v_diff, '{widthMm}', jsonb_build_object('erp', v_erp->'widthMm', 'measured', v_meas->'widthMm'));
        END IF;
        IF NULLIF(v_meas->>'heightMm', '')::numeric IS DISTINCT FROM NULLIF(v_erp->>'heightMm', '')::numeric THEN
            v_diff := jsonb_set(v_diff, '{heightMm}', jsonb_build_object('erp', v_erp->'heightMm', 'measured', v_meas->'heightMm'));
        END IF;
        IF v_type = 'curtain_linear' THEN
            IF NULLIF(v_meas->>'pleatFactor', '')::numeric IS DISTINCT FROM NULLIF(v_erp->>'pleatFactor', '')::numeric THEN
                v_diff := jsonb_set(v_diff, '{pleatFactor}', jsonb_build_object('erp', v_erp->'pleatFactor', 'measured', v_meas->'pleatFactor'));
            END IF;
            IF NULLIF(v_meas->>'fabricWidthMm', '')::numeric IS DISTINCT FROM NULLIF(v_erp->>'fabricWidthMm', '')::numeric THEN
                v_diff := jsonb_set(v_diff, '{fabricWidthMm}', jsonb_build_object('erp', v_erp->'fabricWidthMm', 'measured', v_meas->'fabricWidthMm'));
            END IF;
        END IF;
    ELSIF v_type = 'floor_area' THEN
        IF NULLIF(v_meas->>'netAreaM2', '')::numeric IS DISTINCT FROM NULLIF(v_erp->>'netAreaM2', '')::numeric THEN
            v_diff := jsonb_set(v_diff, '{netAreaM2}', jsonb_build_object('erp', v_erp->'netAreaM2', 'measured', v_meas->'netAreaM2'));
        END IF;
        IF NULLIF(v_meas->>'wastePercentage', '')::numeric IS DISTINCT FROM NULLIF(v_erp->>'wastePercentage', '')::numeric THEN
            v_diff := jsonb_set(v_diff, '{wastePercentage}', jsonb_build_object('erp', v_erp->'wastePercentage', 'measured', v_meas->'wastePercentage'));
        END IF;
    ELSIF v_type = 'stairs' THEN
        IF NULLIF(v_meas->>'stepsCount', '')::numeric IS DISTINCT FROM NULLIF(v_erp->>'stepsCount', '')::numeric THEN
            v_diff := jsonb_set(v_diff, '{stepsCount}', jsonb_build_object('erp', v_erp->'stepsCount', 'measured', v_meas->'stepsCount'));
        END IF;
        IF (v_meas->>'stairType') IS DISTINCT FROM (v_erp->>'stairType') THEN
            v_diff := jsonb_set(v_diff, '{stairType}', jsonb_build_object('erp', v_erp->'stairType', 'measured', v_meas->'stairType'));
        END IF;
        IF NULLIF(v_meas->>'hasRisers', '')::boolean IS DISTINCT FROM NULLIF(v_erp->>'hasRisers', '')::boolean THEN
            v_diff := jsonb_set(v_diff, '{hasRisers}', jsonb_build_object('erp', v_erp->'hasRisers', 'measured', v_meas->'hasRisers'));
        END IF;
        IF NULLIF(v_meas->>'isOpen', '')::boolean IS DISTINCT FROM NULLIF(v_erp->>'isOpen', '')::boolean THEN
            v_diff := jsonb_set(v_diff, '{isOpen}', jsonb_build_object('erp', v_erp->'isOpen', 'measured', v_meas->'isOpen'));
        END IF;
        IF NULLIF(v_meas->>'ledLighting', '')::boolean IS DISTINCT FROM NULLIF(v_erp->>'ledLighting', '')::boolean THEN
            v_diff := jsonb_set(v_diff, '{ledLighting}', jsonb_build_object('erp', v_erp->'ledLighting', 'measured', v_meas->'ledLighting'));
        END IF;
        IF NULLIF(v_meas->>'bandering', '')::boolean IS DISTINCT FROM NULLIF(v_erp->>'bandering', '')::boolean THEN
            v_diff := jsonb_set(v_diff, '{bandering}', jsonb_build_object('erp', v_erp->'bandering', 'measured', v_meas->'bandering'));
        END IF;
        IF NULLIF(v_meas->>'widthMm', '')::numeric IS DISTINCT FROM NULLIF(v_erp->>'widthMm', '')::numeric THEN
            v_diff := jsonb_set(v_diff, '{widthMm}', jsonb_build_object('erp', v_erp->'widthMm', 'measured', v_meas->'widthMm'));
        END IF;
    ELSIF v_type = 'piece_service' THEN
        IF (v_meas->>'unit') IS DISTINCT FROM (v_erp->>'unit') THEN
            v_diff := jsonb_set(v_diff, '{unit}', jsonb_build_object('erp', v_erp->'unit', 'measured', v_meas->'unit'));
        END IF;
    ELSE
        v_diff := jsonb_build_object('_generic_diff', true);
    END IF;

    -- Evaluatie
    IF v_type IN ('window_2d', 'curtain_linear', 'floor_area', 'stairs', 'piece_service') AND v_diff = '{}'::jsonb THEN
        NEW.diff_status := 'in_sync';
        NEW.diff_details := '{}'::jsonb;
    ELSIF v_diff = '{}'::jsonb THEN
        NEW.diff_status := 'survey_diff';
        NEW.diff_details := jsonb_build_object('_unmapped_delta', true);
    ELSE
        NEW.diff_status := 'survey_diff';
        NEW.diff_details := v_diff;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_order_line_diff ON public.order_lines;
CREATE TRIGGER trg_recalculate_order_line_diff
BEFORE INSERT OR UPDATE ON public.order_lines
FOR EACH ROW EXECUTE FUNCTION public.recalculate_order_line_diff();

-- ============================================================================
-- Stap 7: update_matrix_cell met 100% Server CPQ & Lazy Survey Lifecycle
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_matrix_cell(
    p_order_id text,
    p_line_id bigint,
    p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actual_order_id text;
    v_current_line record;
    v_is_inbegrepen boolean;
    v_is_dimensional boolean;
    v_updated_line jsonb;
    v_total_amount_cents bigint;
BEGIN
    -- 1. Resolveer ID zónder exclusieve row-lock
    SELECT id INTO v_actual_order_id 
    FROM public.orders 
    WHERE id = p_order_id OR order_number = p_order_id;

    IF v_actual_order_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order niet gevonden');
    END IF;

    -- 2. Advisory Lock gesynchroniseerd op v_actual_order_id (Uniforme Lock Hiërarchie)
    PERFORM pg_advisory_xact_lock(hashtext(v_actual_order_id));

    -- 3. Haal huidige regel op ter deterministische evaluatie
    SELECT * INTO v_current_line
    FROM public.order_lines
    WHERE id = p_line_id AND order_id = v_actual_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orderregel niet gevonden');
    END IF;

    -- Los effectieve status vooraf op met defensieve NULLIF
    v_is_inbegrepen := COALESCE(
        NULLIF(p_patch->>'is_inbegrepen', '')::boolean,
        NULLIF(p_patch->>'isInbegrepen', '')::boolean,
        v_current_line.is_inbegrepen
    );

    -- Toets of regel dimensionaal is
    v_is_dimensional := (
        v_current_line.dim IS NOT NULL OR 
        v_current_line.erp_dimension_spec IS NOT NULL OR 
        v_current_line.measured_dimension_spec IS NOT NULL OR 
        p_patch ? 'measured_dimension_spec' OR 
        p_patch ? 'dimension_spec'
    );

    -- 4. Update measured_dimension_spec EN beheer base_total_price_cents en total_price_cents
    UPDATE public.order_lines
    SET
        is_inbegrepen = v_is_inbegrepen,
        quantity = COALESCE(NULLIF(p_patch->>'quantity', '')::numeric, quantity),
        unit_price_cents = CASE 
            WHEN NULLIF(p_patch->>'unit_price_cents', '') IS NOT NULL THEN (p_patch->>'unit_price_cents')::bigint 
            ELSE unit_price_cents 
        END,
        base_total_price_cents = CASE 
            WHEN NULLIF(p_patch->>'base_total_price_cents', '') IS NOT NULL THEN (p_patch->>'base_total_price_cents')::bigint
            WHEN NULLIF(p_patch->>'total_price_cents', '') IS NOT NULL AND NOT v_is_inbegrepen THEN (p_patch->>'total_price_cents')::bigint
            WHEN NOT v_is_dimensional AND (NULLIF(p_patch->>'unit_price_cents', '') IS NOT NULL OR NULLIF(p_patch->>'quantity', '') IS NOT NULL) THEN ROUND(
                COALESCE(NULLIF(p_patch->>'unit_price_cents', '')::bigint, unit_price_cents) * 
                COALESCE(NULLIF(p_patch->>'quantity', '')::numeric, quantity)
            )
            ELSE COALESCE(base_total_price_cents, total_price_cents)
        END,
        total_price_cents = CASE 
            WHEN v_is_inbegrepen THEN 0 
            WHEN NULLIF(p_patch->>'total_price_cents', '') IS NOT NULL THEN (p_patch->>'total_price_cents')::bigint
            WHEN NOT v_is_dimensional AND (NULLIF(p_patch->>'unit_price_cents', '') IS NOT NULL OR NULLIF(p_patch->>'quantity', '') IS NOT NULL) THEN ROUND(
                COALESCE(NULLIF(p_patch->>'unit_price_cents', '')::bigint, unit_price_cents) * 
                COALESCE(NULLIF(p_patch->>'quantity', '')::numeric, quantity)
            ) 
            ELSE COALESCE(base_total_price_cents, total_price_cents)
        END,
        dim = COALESCE(p_patch->>'dim', dim),
        notes = COALESCE(p_patch->>'notes', notes),
        measured_dimension_spec = CASE 
            WHEN p_patch ? 'measured_dimension_spec' THEN p_patch->'measured_dimension_spec'
            WHEN p_patch ? 'dimension_spec' THEN p_patch->'dimension_spec'
            ELSE measured_dimension_spec
        END,
        spatial_updated_at = COALESCE(
            NULLIF(p_patch->>'spatial_updated_at', '')::timestamptz,
            CASE WHEN p_patch ? 'measured_dimension_spec' OR p_patch ? 'dimension_spec' THEN now() ELSE spatial_updated_at END
        ),
        updated_at = now()
    WHERE id = p_line_id AND order_id = v_actual_order_id
    RETURNING to_jsonb(public.order_lines.*) INTO v_updated_line;

    -- 5. Herbereken ordertotaal atomair binnen dezelfde transactie
    UPDATE public.orders 
    SET 
        total_amount_cents = (
            SELECT COALESCE(SUM(total_price_cents), 0) 
            FROM public.order_lines 
            WHERE order_id = v_actual_order_id
        ),
        updated_at = now()
    WHERE id = v_actual_order_id
    RETURNING total_amount_cents INTO v_total_amount_cents;

    RETURN jsonb_build_object(
        'success', true, 
        'updated_line', v_updated_line,
        'total_amount_cents', v_total_amount_cents
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_matrix_cell(text, bigint, jsonb) TO authenticated, service_role, anon;

-- ============================================================================
-- Stap 8: Backwards-compatible 4-argument wrapper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_matrix_cell(
    p_order_id text,
    p_line_number integer,
    p_sub_line integer,
    p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actual_order_id text;
    v_target_line_id bigint;
BEGIN
    SELECT id INTO v_actual_order_id
    FROM public.orders
    WHERE id = p_order_id OR order_number = p_order_id;

    IF v_actual_order_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order niet gevonden');
    END IF;

    -- Concurrency lock op order_id (Uniforme Lock Hiërarchie: Lock First!)
    PERFORM pg_advisory_xact_lock(hashtext(v_actual_order_id));

    SELECT id INTO v_target_line_id
    FROM public.order_lines
    WHERE order_id = v_actual_order_id 
      AND line_number = p_line_number 
      AND sub_line = p_sub_line;
      
    IF v_target_line_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orderregel niet gevonden op line_number/sub_line');
    END IF;
    
    RETURN public.update_matrix_cell(v_actual_order_id, v_target_line_id, p_patch);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_matrix_cell(text, integer, integer, jsonb) TO authenticated, service_role, anon;
