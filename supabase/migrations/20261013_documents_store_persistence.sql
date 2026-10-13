-- Migration: 20261013_documents_store_persistence.sql
-- Persistentie van documenten en tombstones in Supabase

CREATE TABLE IF NOT EXISTS public.documents_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    sha256 TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_store_filename ON public.documents_store(filename);
CREATE INDEX IF NOT EXISTS idx_documents_store_is_deleted ON public.documents_store(is_deleted);

ALTER TABLE public.documents_store ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'documents_store' AND policyname = 'Allow public all on documents_store'
    ) THEN
        CREATE POLICY "Allow public all on documents_store"
            ON public.documents_store
            FOR ALL
            TO anon, authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

GRANT ALL ON public.documents_store TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_store_updated_at ON public.documents_store;
CREATE TRIGGER trg_documents_store_updated_at
    BEFORE UPDATE ON public.documents_store
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

NOTIFY pgrst, 'reload schema';
