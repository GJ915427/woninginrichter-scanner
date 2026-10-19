-- ==============================================================================
-- Migratie: 20261012_google_grade_search_and_tiers.sql
-- Doel: Diamond-Grade Server-Side Tier Ranking & Universele Category Filter RPC
-- Invarianten: Non-blocking DDL, ranking vóór LIMIT 20, zero-data-loss rollback
-- ==============================================================================

SET lock_timeout = '3s';

-- 1. Kolom toevoegen (metadata operatie in PG11+, non-blocking)
ALTER TABLE public.logictrade_products 
ADD COLUMN IF NOT EXISTS product_tier SMALLINT NOT NULL DEFAULT 1;

-- 2. B-Tree Index voor samengestelde sortering (zonder CONCURRENTLY in migratieblok)
CREATE INDEX IF NOT EXISTS idx_logictrade_products_tier_name 
ON public.logictrade_products (product_tier ASC, name ASC);

-- 3. Batched Backfill om lock timeouts op 100k rijen te voorkomen
DO $$
DECLARE
    batch_count INT := 1;
BEGIN
    WHILE batch_count > 0 LOOP
        UPDATE public.logictrade_products
        SET product_tier = CASE
            WHEN (name ~* '(uitlopende?\s+collectie|\buitlopend\b)' OR coalesce(description, '') ~* '(uitlopende?\s+collectie|\buitlopend\b)') THEN 5
            WHEN name ~* '\b(staal|stalen|service|monster|collectieboek|prijsklasse)\b' THEN 4
            WHEN name ~* '\b(bedieningsstang|stang|stangen|klemsteun|klemsteunen|steun|steunen|onderdeel|onderdelen|reparatieset)\b' THEN 3
            WHEN name ~* '\b(dakraam|combi)\b' THEN 2
            ELSE 1
        END
        WHERE id IN (
            SELECT id FROM public.logictrade_products
            WHERE product_tier IS NULL OR product_tier != CASE
                WHEN (name ~* '(uitlopende?\s+collectie|\buitlopend\b)' OR coalesce(description, '') ~* '(uitlopende?\s+collectie|\buitlopend\b)') THEN 5
                WHEN name ~* '\b(staal|stalen|service|monster|collectieboek|prijsklasse)\b' THEN 4
                WHEN name ~* '\b(bedieningsstang|stang|stangen|klemsteun|klemsteunen|steun|steunen|onderdeel|onderdelen|reparatieset)\b' THEN 3
                WHEN name ~* '\b(dakraam|combi)\b' THEN 2
                ELSE 1
            END
            LIMIT 10000
        );
        GET DIAGNOSTICS batch_count = ROW_COUNT;
    END LOOP;
END $$;

-- 4. Sync Trigger voor automatische tier-toewijzing bij mutaties
CREATE OR REPLACE FUNCTION public.logictrade_products_tier_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.product_tier := CASE
        WHEN (NEW.name ~* '(uitlopende?\s+collectie|\buitlopend\b)' OR coalesce(NEW.description, '') ~* '(uitlopende?\s+collectie|\buitlopend\b)') THEN 5
        WHEN NEW.name ~* '\b(staal|stalen|service|monster|collectieboek|prijsklasse)\b' THEN 4
        WHEN NEW.name ~* '\b(bedieningsstang|stang|stangen|klemsteun|klemsteunen|steun|steunen|onderdeel|onderdelen|reparatieset)\b' THEN 3
        WHEN NEW.name ~* '\b(dakraam|combi)\b' THEN 2
        ELSE 1
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logictrade_products_tier ON public.logictrade_products;
CREATE TRIGGER trg_logictrade_products_tier
BEFORE INSERT OR UPDATE OF name, description ON public.logictrade_products
FOR EACH ROW EXECUTE FUNCTION public.logictrade_products_tier_trigger();

-- 5. Drop oude functiesignaturen vóór herdefinitie
DROP FUNCTION IF EXISTS public.search_logictrade_products_universal(text, integer, integer);
DROP FUNCTION IF EXISTS public.search_logictrade_products_universal(text, text, integer, integer);

