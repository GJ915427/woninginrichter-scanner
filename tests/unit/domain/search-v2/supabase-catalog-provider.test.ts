import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  SupabaseCatalogProvider 
} from '@/domain/search/v2/supabase-catalog-provider';
import { 
  resolveDomainCategory, 
  resolveItemRole, 
  resolveEntityType, 
  resolveBaselinePrice, 
  mapFtsRowToCanonicalProduct,
  DUETTE_CAPABILITIES,
  PLISSE_CAPABILITIES
} from '@/domain/search/v2/capability-registry';
import * as supabaseClient from '@/lib/supabase/client';
import { FtsProductRow } from '@/lib/supabase/client';

describe('V2 Greenfield Search — capability-registry', () => {
  describe('Taxonomie & Domeinclassificatie', () => {
    it('geeft FLOOR_CATEGORY_REGEX absolute voorrang op naam-homoniemen zoals Duette tapijt', () => {
      const domain = resolveDomainCategory('Tapijt (nog te koppelen)', '400 Ab Duette Tapijt', 'Tapijt');
      expect(domain).toBe('VLOEREN');

      const role = resolveItemRole(domain, '400 Ab Duette Tapijt');
      expect(role).toBe('PRODUCT');

      const entity = resolveEntityType('400 Ab Duette Tapijt', domain, role);
      expect(entity).toBe('TAPIJT');
    });

    it('voorkomt dat marketingteksten ("vloer tot plafond") raambekleding corrumperen naar vloeren', () => {
      const description = 'Luxaflex Duette® shades zijn geschikt voor ramen van vloer tot plafond, inclusief aluminium profiel en wandsteunen';
      const domain = resolveDomainCategory('Raamdecoratie', 'Duette® shade', `Duette® shade ${description} Raamdecoratie`);
      expect(domain).toBe('RAAMBEKLEDING');

      const role = resolveItemRole(domain, 'Duette® shade');
      expect(role).toBe('PRODUCT');

      const entity = resolveEntityType('Duette® shade', domain, role);
      expect(entity).toBe('DUETTE_SHADE');
    });

    it('classificeert stalen services deterministisch als DIENSTEN / SERVICE (ID 228933)', () => {
      const domain = resolveDomainCategory('Raamdecoratie', 'Stalen service plissé shades', 'Stalen service plissé shades Raamdecoratie');
      expect(domain).toBe('DIENSTEN');

      const role = resolveItemRole(domain, 'Stalen service plissé shades');
      expect(role).toBe('SERVICE');

      const entity = resolveEntityType('Stalen service plissé shades', domain, role);
      expect(entity).toBe('SERVICE');

      const price = resolveBaselinePrice('A000061766', 0, entity, 'Stalen service plissé shades', role);
      expect(price).toBe(0.0);
    });

    it('classificeert accessoires en stalenboeken als ACCESSOIRES / ACCESSORY', () => {
      const domain = resolveDomainCategory('', 'Toebehoren Duette klemsteun', 'Toebehoren Duette klemsteun');
      expect(domain).toBe('ACCESSOIRES');

      const role = resolveItemRole(domain, 'Toebehoren Duette klemsteun');
      expect(role).toBe('ACCESSORY');

      const entity = resolveEntityType('Toebehoren Duette klemsteun', domain, role);
      expect(entity).toBe('KLEMSTEUN_ACCESSOIRE');

      const price = resolveBaselinePrice('ACC-KLEM-01', 0, entity, 'Toebehoren Duette klemsteun', role);
      expect(price).toBe(0.0);
    });

    it('onderscheidt insectenhorren strikt van horizontale jaloezieën en toebehoren', () => {
      const horDomain = resolveDomainCategory('Horren', 'Inzethor standaard', 'Inzethor');
      expect(horDomain).toBe('HORREN');

      const jaloDomain = resolveDomainCategory('Raamdecoratie', 'Horizontale Jaloezieën 25mm', 'Horizontale Jaloezieën 25mm');
      expect(jaloDomain).toBe('RAAMBEKLEDING');

      const toebehorDomain = resolveDomainCategory('Horren', 'Inzethor Toebehoren', 'Inzethor Toebehoren');
      expect(toebehorDomain).toBe('ACCESSOIRES');
    });
  });

  describe('mapFtsRowToCanonicalProduct mapping & enrichment', () => {
    it('verrijkt FTS rij ID 219609 met baseline adviesprijs € 861.02 en discrete DUETTE_CAPABILITIES', () => {
      const row: FtsProductRow = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette® shade',
        description: 'Vrijhangend model',
        sales_price: '0.00',
        sales_group: 'Raamdecoratie',
        supplier_name: 'Luxaflex',
        supplier_id: 101,
        groups: ['Koppelingen Raamdecoratie', 'Luxaflex', 'Duette® shade']
      };

      const product = mapFtsRowToCanonicalProduct(row);
      expect(product.id).toBe(219609);
      expect(product.code).toBe('A00052469');
      expect(product.salesPrice).toBe(861.02);
      expect(product.domain).toBe('RAAMBEKLEDING');
      expect(product.entityType).toBe('DUETTE_SHADE');
      expect(product.itemRole).toBe('PRODUCT');
      expect(product.capabilities).toEqual(DUETTE_CAPABILITIES);
      expect(product.groups).toEqual(['Koppelingen Raamdecoratie', 'Luxaflex', 'Duette® shade']);
      expect(product.synonyms).toContain('duettes');
      expect(product.isDiscontinued).toBe(false);
    });

    it('verrijkt Plissé shade met baseline adviesprijs € 420.00 en PLISSE_CAPABILITIES', () => {
      const row: FtsProductRow = {
        id: 219610,
        code: 'A00052470',
        name: 'Plissé® shade',
        sales_price: 0,
        sales_group: 'Raamdecoratie',
        supplier_name: 'Luxaflex',
        groups: ['Raamdecoratie', 'Plissé']
      };

      const product = mapFtsRowToCanonicalProduct(row);
      expect(product.salesPrice).toBe(420.00);
      expect(product.entityType).toBe('PLISSE_SHADE');
      expect(product.capabilities).toEqual(PLISSE_CAPABILITIES);
      expect(product.synonyms).toContain('plisses');
    });

    it('detecteert uitlopende artikelen via "Uitlopende collectie" in de beschrijving', () => {
      const row: FtsProductRow = {
        id: 147226,
        code: 'A00042582',
        name: 'Dakraam Duette® shade',
        description: 'Uitlopende collectie dakraam shade',
        sales_price: 150.00,
        sales_group: 'Raamdecoratie'
      };

      const product = mapFtsRowToCanonicalProduct(row);
      expect(product.isDiscontinued).toBe(true);
    });
  });
});

