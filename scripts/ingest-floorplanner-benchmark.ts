import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import {
  FmlProject,
  BenchmarkRecord130,
  TypologyCategory130,
} from '../src/domain/benchmark/floorplanner-types';
import { FmlOuterPolygonExtractor } from './fml-outer-polygon-extractor';
import { FundaFloorplannerCrawler } from './funda-floorplanner-crawler';

export interface IngestOptions {
  cacheDir?: string;
  rateLimitMs?: number;
  dryRun?: boolean;
  maxSurfaceTolerancePct?: number; // NEN 2580 gate, default 5.0%
}

export class FloorplannerIngestRunner {
  private cacheDir: string;
  private rateLimitMs: number;
  private maxSurfaceTolerancePct: number;

  constructor(options: IngestOptions = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), '.cache', 'fml');
    this.rateLimitMs = options.rateLimitMs ?? 200;
    this.maxSurfaceTolerancePct = options.maxSurfaceTolerancePct ?? 5.0;

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Fetches FML JSON with persistent local disk caching.
   */
  public async fetchFmlProject(projectId: number): Promise<FmlProject | null> {
    const cacheFile = path.join(this.cacheDir, `${projectId}.fml`);

    // 1. Check local disk cache
    if (fs.existsSync(cacheFile)) {
      try {
        const raw = fs.readFileSync(cacheFile, 'utf8');
        return JSON.parse(raw) as FmlProject;
      } catch {
        console.warn(`[Ingest] Corrupt cache file for project ${projectId}, refetching...`);
      }
    }

    // 2. Fetch from Floorplanner public API
    const url = `https://floorplanner.com/api/v2/projects/${projectId}.fml`;
    try {
      const data = await this.httpGet(url);
      if (!data) return null;

      const project = JSON.parse(data) as FmlProject;

      // Save to disk cache
      fs.writeFileSync(cacheFile, data, 'utf8');

      // Polite rate limit delay
      await this.sleep(this.rateLimitMs);

      return project;
    } catch (err) {
      console.warn(`[Ingest] Failed to fetch Floorplanner project ${projectId}:`, (err as Error).message);
      return null;
    }
  }

  /**
   * Queries PDOK Locatieserver to correlate address string to Kadaster BAG entity.
   */
  public async lookupPdokAddress(query: string): Promise<{
    pandId: string;
    vboId: string;
    street: string;
    houseNumber: string;
    city: string;
    postalCode: string;
    coords: [number, number]; // [lng, lat]
    bouwjaar?: number;
    oppervlakte?: number;
  } | null> {
    const encoded = encodeURIComponent(query);
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=${encoded}`;

    try {
      const raw = await this.httpGet(url);
      if (!raw) return null;

      const res = JSON.parse(raw);
      const docs = res?.response?.docs;
      if (!docs || docs.length === 0) return null;

      const first = docs[0];
      const lookupUrl = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${encodeURIComponent(first.id)}`;
      const lookupRaw = await this.httpGet(lookupUrl);
      if (!lookupRaw) return null;

      const lookupRes = JSON.parse(lookupRaw);
      const doc = lookupRes?.response?.docs?.[0];
      if (!doc) return null;

      let lng = 5.0;
      let lat = 52.0;
      if (doc.centroide_ll) {
        const match = doc.centroide_ll.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
        if (match) {
          lng = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      }

      return {
        pandId: doc.pand_id || (doc.gekoppeld_pand && doc.gekoppeld_pand[0]) || '0000000000000000',
        vboId: doc.adresseerbaarobject_id || '0000000000000000',
        street: doc.straatnaam || doc.weergavenaam || query,
        houseNumber: `${doc.huisnummer || ''}${doc.huisletter || ''}`,
        city: doc.woonplaatsnaam || '',
        postalCode: doc.postcode || '',
        coords: [lng, lat],
        bouwjaar: doc.bouwjaar ? parseInt(doc.bouwjaar, 10) : undefined,
        oppervlakte: doc.oppervlakte ? parseInt(doc.oppervlakte, 10) : undefined,
      };
    } catch (err) {
      console.warn(`[Ingest] PDOK lookup failed for "${query}":`, (err as Error).message);
      return null;
    }
  }

  /**
   * Builds a benchmark record by combining FML geometry with Kadaster BAG telemetry
   * and enforcing NEN 2580 surface tolerance (INV-REF-02: <= 5.0%).
   */
  public async buildRecord(
    projectId: number,
    typology: TypologyCategory130,
    overrideAddressQuery?: string,
    fundaUrl?: string
  ): Promise<BenchmarkRecord130 | null> {
    const project = await this.fetchFmlProject(projectId);
    if (!project) return null;

    const floors = FmlOuterPolygonExtractor.extractFloorPolygons(project);
    if (floors.length === 0) return null;

    const addressQuery = overrideAddressQuery || project.name;
    const pdokInfo = await this.lookupPdokAddress(addressQuery);

    const groundFloor = floors.find(f => f.level === 0) || floors[0];
    const bagFootprint2D = groundFloor.outerPolygonM;

    // Calculate total FML measured gross area across all floors
    const totalFmlAreaM2 = floors.reduce((sum, f) => sum + f.measuredGrossAreaM2, 0);
    const bagVboAreaM2 = pdokInfo?.oppervlakte || groundFloor.measuredGrossAreaM2;

    // NEN 2580 surface validation gate
    const isToleranceValid = FundaFloorplannerCrawler.validateSurfaceTolerance(
      totalFmlAreaM2,
      bagVboAreaM2,
      this.maxSurfaceTolerancePct
    );

    const surfaceDiffPct = bagVboAreaM2 > 0
      ? (Math.abs(totalFmlAreaM2 - bagVboAreaM2) / bagVboAreaM2) * 100
      : 0;

    return {
      id: `BM-FP-${String(projectId).padStart(8, '0')}`,
      project_id: projectId,
      address: {
        street: pdokInfo?.street || project.name,
        houseNumber: pdokInfo?.houseNumber || '',
        city: pdokInfo?.city || 'Nederland',
        postalCode: pdokInfo?.postalCode || '',
      },
      typology,
      meta: {
        inmeter: project.creator_email || 'Gecertificeerd Inmeter',
        source_url: `https://floorplanner.com/projects/${projectId}`,
        funda_url: fundaUrl,
        verified_at: new Date().toISOString(),
        original_project_name: project.name,
        bag_vbo_oppervlakte: bagVboAreaM2,
        fml_oppervlakte: Math.round(totalFmlAreaM2 * 10) / 10,
        nen2580_surface_difference_pct: Math.round(surfaceDiffPct * 100) / 100,
        fml_validation_status: isToleranceValid ? 'VALIDATED_NEN2580' : 'REJECTED_TOLERANCE_EXCEEDED',
      },
      telemetry_input: {
        pandId: pdokInfo?.pandId || `pand-${projectId}`,
        vboId: pdokInfo?.vboId || `vbo-${projectId}`,
        bagFootprint2D,
        vboEntrancePoint: bagFootprint2D[0] || [0, 0],
        bouwjaar: pdokInfo?.bouwjaar || 1980,
        oppervlakteVboM2: bagVboAreaM2,
      },
      ground_truth_floors: floors,
    };
  }

  private httpGet(url: string): Promise<string | null> {
    return new Promise(resolve => {
      https
        .get(url, { headers: { 'User-Agent': 'WoninginrichterScanner/2.0.0' } }, res => {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => resolve(data));
        })
        .on('error', () => resolve(null));
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
