-- 1. Tabeldefinitie met supplier_id, groups array en fts_tokens
CREATE TABLE IF NOT EXISTS public.logictrade_products (
    id BIGINT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    supplier_id BIGINT DEFAULT NULL,
    supplier_name TEXT DEFAULT '',
    supplier_code TEXT DEFAULT '',
    group_name TEXT DEFAULT '',
    groups TEXT[] DEFAULT '{}',
    sales_group TEXT DEFAULT '',
    sales_price NUMERIC(12, 2) DEFAULT 0,
    vat_code TEXT DEFAULT '',
    unit TEXT DEFAULT 'stuks',
    raw_data JSONB DEFAULT '{}'::jsonb,
    fts_tokens tsvector,
    modified_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Trigger functie voor veilige, idempotente tsvector generatie
CREATE OR REPLACE FUNCTION public.logictrade_products_fts_trigger()
RETURNS trigger AS $func$
BEGIN
    new.fts_tokens := to_tsvector('dutch', 
        coalesce(new.code, '') || ' ' || 
        coalesce(new.name, '') || ' ' || 
        coalesce(new.description, '') || ' ' || 
        coalesce(new.supplier_name, '') || ' ' || 
        coalesce(new.supplier_code, '') || ' ' || 
        coalesce(new.group_name, '') || ' ' || 
        coalesce(array_to_string(new.groups, ' '), '') || ' ' || 
        coalesce(new.sales_group, '')
    );
    RETURN new;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logictrade_products_fts ON public.logictrade_products;
CREATE TRIGGER trg_logictrade_products_fts
BEFORE INSERT OR UPDATE ON public.logictrade_products
FOR EACH ROW EXECUTE FUNCTION public.logictrade_products_fts_trigger();

-- 3. GIN Index voor sub-10ms conjunctieve full-text search
CREATE INDEX IF NOT EXISTS idx_logictrade_products_fts 
ON public.logictrade_products USING GIN (fts_tokens);

-- 4. Row Level Security & Policies
ALTER TABLE public.logictrade_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read' AND tablename = 'logictrade_products') THEN
        CREATE POLICY "Allow public read" ON public.logictrade_products FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service_role write' AND tablename = 'logictrade_products') THEN
        CREATE POLICY "Allow service_role write" ON public.logictrade_products FOR ALL TO service_role USING (true);
    END IF;
END $$;

-- 5. Sync State Tabel
CREATE TABLE IF NOT EXISTS public.logictrade_sync_state (
    key TEXT PRIMARY KEY,
    last_synced_at TIMESTAMPTZ NOT NULL,
    total_synced INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.logictrade_sync_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read sync_state' AND tablename = 'logictrade_sync_state') THEN
        CREATE POLICY "Allow public read sync_state" ON public.logictrade_sync_state FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service_role write sync_state' AND tablename = 'logictrade_sync_state') THEN
        CREATE POLICY "Allow service_role write sync_state" ON public.logictrade_sync_state FOR ALL TO service_role USING (true);
    END IF;
END $$;

-- 6. Stored Procedure met ts_rank ordening en conjunctieve token-matching
CREATE OR REPLACE FUNCTION public.search_logictrade_products(
    search_query TEXT,
    limit_count INT DEFAULT 20,
    offset_count INT DEFAULT 0
)
RETURNS TABLE (
    id BIGINT,
    code TEXT,
    name TEXT,
    description TEXT,
    supplier_id BIGINT,
    supplier_name TEXT,
    supplier_code TEXT,
    group_name TEXT,
    groups TEXT[],
    sales_group TEXT,
    sales_price NUMERIC,
    vat_code TEXT,
    unit TEXT,
    raw_data JSONB,
    rank REAL,
    total_count BIGINT
)
LANGUAGE plpgsql
AS $func$
DECLARE
    query_ts tsquery;
BEGIN
    SELECT to_tsquery('dutch', string_agg(lexeme || ':*', ' & '))
    INTO query_ts
    FROM unnest(to_tsvector('dutch', coalesce(search_query, '')));

    IF query_ts IS NULL THEN
        RETURN QUERY
        SELECT p.id, p.code, p.name, p.description, p.supplier_id, p.supplier_name, p.supplier_code,
               p.group_name, p.groups, p.sales_group, p.sales_price, p.vat_code, p.unit, p.raw_data,
               1.0::REAL as rank,
               count(*) OVER() as total_count
        FROM public.logictrade_products p
        ORDER BY p.name ASC
        LIMIT limit_count OFFSET offset_count;
    ELSE
        RETURN QUERY
        SELECT p.id, p.code, p.name, p.description, p.supplier_id, p.supplier_name, p.supplier_code,
               p.group_name, p.groups, p.sales_group, p.sales_price, p.vat_code, p.unit, p.raw_data,
               ts_rank(p.fts_tokens, query_ts) as rank,
               count(*) OVER() as total_count
        FROM public.logictrade_products p
        WHERE p.fts_tokens @@ query_ts
        ORDER BY rank DESC, p.name ASC
        LIMIT limit_count OFFSET offset_count;
    END IF;
END;
$func$;
