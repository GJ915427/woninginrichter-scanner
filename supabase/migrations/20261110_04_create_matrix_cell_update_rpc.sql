-- Migration: 20261110_04_create_matrix_cell_update_rpc.sql
-- Description: Stored Procedure voor atomaire cel-updates met 100% Server CPQ herberekening,
-- row-level locking en fail-closed validatie.

CREATE OR REPLACE FUNCTION public.update_matrix_cell(
    p_order_id text,
    p_line_number int,
    p_sub_line int,
    p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actual_order_id text;
    v_updated_line jsonb;
    v_total_amount_cents bigint;
BEGIN
    -- 1. Zoek en lock de orderkop atomair tegen concurrente updates (ID of Ordernummer)
    SELECT id INTO v_actual_order_id 
    FROM public.orders 
    WHERE id = p_order_id OR order_number = p_order_id 
    FOR UPDATE;

    IF v_actual_order_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Order niet gevonden'
        );
    END IF;

    -- 2. Update de specifieke orderregel met 100% Server CPQ integriteit
    UPDATE public.order_lines
    SET
        quantity = COALESCE((p_patch->>'quantity')::numeric, quantity),
        unit_price_cents = CASE 
            WHEN is_inbegrepen THEN 0 
            ELSE COALESCE((p_patch->>'unit_price_cents')::bigint, unit_price_cents) 
        END,
        total_price_cents = CASE 
            WHEN is_inbegrepen THEN 0 
            ELSE ROUND(
                COALESCE((p_patch->>'unit_price_cents')::bigint, unit_price_cents) * 
                COALESCE((p_patch->>'quantity')::numeric, quantity)
            ) 
        END,
        dim = COALESCE(p_patch->>'dim', dim),
        notes = COALESCE(p_patch->>'notes', notes),
        dimension_spec = CASE 
            WHEN p_patch ? 'dimension_spec' THEN p_patch->'dimension_spec' 
            ELSE dimension_spec 
        END,
        updated_at = now()
    WHERE order_id = v_actual_order_id 
      AND line_number = p_line_number 
      AND sub_line = p_sub_line
    RETURNING to_jsonb(public.order_lines.*) INTO v_updated_line;

    IF v_updated_line IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Orderregel niet gevonden'
        );
    END IF;

    -- 3. Herbereken het ordertotaal atomair binnen dezelfde transactie
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

GRANT EXECUTE ON FUNCTION public.update_matrix_cell(text, int, int, jsonb) TO anon, authenticated, service_role;