describe('V2 Greenfield Search — SupabaseCatalogProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('delegeert zoekquery direct naar searchProductsUniversal en transformeert kandidaten', async () => {
    const mockRows: FtsProductRow[] = [
      {
        id: 219609,
        code: 'A00052469',
        name: 'Duette® shade',
        sales_price: 0,
        sales_group: 'Raamdecoratie',
        supplier_name: 'Luxaflex'
      }
    ];

    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    const searchSpy = vi.spyOn(supabaseClient, 'searchProductsUniversal').mockResolvedValue({
      rows: mockRows,
      totalCount: 1
    });

    const provider = new SupabaseCatalogProvider({ query: 'duette draai', candidateLimit: 50 });
    const catalog = await provider.getCatalog();

    expect(searchSpy).toHaveBeenCalledWith('duette draai', 50);
    expect(provider.getProviderMode()).toBe('supabase');
    expect(catalog.length).toBe(1);
    expect(catalog[0].id).toBe(219609);
    expect(catalog[0].salesPrice).toBe(861.02);
  });

  it('behoudt legitieme 0 zoekhits in mode "supabase" zonder onterechte fallback', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'searchProductsUniversal').mockResolvedValue({
      rows: [],
      totalCount: 0
    });

    const provider = new SupabaseCatalogProvider({ query: 'xyznonexistentproduct123' });
    const catalog = await provider.getCatalog();

    expect(provider.getProviderMode()).toBe('supabase');
    expect(catalog).toEqual([]);
  });

  it('schakelt transparant over naar InMemorySeedCatalogProvider bij netwerkfouten onder console.warn', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'searchProductsUniversal').mockRejectedValue(new Error('Network timeout'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const provider = new SupabaseCatalogProvider({ query: 'duette' });
    const catalog = await provider.getCatalog();

    expect(warnSpy).toHaveBeenCalled();
    expect(provider.getProviderMode()).toBe('seed_fallback');
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.some(p => p.code === 'A00052469')).toBe(true);
  });

  it('schakelt over naar seed fallback als Supabase niet geconfigureerd is', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(false);

    const provider = new SupabaseCatalogProvider({ query: 'duette' });
    const catalog = await provider.getCatalog();

    expect(provider.getProviderMode()).toBe('seed_fallback');
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('implementeert getProductById en findProducts conform CatalogProvider interface', async () => {
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'searchProductsUniversal').mockResolvedValue({
      rows: [
        {
          id: 52469,
          code: 'A00052469',
          name: 'Duette® shade',
          sales_price: 861.02,
          sales_group: 'Raamdecoratie'
        }
      ],
      totalCount: 1
    });

    const provider = new SupabaseCatalogProvider({ query: 'duette' });
    const item = await provider.getProductById(52469);
    expect(item).not.toBeNull();
    expect(item?.code).toBe('A00052469');

    const found = await provider.findProducts(p => p.salesPrice > 500);
    expect(found.length).toBe(1);
  });
});
