-- Migration: 20261110_01_create_taxonomy_tables.sql
-- Description: Master Taxonomie SSOT (32 Productgroepen + 9.9 UNCLASSIFIED), 3NF Relatie-View & Batch RPC

-- Stap A: Lookup-tabellen voor categorieën en productgroepen
CREATE TABLE IF NOT EXISTS public.categories (
    id INT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_groups (
    code TEXT PRIMARY KEY,
    category_id INT NOT NULL REFERENCES public.categories(id),
    name TEXT NOT NULL,
    default_uom TEXT NOT NULL DEFAULT 'stuks',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS & Policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read categories' AND tablename = 'categories') THEN
        CREATE POLICY "Allow public read categories" ON public.categories FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service_role write categories' AND tablename = 'categories') THEN
        CREATE POLICY "Allow service_role write categories" ON public.categories FOR ALL TO service_role USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read product_groups' AND tablename = 'product_groups') THEN
        CREATE POLICY "Allow public read product_groups" ON public.product_groups FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow service_role write product_groups' AND tablename = 'product_groups') THEN
        CREATE POLICY "Allow service_role write product_groups" ON public.product_groups FOR ALL TO service_role USING (true);
    END IF;
END $$;

-- Stap B: Seeden van alle 7 Categorieën en 33 Productgroepen
INSERT INTO public.categories (id, name, code)
VALUES
    (1, 'Raambekleding Stof', 'raambekleding_stof'),
    (2, 'Raambekleding Hard', 'raambekleding_hard'),
    (3, 'Vloeren & Afwerking', 'vloeren_afwerking'),
    (4, 'Wandafwerking', 'wandafwerking'),
    (5, 'Buiten & Zonwering', 'buiten_zonwering'),
    (6, 'Diensten & Arbeid', 'diensten_arbeid'),
    (9, 'Onbekend / Fallback', 'onbekend_fallback')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code;

INSERT INTO public.product_groups (code, category_id, name, default_uom)
VALUES
    -- Categorie 1: Raambekleding Stof
    ('1.1', 1, 'Gordijnen & Vitrages', 'm1'),
    ('1.2', 1, 'Vouwgordijnen', 'stuks'),
    ('1.3', 1, 'Paneelgordijnen', 'stuks'),
    ('1.4', 1, 'Rails & Roedes', 'm1'),
    -- Categorie 2: Raambekleding Hard
    ('2.1', 2, 'Rolgordijnen & Duo', 'stuks'),
    ('2.2', 2, 'Jaloezieën Hout / Bamboe', 'stuks'),
    ('2.3', 2, 'Jaloezieën Aluminium', 'stuks'),
    ('2.4', 2, 'Plissés & Duettes', 'stuks'),
    -- Categorie 3: Vloeren & Afwerking
    ('3.1', 3, 'Click PVC', 'm2'),
    ('3.2', 3, 'Dryback PVC (Plak)', 'm2'),
    ('3.3', 3, 'Visgraat & Patroon PVC', 'm2'),
    ('3.4', 3, 'Laminaat & Parket', 'm2'),
    ('3.5', 3, 'Tapijt & Karpetten', 'm2'),
    ('3.6', 3, 'Egaline, Lijm & Egalisatie', 'kg'),
    ('3.7', 3, 'Ondervloeren', 'm2'),
    ('3.8', 3, 'Plinten & Profielen', 'm1'),
    -- Categorie 4: Wandafwerking
    ('4.1', 4, 'Behang & Renovlies', 'rollen'),
    ('4.2', 4, 'Wandpanelen & Akoestiek', 'stuks'),
    ('4.3', 4, 'Verf & Stucmaterialen', 'liters'),
    -- Categorie 5: Buiten & Zonwering
    ('5.1', 5, 'Screens & Zipscreens', 'stuks'),
    ('5.2', 5, 'Knikarmschermen', 'stuks'),
    ('5.3', 5, 'Rolluiken Buiten', 'stuks'),
    ('5.4', 5, 'Lamellendaken & Overkapping', 'stuks'),
    -- Categorie 6: Diensten & Arbeid (Harmonisatie met SERVICE_DISCIPLINE_TO_PRODUCT_GROUP)
    ('6.1', 6, 'Gordijn & Rail Montage', 'm1'),
    ('6.2', 6, 'Binnenzonwering Montage', 'stuks'),
    ('6.3', 6, 'Vloer Legservice', 'm2'),
    ('6.4', 6, 'Trapstoffering Montage', 'treden'),
    ('6.5', 6, 'Buitenzonwering Montage', 'stuks'),
    ('6.6', 6, 'Inmeet & Schouw Service', 'stuks'),
    ('6.7', 6, 'Sloop, Egalisatie & Voorbereiding', 'm2'),
    ('6.8', 6, 'Logistiek & Materieel Service', 'stuks'),
    ('6.9', 6, 'Overige Diensten & Maatwerk', 'stuks'),
    -- Categorie 9: Fallback
    ('9.9', 9, 'Niet geclassificeerd', 'stuks')
ON CONFLICT (code) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    default_uom = EXCLUDED.default_uom;

-- Stap C: Producten-tabel uitbreiden met FK naar product_groups
ALTER TABLE public.logictrade_products
    ADD COLUMN IF NOT EXISTS product_group_code TEXT NOT NULL DEFAULT '9.9' REFERENCES public.product_groups(code);

CREATE INDEX IF NOT EXISTS idx_logictrade_products_group
    ON public.logictrade_products (product_group_code);

-- Stap D: SSOT Relatie-View (3NF zonder denormalisatie-pleister)
CREATE OR REPLACE VIEW public.v_products_with_taxonomy AS
SELECT
    p.*,
    pg.name AS product_group_name,
    pg.default_uom AS product_group_uom,
    c.id AS category_id,
    c.name AS category_name,
    c.code AS category_code
FROM public.logictrade_products p
JOIN public.product_groups pg ON p.product_group_code = pg.code
JOIN public.categories c ON pg.category_id = c.id;

-- Stap E: Keyset Checkpoint veld toevoegen aan sync_state
ALTER TABLE public.logictrade_sync_state
    ADD COLUMN IF NOT EXISTS last_processed_id BIGINT;

-- Stap F: Dedicated Stored Procedure voor PostgREST Keyset Batch Updates
CREATE OR REPLACE FUNCTION public.batch_update_product_taxonomies(p_batch jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.logictrade_products AS p
    SET product_group_code = b.product_group_code
    FROM jsonb_to_recordset(p_batch) AS b(id bigint, product_group_code text)
    WHERE p.id = b.id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_update_product_taxonomies(jsonb) TO anon, authenticated, service_role;