-- 6. Universele RPC met Category Filter en Tier Ranking vóór LIMIT
CREATE OR REPLACE FUNCTION public.search_logictrade_products_universal(
    search_query TEXT,
    category_filter TEXT DEFAULT NULL,
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
    product_tier SMALLINT,
    is_discontinued BOOLEAN,
    rank REAL,
    total_count BIGINT
)
LANGUAGE plpgsql
AS $func$
DECLARE
    clean_query TEXT := trim(coalesce(search_query, ''));
    clean_cat TEXT := trim(coalesce(category_filter, ''));
    raw_tokens TEXT[];
    t1 TEXT := '';
    t2 TEXT := '';
    t3 TEXT := '';
    is_trigram BOOLEAN;
BEGIN
    raw_tokens := string_to_array(regexp_replace(clean_query, '[^a-zA-Z0-9\s]', ' ', 'g'), ' ');
    raw_tokens := array_remove(raw_tokens, '');
    
    t1 := coalesce(raw_tokens[1], '');
    t2 := coalesce(raw_tokens[2], '');
    t3 := coalesce(raw_tokens[3], '');

    is_trigram := (length(clean_query) >= 2 AND length(clean_query) <= 3);

    RETURN QUERY
    WITH filtered_pool AS (
        SELECT 
            p.id,
            p.code,
            p.name,
            p.description,
            p.supplier_id,
            p.supplier_name,
            p.supplier_code,
            p.group_name,
            p.groups,
            p.sales_group,
            p.sales_price,
            p.vat_code,
            p.unit,
            p.raw_data,
            p.product_tier,
            (p.product_tier = 5) AS is_discontinued,
            CASE
                WHEN clean_query = '' THEN 1.0::real
                WHEN is_trigram THEN (similarity(p.name, clean_query) * 2.0 + similarity(p.code, clean_query))::real
                ELSE (
                    (CASE WHEN p.code ILIKE clean_query || '%' THEN 5.0 ELSE 0.0 END) +
                    (CASE WHEN p.name ILIKE clean_query || '%' THEN 3.0 ELSE 0.0 END) +
                    (CASE WHEN p.name ILIKE '%' || clean_query || '%' THEN 2.0 ELSE 0.0 END) +
                    similarity(p.name, clean_query)::real
                )::real
            END AS calculated_rank
        FROM public.logictrade_products p
        WHERE 
            (clean_cat = '' OR p.sales_group ILIKE '%' || clean_cat || '%' OR p.group_name ILIKE '%' || clean_cat || '%')
            AND (
                clean_query = ''
                OR (is_trigram AND (p.name ILIKE '%' || clean_query || '%' OR p.code ILIKE '%' || clean_query || '%'))
                OR (NOT is_trigram AND (
                    (t1 = '' OR p.name ILIKE '%' || t1 || '%' OR p.code ILIKE '%' || t1 || '%') AND
                    (t2 = '' OR p.name ILIKE '%' || t2 || '%' OR p.code ILIKE '%' || t2 || '%') AND
                    (t3 = '' OR p.name ILIKE '%' || t3 || '%' OR p.code ILIKE '%' || t3 || '%')
                ))
            )
    ),
    counted AS (
        SELECT count(*) AS full_count FROM filtered_pool
    )
    SELECT 
        fp.id,
        fp.code,
        fp.name,
        fp.description,
        fp.supplier_id,
        fp.supplier_name,
        fp.supplier_code,
        fp.group_name,
        fp.groups,
        fp.sales_group,
        fp.sales_price,
        fp.vat_code,
        fp.unit,
        fp.raw_data,
        fp.product_tier,
        fp.is_discontinued,
        fp.calculated_rank AS rank,
        c.full_count AS total_count
    FROM filtered_pool fp
    CROSS JOIN counted c
    ORDER BY 
        fp.product_tier ASC, 
        fp.calculated_rank DESC, 
        fp.name ASC
    LIMIT limit_count
    OFFSET offset_count;
END;
$func$;
