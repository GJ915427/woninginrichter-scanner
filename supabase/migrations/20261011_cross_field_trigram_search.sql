-- ==============================================================================
-- Migratie: 20261011_cross_field_trigram_search.sql
-- Doel: Diamond-Grade Cross-Field Trigram Zoekmachine & Tiered Relevance Pyramid
-- SLA: Sub-3ms Bitmap Index Scan over 100.924 LogicTrade artikelen
-- ==============================================================================

-- 1. Activeer pg_trgm extensie indien nog niet actief
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN Trigram Indices op artikelnaam, artikelcode, leveranciersnaam en samengestelde document-expressie
CREATE INDEX IF NOT EXISTS idx_logictrade_products_name_trgm 
ON public.logictrade_products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_logictrade_products_code_trgm 
ON public.logictrade_products USING GIN (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_logictrade_products_supplier_trgm 
ON public.logictrade_products USING GIN (supplier_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_logictrade_products_universal_expr_trgm 
ON public.logictrade_products USING GIN (
    (coalesce(name, '') || ' ' || coalesce(supplier_name, '') || ' ' || coalesce(code, '')) gin_trgm_ops
);

-- 3. Universele Cross-Field Zoek RPC met Tiered Relevance Ranking & Pre-Limit Sorting
CREATE OR REPLACE FUNCTION public.search_logictrade_products_universal(
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
    clean_query TEXT := trim(coalesce(search_query, ''));
    raw_tokens TEXT[];
    t1 TEXT := '';
    t2 TEXT := '';
    t3 TEXT := '';
    t4 TEXT := '';
    t5 TEXT := '';
BEGIN
    IF clean_query = '' THEN
        RETURN QUERY
        SELECT p.id, p.code, p.name, p.description, p.supplier_id, p.supplier_name, p.supplier_code,
               p.group_name, p.groups, p.sales_group, p.sales_price, p.vat_code, p.unit, p.raw_data,
               1.0::REAL as rank,
               count(*) OVER() as total_count
        FROM public.logictrade_products p
        ORDER BY p.name ASC
        LIMIT limit_count OFFSET offset_count;
        RETURN;
    END IF;

    -- Tokenizeer de query (max 5 tokens voor indexable BitmapAnd optimalisatie)
    raw_tokens := string_to_array(lower(regexp_replace(clean_query, '\s+', ' ', 'g')), ' ');
    IF array_length(raw_tokens, 1) >= 1 THEN t1 := raw_tokens[1]; END IF;
    IF array_length(raw_tokens, 1) >= 2 THEN t2 := raw_tokens[2]; END IF;
    IF array_length(raw_tokens, 1) >= 3 THEN t3 := raw_tokens[3]; END IF;
    IF array_length(raw_tokens, 1) >= 4 THEN t4 := raw_tokens[4]; END IF;
    IF array_length(raw_tokens, 1) >= 5 THEN t5 := raw_tokens[5]; END IF;

    RETURN QUERY
    WITH matches AS (
        SELECT p.id, p.code, p.name, p.description, p.supplier_id, p.supplier_name, p.supplier_code,
               p.group_name, p.groups, p.sales_group, p.sales_price, p.vat_code, p.unit, p.raw_data,
               (
                   -- 1. Exacte code & naam match basispunten
                   CASE WHEN lower(p.code) = lower(clean_query) THEN 150.0::REAL
                        WHEN lower(p.name) = lower(clean_query) THEN 120.0::REAL
                        WHEN p.name ILIKE (clean_query || '%') THEN 50.0::REAL
                        ELSE 0.0::REAL
                   END +
                   -- 2. Tiered Relevance Pyramid (mutueel exclusieve laddering conform Grondwet Laag 1B)
                   CASE
                       -- Tier 5: Uitlopende collecties (-200)
                       WHEN (coalesce(p.name, '') ~* '(uitlopende?\s+collectie|\buitlopend\b)' OR coalesce(p.description, '') ~* '(uitlopende?\s+collectie|\buitlopend\b)') THEN -200.0::REAL
                       -- Tier 4: Monsters, Stalen, Collectieboeken (-80)
                       WHEN coalesce(p.name, '') ~* '\b(staal|stalen|service|monster|collectieboek|prijsklasse)\b' THEN -80.0::REAL
                       -- Tier 3: Accessoires & Onderdelen (+10)
                       WHEN coalesce(p.name, '') ~* '\b(bedieningsstang|stang|stangen|klemsteun|klemsteunen|steun|steunen|onderdeel|onderdelen|reparatieset)\b' THEN 10.0::REAL
                       -- Tier 2: Specifieke Productvarianten (+50)
                       WHEN coalesce(p.name, '') ~* '\b(dakraam|combi)\b' THEN 50.0::REAL
                       -- Tier 1: Configureerbare Hoofdproducten (+100)
                       ELSE 100.0::REAL
                   END +
                   -- 3. Trigram word similarity score op artikelnaam en leverancier
                   word_similarity(clean_query, coalesce(p.name, '')) * 20.0 +
                   word_similarity(clean_query, coalesce(p.supplier_name, '')) * 10.0
               )::REAL as calculated_rank
        FROM public.logictrade_products p
        WHERE
            -- Cross-Field Composite Trigram Evaluation via GIN Index (BitmapAnd)
            (t1 = '' OR (coalesce(p.name, '') || ' ' || coalesce(p.supplier_name, '') || ' ' || coalesce(p.code, '')) ILIKE ('%' || t1 || '%'))
            AND (t2 = '' OR (coalesce(p.name, '') || ' ' || coalesce(p.supplier_name, '') || ' ' || coalesce(p.code, '')) ILIKE ('%' || t2 || '%'))
            AND (t3 = '' OR (coalesce(p.name, '') || ' ' || coalesce(p.supplier_name, '') || ' ' || coalesce(p.code, '')) ILIKE ('%' || t3 || '%'))
            AND (t4 = '' OR (coalesce(p.name, '') || ' ' || coalesce(p.supplier_name, '') || ' ' || coalesce(p.code, '')) ILIKE ('%' || t4 || '%'))
            AND (t5 = '' OR (coalesce(p.name, '') || ' ' || coalesce(p.supplier_name, '') || ' ' || coalesce(p.code, '')) ILIKE ('%' || t5 || '%'))
    )
    SELECT m.id, m.code, m.name, m.description, m.supplier_id, m.supplier_name, m.supplier_code,
           m.group_name, m.groups, m.sales_group, m.sales_price, m.vat_code, m.unit, m.raw_data,
           m.calculated_rank as rank,
           count(*) OVER() as total_count
    FROM matches m
    ORDER BY m.calculated_rank DESC, m.name ASC
    LIMIT limit_count OFFSET offset_count;
END;
$func$;

-- 4. Backwards-compatible alias voor search_logictrade_products
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
LANGUAGE sql
AS $$
    SELECT * FROM public.search_logictrade_products_universal(search_query, limit_count, offset_count);
$$;
