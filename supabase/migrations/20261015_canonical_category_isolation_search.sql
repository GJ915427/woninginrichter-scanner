-- Migration: 20261015_canonical_category_isolation_search.sql
-- Description: Canonical Universal Category Isolation & Multi-Facet Venn Search Engine

-- 1. Canonieke categorie-functie (IMMUTABLE, 100% pariteit met ConclaafRulesEngine.determineProductCategory)
CREATE OR REPLACE FUNCTION public.compute_logictrade_product_category(
  p_sales_group text,
  p_groups text[],
  p_supplier_name text,
  p_name text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  sg text := lower(coalesce(p_sales_group, '') || ' ' || array_to_string(coalesce(p_groups, ARRAY[]::text[]), ' '));
  sup text := lower(coalesce(p_supplier_name, ''));
  nm text := lower(coalesce(p_name, ''));
  combined text := sg || ' ' || sup || ' ' || nm;
BEGIN
  -- 1. Expliciete verkoopgroep of leverancier voor Vloeren (vóór artikelnaam zodat Interfloor Duette vloeren blijft)
  IF sg ~ '(vloer|tapijt|carpet|karpet|parket|laminaat|pvc|vinyl|linoleum|marmoleum|ondervloer|plint|deurmat|schoonloop|droogloop|kunstgras)'
     OR sup ~ '(interfloor|dersimo|tarkett|forbo|mflor|moduleo|quick-step|quickstep|ambiant|parador|coretec|belakos|desso|parade|bonaparte|nouwens|boca|gelasta|thomsit|eurocol|uzin|estillon|jumpax)' THEN
    RETURN 'vloeren';
  END IF;

  -- 2. Expliciete verkoopgroep voor Raamdecoratie (inclusief rolgordijn & vouwgordijn vóór generiek 'gordijn')
  IF sg ~ '(raamdecoratie|zonwering|horren|\mhor\M|jaloezie|pliss|duette|rolgordijn|vouwgordijn|lamel|shutter|multishade|twist|screen|markies|uitvalscherm|knikarmscherm|rolluik)'
     OR sup ~ '(luxaflex|sunway|verosol|jasno|bece|b&c|copa|keje|unilux|aurora|zonnelux|multisol|toppoint|erfal|velux)' THEN
    RETURN 'raamdecoratie';
  END IF;

  -- 3. Expliciete verkoopgroep of leverancier voor Gordijnen
  IF sg ~ '(gordijn|inbetween|vitrage|overgordijn|confectie|wave|plooi|vouwgordijnstof)'
     OR sup ~ '(kobe|vadain|de ploeg|ploeg|kendix|eijffinger|artelux|ado|lethem|aroman|holland haag|hollandhaag|interstil|goelst|forest|vriesco|a house of happiness)' THEN
    RETURN 'gordijnen';
  END IF;

  -- 4. Fallback op artikelnaam (exact zoals ConclaafRulesEngine.determineProductCategory stap 2)
  IF combined ~ '(tapijt|karpet|parket|laminaat|pvc|vinyl|linoleum|marmoleum|ondervloer|plint|deurmat|schoonloop|droogloop)'
     OR (combined ~ 'vloer' AND combined !~ 'vloerlamp') THEN
    RETURN 'vloeren';
  END IF;

  IF combined ~ '(raamdecoratie|zonwering|\m(hor|horren)\M|jaloezie|pliss|duette|rolgordijn|vouwgordijn|lamel|shutter|multishade|twist|velux|luxaflex)' THEN
    RETURN 'raamdecoratie';
  END IF;

  IF combined ~ '(gordijn|inbetween|vitrage|overgordijn|vloerbedekking_gordijn)'
     AND combined !~ '(meubel|bank|stoel|fauteuil|tafel|kast|bed|matras|rolgordijn|vouwgordijn|pliss|duette|jaloezie|lamel|shutter|multishade|twist)' THEN
    RETURN 'gordijnen';
  END IF;

  RETURN 'algemeen';
END;
$$;

-- 2. Universele Venn-Token Helper: O(1) gecachete string/regex evaluatie per rij (IMMUTABLE)
CREATE OR REPLACE FUNCTION public.token_matches_product_venn(
  p_token text,
  p_hay text,
  p_eff_category text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  -- A. Directe tekstmatch in eigen artikelvelden (naam, code, leverancier, verkoopgroep, groepen, beschrijving)
  IF position(p_token IN p_hay) > 0 THEN
    RETURN true;
  END IF;

  -- B. Typo-stammen voor productfamilies ('deut' -> 'duet', 'plisse'/'plis' -> 'pliss')
  IF p_token IN ('deut', 'duet') AND position('duet' IN p_hay) > 0 THEN
    RETURN true;
  END IF;
  IF p_token IN ('plis', 'pliss', 'plisse') AND position('pliss' IN p_hay) > 0 THEN
    RETURN true;
  END IF;

  -- C. Duette / Plissé modelcodes & vorm-codes: ALLEEN gekoppeld aan raamdecoratie met Duette/Plissé
  IF p_eff_category = 'raamdecoratie'
     AND p_hay ~ '(duette|pliss)'
     AND p_token ~ '^(au10|au20|au30|ab21|db42|vs2|ae10|ae20|ae30|af10|af20|af30|as10|as20|as30|ua20|ea20|fa20|sa20|au1|au2|au3|ae1|ae2|ae3|af1|af2|af3|as1|as2|as3|:?10|:?20|:?30)$' THEN
    RETURN true;
  END IF;

  -- D. Gekoppelde configuratieopties voor 'raamdecoratie' (inclusief 'cor' en 'view')
  IF p_eff_category = 'raamdecoratie' AND p_token ~ '^(trufit|trufi|truf|tru|fit|klemsteunen|klemsteun|klemst|klem|draai|kiepraam|kiep|raam|inzetten|montage|smartcord|smartco|smartc|smart|cord|cor|koord|koordbediening|powerview|powerv|power|view|motor|motorbediening|elektrisch|accu|batterij|batterijpack|230v|netstroom|bekabeld|handgreep|handgreepbediening|literise|liter|ingespannen|ketting|kettin|eindloos|topdown|bottomup|top|down|bottom|standaard|vrijhangend|dag|nacht|antraciet|zwart|wit|zilver|aluminium|geanodiseerd|profielkleur|profiel|plakprofiel|plak|glas|boren|ral|7016|9016|9005|verduisterend|verduist|blackout|lichtdoorlatend|transparant|elan|stans|architella|archit|bovenbak|bediening|links|rechts|blijvende|dagmaat|maakmaat|chalk|white|soft|sand|cream|pebble|night)$' THEN
    RETURN true;
  END IF;

  -- E. Gekoppelde configuratieopties voor 'gordijnen'
  IF p_eff_category = 'gordijnen' AND p_token ~ '^(wave|plooi|plooisoort|enkele|dubbele|vlinderplooi|vlinder|retourplooi|retour|loodveter|zoom|onderzoom|middensluiting|stel|links|rechts|pakket|opening)$' THEN
    RETURN true;
  END IF;

  -- F. Gekoppelde configuratieopties voor 'vloeren'
  IF p_eff_category = 'vloeren' AND p_token ~ '^(recht|visgraat|diagonaal|snijverlies|zwevend|ondervloer|verlijmd|lijm|legwijze|plinten|plint|mdf|plakplinten|plakplint)$' THEN
    RETURN true;
  END IF;

  -- G. Gekoppelde configuratieopties voor 'algemeen'
  IF p_eff_category = 'algemeen' AND p_token ~ '^(maatwerk|staaluitvoering|uitpakken|monteren|uitvoering|montage)$' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_logictrade_products_salesgroup_trgm ON public.logictrade_products USING gin (sales_group gin_trgm_ops);

-- 3. Canonieke 4-parameter Venn-Diagram RPC (exact 16-koloms FtsProductRow return-contract)
CREATE OR REPLACE FUNCTION public.search_logictrade_products_universal(
  search_query text,
  category_filter text DEFAULT NULL,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  code text,
  name text,
  description text,
  supplier_id bigint,
  supplier_name text,
  supplier_code text,
  group_name text,
  groups text[],
  sales_group text,
  sales_price numeric,
  vat_code text,
  unit text,
  raw_data jsonb,
  rank real,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  clean_query text;
  norm_cat text;
  tokens text[];
  anchor_patterns text[];
  loop_tok text;
BEGIN
  clean_query := trim(regexp_replace(coalesce(search_query, ''), '\s+', ' ', 'g'));
  norm_cat := nullif(lower(trim(coalesce(category_filter, ''))), '');

  IF clean_query = '' THEN
    RETURN QUERY
    SELECT
      p.id, p.code, p.name, p.description, p.supplier_id, p.supplier_name, p.supplier_code,
      p.group_name, p.groups, p.sales_group, p.sales_price, p.vat_code, p.unit, p.raw_data,
      1.0::real AS rank,
      count(*) OVER () AS total_count
    FROM public.logictrade_products p
    ORDER BY p.name ASC
    LIMIT limit_count OFFSET offset_count;
    RETURN;
  END IF;

  tokens := regexp_split_to_array(lower(clean_query), '\s+');
  
  -- Bouw geïndexeerde anker-patronen voor bitmap index scan vóór Venn-evaluatie
  anchor_patterns := ARRAY[]::text[];
  FOREACH loop_tok IN ARRAY tokens LOOP
    IF loop_tok ~ '^(au10|au20|au30|ab21|db42|vs2|ae10|ae20|ae30|af10|af20|af30|as10|as20|as30|ua20|ea20|fa20|sa20|au1|au2|au3|ae1|ae2|ae3|af1|af2|af3|as1|as2|as3|:?10|:?20|:?30)$' THEN
      anchor_patterns := array_append(anchor_patterns, '%duette%');
      anchor_patterns := array_append(anchor_patterns, '%pliss%');
    ELSIF loop_tok ~ '^(trufit|smartcord|powerview|literise)$' THEN
      anchor_patterns := array_append(anchor_patterns, '%duette%');
      anchor_patterns := array_append(anchor_patterns, '%pliss%');
    ELSIF length(loop_tok) >= 2 THEN
      anchor_patterns := array_append(anchor_patterns, '%' || loop_tok || '%');
    END IF;
  END LOOP;

  IF array_length(anchor_patterns, 1) IS NULL THEN
    anchor_patterns := ARRAY['%duette%', '%pliss%'];
  END IF;

  RETURN QUERY
  WITH candidates AS (
    -- Snelle Bitmap Index Scan via GIN trigrams (sub-10ms)
    SELECT p.*
    FROM public.logictrade_products p
    WHERE (
      p.name ~~* ANY (anchor_patterns)
      OR p.code ~~* ANY (anchor_patterns)
      OR p.supplier_name ~~* ANY (anchor_patterns)
      OR (p.sales_group IS NOT NULL AND p.sales_group ~~* ANY (anchor_patterns))
    )
  ),
  annotated AS (
    SELECT
      c.id,
      c.code,
      c.name,
      c.description,
      c.supplier_id,
      c.supplier_name,
      c.supplier_code,
      c.group_name,
      c.groups,
      c.sales_group,
      c.sales_price,
      c.vat_code,
      c.unit,
      c.raw_data,
      c.fts_tokens,
      public.compute_logictrade_product_category(
        c.sales_group,
        c.groups,
        c.supplier_name,
        c.name
      ) AS eff_category,
      (
        CASE
          -- Tier 5: Uitlopende collecties (-200)
          WHEN (coalesce(c.name, '') ~* '(uitlopende?\s+collectie|\muitlopend\M)'
                OR coalesce(c.description, '') ~* '(uitlopende?\s+collectie|\muitlopend\M)') THEN -200.0::real
          -- Tier 4: Monsters, Stalen, Collectieboeken (-80)
          WHEN coalesce(c.name, '') ~* '\m(staal|stalen|service|monster|collectieboek|prijsklasse)\M' THEN -80.0::real
          -- Tier 3: Accessoires & Onderdelen (+10)
          WHEN coalesce(c.name, '') ~* '\m(bedieningsstang|stang|stangen|klemsteun|klemsteunen|steun|steunen|onderdeel|onderdelen|reparatieset)\M' THEN 10.0::real
          -- Tier 2: Specifieke Productvarianten (+50)
          WHEN coalesce(c.name, '') ~* '\m(dakraam|combi)\M' THEN 50.0::real
          -- Tier 1: Configureerbare Hoofdproducten zoals Duette® shade (+100)
          ELSE 100.0::real
        END
      ) AS tier_boost,
      lower(
        coalesce(c.name, '') || ' ' ||
        coalesce(c.code, '') || ' ' ||
        coalesce(c.supplier_name, '') || ' ' ||
        coalesce(c.sales_group, '') || ' ' ||
        coalesce(c.group_name, '') || ' ' ||
        array_to_string(coalesce(c.groups, ARRAY[]::text[]), ' ') || ' ' ||
        coalesce(c.description, '')
      ) AS hay
    FROM candidates c
  ),
  venn_filtered AS (
    -- Strikte, commutatieve Venn-Diagram Doorsnede vóór LIMIT:
    -- Elk zoektoken tok MOET matchen op het artikel (via eigen tekst OF via categorie-gekoppelde optie/modelcode)
    SELECT a.*
    FROM annotated a
    WHERE (norm_cat IS NULL OR a.eff_category = norm_cat)
      AND (
        SELECT bool_and(public.token_matches_product_venn(tok, a.hay, a.eff_category))
        FROM unnest(tokens) AS tok
      )
  ),
  top_candidates AS (
    -- Begrens de exacte Venn-matches geordend op Relevance Pyramid (Tier 1 bovenaan) vóór trigram-scoring
    SELECT vf.*
    FROM venn_filtered vf
    ORDER BY
      vf.tier_boost DESC,
      CASE
        WHEN lower(coalesce(vf.code, '')) = lower(clean_query) THEN 3
        WHEN lower(coalesce(vf.name, '')) = lower(clean_query) THEN 2
        WHEN lower(coalesce(vf.name, '')) LIKE lower(clean_query) || '%' THEN 1
        ELSE 0
      END DESC,
      vf.name ASC
    LIMIT 600
  ),
  scored AS (
    SELECT
      tc.id,
      tc.code,
      tc.name,
      tc.description,
      tc.supplier_id,
      tc.supplier_name,
      tc.supplier_code,
      tc.group_name,
      tc.groups,
      tc.sales_group,
      tc.sales_price,
      tc.vat_code,
      tc.unit,
      tc.raw_data,
      (
        tc.tier_boost +
        CASE
          WHEN lower(coalesce(tc.code, '')) = lower(clean_query) THEN 150.0::real
          WHEN lower(coalesce(tc.name, '')) = lower(clean_query) THEN 120.0::real
          WHEN coalesce(tc.name, '') ILIKE (clean_query || '%') THEN 50.0::real
          ELSE 0.0::real
        END +
        CASE WHEN tc.hay ~ '(duette|pliss)' THEN 25.0::real ELSE 0.0::real END +
        CASE WHEN ts_query IS NOT NULL AND tc.fts_tokens @@ ts_query
             THEN (ts_rank_cd(tc.fts_tokens, ts_query) * 40.0)::real
             ELSE 0.0::real
        END +
        (public.word_similarity(clean_query, coalesce(tc.name, '')) * 20.0)::real +
        (public.word_similarity(clean_query, coalesce(tc.supplier_name, '')) * 10.0)::real
      )::real AS computed_rank,
      count(*) OVER () AS total_rows
    FROM top_candidates tc
  )
  SELECT
    s.id,
    s.code,
    s.name,
    s.description,
    s.supplier_id,
    s.supplier_name,
    s.supplier_code,
    s.group_name,
    s.groups,
    s.sales_group,
    s.sales_price,
    s.vat_code,
    s.unit,
    s.raw_data,
    s.computed_rank AS rank,
    s.total_rows AS total_count
  FROM scored s
  ORDER BY
    s.computed_rank DESC,
    s.name ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 4. Herdefinieer de 3-parameter wrapper search_logictrade_products zodat die naar de nieuwe 4-parameter functie verwijst
CREATE OR REPLACE FUNCTION public.search_logictrade_products(
  search_query text,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  code text,
  name text,
  description text,
  supplier_id bigint,
  supplier_name text,
  supplier_code text,
  group_name text,
  groups text[],
  sales_group text,
  sales_price numeric,
  vat_code text,
  unit text,
  raw_data jsonb,
  rank real,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.search_logictrade_products_universal(search_query, NULL::text, limit_count, offset_count);
$$;

-- 5. Nu search_logictrade_products niet meer afhangt van de 3-parameter overload, kan deze veilig worden gedropt
DROP FUNCTION IF EXISTS public.search_logictrade_products_universal(text, integer, integer);

GRANT EXECUTE ON FUNCTION public.search_logictrade_products_universal(text, text, integer, integer)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_logictrade_products(text, integer, integer)
  TO anon, authenticated, service_role;
