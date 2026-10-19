-- UP MIGRATION: LogicTrade Configurator Schemas Persistence
CREATE TABLE IF NOT EXISTS public.logictrade_configurator_schemas (
    option_id INTEGER PRIMARY KEY,
    step_id TEXT NOT NULL,
    option_code TEXT NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'algemeen',
    kind INTEGER NOT NULL DEFAULT 300,
    possible_values JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lt_config_schemas_active_category
    ON public.logictrade_configurator_schemas (category, is_active);

CREATE INDEX IF NOT EXISTS idx_lt_config_schemas_step_id
    ON public.logictrade_configurator_schemas (step_id);

INSERT INTO public.logictrade_sync_state (id, total_synced, checkpoint_page)
VALUES ('schema_sync', 0, 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.logictrade_configurator_schemas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'logictrade_configurator_schemas'
          AND policyname = 'Allow public read on active configurator schemas'
    ) THEN
        CREATE POLICY "Allow public read on active configurator schemas"
            ON public.logictrade_configurator_schemas FOR SELECT
            USING (true);
    END IF;
END $$;

-- ROLLBACK CONTRACT (DOWN):
-- DROP TABLE IF EXISTS public.logictrade_configurator_schemas;
-- DELETE FROM public.logictrade_sync_state WHERE id = 'schema_sync';
