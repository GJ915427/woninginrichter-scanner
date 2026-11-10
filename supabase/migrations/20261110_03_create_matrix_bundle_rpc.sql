-- Migration: 20261110_03_create_matrix_bundle_rpc.sql
-- Description: Matrix Bundle Read-Only Aggregator RPC for Headless Matrix Retrieval

CREATE OR REPLACE FUNCTION public.get_order_matrix_bundle(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order jsonb;
    v_lines jsonb;
BEGIN
    -- 1. Haal Orderkop op
    SELECT to_jsonb(o)
    INTO v_order
    FROM public.orders o
    WHERE o.id = p_order_id OR o.order_number = p_order_id;

    IF v_order IS NULL THEN
        RETURN NULL;
    END IF;

    -- 2. Haal alle Orderregels op
    SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.line_number ASC, l.sub_line ASC), '[]'::jsonb)
    INTO v_lines
    FROM public.order_lines l
    WHERE l.order_id = v_order->>'id';

    RETURN jsonb_build_object(
        'order', v_order,
        'lines', v_lines
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_matrix_bundle(text) TO anon, authenticated, service_role;
