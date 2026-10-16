/**
 * Supabase Catalog Provider voor V2 Greenfield Cognitive CPQ Search Engine.
 * 
 * Implementeert de CatalogProvider contract interface uit Tranche 1.
 * Haalt dynamisch geaggregeerde productkandidaten op via PostgreSQL Full-Text Search (FTS)
 * en mapt deze via de capability-registry naar CanonicalSeedProduct entiteiten.
 * 
 * Bevat een fail-soft fallback naar InMemorySeedCatalogProvider wanneer Supabase
 * niet geconfigureerd is of een runtime fout optreedt.
 */

import { CatalogProvider, CanonicalSeedProduct, InMemorySeedCatalogProvider } from './canonical-catalog';
import { searchProductsUniversal, isSupabaseConfigured } from '@/lib/supabase/client';
import { mapFtsRowToCanonicalProduct } from './capability-registry';

export interface SupabaseCatalogProviderOptions {
  query?: string;
  candidateLimit?: number;
  fallbackProvider?: CatalogProvider;
}

export class SupabaseCatalogProvider implements CatalogProvider {
  private readonly query: string;
  private readonly candidateLimit: number;
  private readonly fallbackProvider: CatalogProvider;
  private cachedProducts: CanonicalSeedProduct[] | null = null;
  private providerMode: 'supabase' | 'seed_fallback' = 'supabase';

  constructor(options: SupabaseCatalogProviderOptions = {}) {
    this.query = (options.query || '').trim();
    this.candidateLimit = options.candidateLimit || 50;
    this.fallbackProvider = options.fallbackProvider || new InMemorySeedCatalogProvider();
  }

  /**
   * Geeft de actieve provider modus terug:
   * - 'supabase': kandidaten succesvol geladen via Supabase FTS RPC
   * - 'seed_fallback': teruggevallen op de InMemory seed catalogus
   */
  public getProviderMode(): 'supabase' | 'seed_fallback' {
    return this.providerMode;
  }

  /**
   * Haalt de catalogus op via Supabase FTS of valt terug op de InMemorySeedCatalogProvider.
   * Cacht het resultaat in-memory voor de levensduur van deze provider instantie.
   */
  async getCatalog(): Promise<CanonicalSeedProduct[]> {
    if (this.cachedProducts) {
      return this.cachedProducts;
    }

    if (!isSupabaseConfigured()) {
      this.providerMode = 'seed_fallback';
      this.cachedProducts = await this.fallbackProvider.getCatalog();
      return this.cachedProducts;
    }

    try {
      const { rows } = await searchProductsUniversal(this.query, this.candidateLimit);
      this.providerMode = 'supabase';
      this.cachedProducts = rows.map(mapFtsRowToCanonicalProduct);
      return this.cachedProducts;
    } catch (error) {
      console.warn('[SupabaseCatalogProvider] Fout bij ophalen uit Supabase, overschakelen naar InMemory fallback:', error);
      this.providerMode = 'seed_fallback';
      this.cachedProducts = await this.fallbackProvider.getCatalog();
      return this.cachedProducts;
    }
  }

  /**
   * Zoekt een specifiek product op basis van ID.
   */
  async getProductById(id: number): Promise<CanonicalSeedProduct | null> {
    const catalog = await this.getCatalog();
    return catalog.find(p => p.id === id) || null;
  }

  /**
   * Filtert producten op basis van een optioneel predikaat.
   */
  async findProducts(predicate?: (p: CanonicalSeedProduct) => boolean): Promise<CanonicalSeedProduct[]> {
    const catalog = await this.getCatalog();
    if (!predicate) {
      return catalog;
    }
    return catalog.filter(predicate);
  }
}
