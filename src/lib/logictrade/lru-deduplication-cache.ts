/**
 * Begrensde In-Memory LRU Deduplicatie Cache voor continue delta sync.
 * Voorkomt de 60x redundante fetch storm binnen het sliding overlap venster
 * door ongewijzigde orders/offertes op header-niveau direct over te slaan.
 * Garandeert 0 geheugenlekken via hard capaciteitsplafond (maxSize) en actieve sweeps.
 */

export interface CacheEntry {
  modifiedDate: string;
  expiresAt: number;
}

export class LRUDeduplicationCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 5000, ttlMs = 120000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  has(id: string | number, modifiedDate: string): boolean {
    const key = String(id);
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    if (entry.modifiedDate === modifiedDate) {
      // MRU vernieuwing bij geldige match: bevorder naar de staart van de Map
      this.cache.delete(key);
      this.cache.set(key, entry);
      return true;
    }

    return false;
  }

  set(id: string | number, modifiedDate: string): void {
    const key = String(id);

    // Verwijder bestaande key zodat invoeging gegarandeerd als MRU naar de staart gaat
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, {
      modifiedDate,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  pruneExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        purged++;
      }
    }
    return purged;
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}
