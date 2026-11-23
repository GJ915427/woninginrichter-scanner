-- ==============================================================================
-- Migratie: 20261122_04_enable_rls_bronze_tables.sql
-- Doel: Inschakelen van Row Level Security (RLS) en expliciete policies voor alle
-- 7 Bronze LogicTrade tabellen conform Supabase Security Baseline Lint 0008.
-- ==============================================================================

-- 1. logictrade_customers
ALTER TABLE public.logictrade_customers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logictrade_customers FROM anon, authenticated;
GRANT ALL ON public.logictrade_customers TO service_role;
GRANT SELECT ON public.logictrade_customers TO authenticated;
DROP POLICY IF EXISTS logictrade_customers_service_role_all ON public.logictrade_customers;
CREATE POLICY logictrade_customers_service_role_all ON public.logictrade_customers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS logictrade_customers_authenticated_select ON public.logictrade_customers;
CREATE POLICY logictrade_customers_authenticated_select ON public.logictrade_customers
  FOR SELECT TO authenticated USING (true);

-- 2. logictrade_suppliers
ALTER TABLE public.logictrade_suppliers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logictrade_suppliers FROM anon, authenticated;
GRANT ALL ON public.logictrade_suppliers TO service_role;
GRANT SELECT ON public.logictrade_suppliers TO authenticated;
DROP POLICY IF EXISTS logictrade_suppliers_service_role_all ON public.logictrade_suppliers;
CREATE POLICY logictrade_suppliers_service_role_all ON public.logictrade_suppliers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS logictrade_suppliers_authenticated_select ON public.logictrade_suppliers;
CREATE POLICY logictrade_suppliers_authenticated_select ON public.logictrade_suppliers
  FOR SELECT TO authenticated USING (true);

-- 3. logictrade_purchase_orders
ALTER TABLE public.logictrade_purchase_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logictrade_purchase_orders FROM anon, authenticated;
GRANT ALL ON public.logictrade_purchase_orders TO service_role;
GRANT SELECT ON public.logictrade_purchase_orders TO authenticated;
DROP POLICY IF EXISTS logictrade_purchase_orders_service_role_all ON public.logictrade_purchase_orders;
CREATE POLICY logictrade_purchase_orders_service_role_all ON public.logictrade_purchase_orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS logictrade_purchase_orders_authenticated_select ON public.logictrade_purchase_orders;
CREATE POLICY logictrade_purchase_orders_authenticated_select ON public.logictrade_purchase_orders
  FOR SELECT TO authenticated USING (true);

-- 4. logictrade_purchase_order_lines
ALTER TABLE public.logictrade_purchase_order_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logictrade_purchase_order_lines FROM anon, authenticated;
GRANT ALL ON public.logictrade_purchase_order_lines TO service_role;
GRANT SELECT ON public.logictrade_purchase_order_lines TO authenticated;
DROP POLICY IF EXISTS logictrade_purchase_order_lines_service_role_all ON public.logictrade_purchase_order_lines;
CREATE POLICY logictrade_purchase_order_lines_service_role_all ON public.logictrade_purchase_order_lines
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS logictrade_purchase_order_lines_authenticated_select ON public.logictrade_purchase_order_lines;
CREATE POLICY logictrade_purchase_order_lines_authenticated_select ON public.logictrade_purchase_order_lines
  FOR SELECT TO authenticated USING (true);

-- 5. logictrade_configurator_schemas (Publiek leesbaar voor configurator webshop)
ALTER TABLE public.logictrade_configurator_schemas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logictrade_configurator_schemas FROM anon, authenticated;
GRANT ALL ON public.logictrade_configurator_schemas TO service_role;
GRANT SELECT ON public.logictrade_configurator_schemas TO anon, authenticated;
DROP POLICY IF EXISTS logictrade_configurator_schemas_service_role_all ON public.logictrade_configurator_schemas;
CREATE POLICY logictrade_configurator_schemas_service_role_all ON public.logictrade_configurator_schemas
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS logictrade_configurator_schemas_public_select ON public.logictrade_configurator_schemas;
CREATE POLICY logictrade_configurator_schemas_public_select ON public.logictrade_configurator_schemas
  FOR SELECT TO anon, authenticated USING (true);

-- 6. logictrade_configurator_option_values (Publiek leesbaar voor configurator webshop)
ALTER TABLE public.logictrade_configurator_option_values ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logictrade_configurator_option_values FROM anon, authenticated;
GRANT ALL ON public.logictrade_configurator_option_values TO service_role;
GRANT SELECT ON public.logictrade_configurator_option_values TO anon, authenticated;
DROP POLICY IF EXISTS logictrade_configurator_option_values_service_role_all ON public.logictrade_configurator_option_values;
CREATE POLICY logictrade_configurator_option_values_service_role_all ON public.logictrade_configurator_option_values
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS logictrade_configurator_option_values_public_select ON public.logictrade_configurator_option_values;
CREATE POLICY logictrade_configurator_option_values_public_select ON public.logictrade_configurator_option_values
  FOR SELECT TO anon, authenticated USING (true);

-- 7. logictrade_test (Robuuste conditionele afhandeling in PL/pgSQL block)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'logictrade_test') THEN
    ALTER TABLE public.logictrade_test ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.logictrade_test FROM anon, authenticated;
    GRANT ALL ON public.logictrade_test TO service_role;
    DROP POLICY IF EXISTS logictrade_test_service_role_all ON public.logictrade_test;
    CREATE POLICY logictrade_test_service_role_all ON public.logictrade_test
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. PostgREST Schema Cache Refresh
NOTIFY pgrst, 'reload schema';
