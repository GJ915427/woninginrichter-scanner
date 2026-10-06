import { KadasterBagClient } from '@/data/bag/kadaster-bag-client';
import { ThreeDBagClient } from '@/data/cityjson/three-d-bag-client';
import { PdokBgtClient } from '@/data/bgt/pdok-bgt-client';
import { EpOnlineClient } from '@/data/ep-online/ep-online-client';
import { AhnElevationClient } from '@/data/ahn/ahn-elevation-client';
import { KadasterDkkClient } from '@/data/kadaster/kadaster-dkk-client';
import { RDNAPTransformer } from '@/domain/geometry/rd-nap-trans';
import { computeFloorGeometry } from '@/domain/legacy/floor-geometry-calculator';
import { PolygonSimilarityEngine } from '@/domain/geometry/polygon-similarity-engine';

export interface EvaluatedFloorResult {
  level: number;
  name: string;
  polygon: Array<[number, number]>;
  areaM2: number;
}

export interface LivePipelineEvaluation {
  pandId: string;
  address: {
    street: string;
    houseNumber: string;
    postalCode?: string;
    city?: string;
  };
  telemetry: {
    pandId: string;
    vboId?: string;
    bagFootprint2D: Array<[number, number]>;
    vboEntrancePoint?: [number, number];
    bouwjaar?: number;
    oppervlakteVboM2?: number;
    groundNapM?: number;
    eavesNapM?: number;
    ridgeNapM?: number;
    energielabel?: string;
    perceelnummer?: number;
  };
  calculatedFloors: EvaluatedFloorResult[];
}

export class LivePipelineEvaluator {
  private bagClient: KadasterBagClient;
  private threeDBagClient: ThreeDBagClient;
  private bgtClient: PdokBgtClient;
  private epClient: EpOnlineClient;
  private ahnClient: AhnElevationClient;
  private dkkClient: KadasterDkkClient;

  constructor(options: {
    bagClient?: KadasterBagClient;
    threeDBagClient?: ThreeDBagClient;
    bgtClient?: PdokBgtClient;
    epClient?: EpOnlineClient;
    ahnClient?: AhnElevationClient;
    dkkClient?: KadasterDkkClient;
  } = {}) {
    this.bagClient = options.bagClient || new KadasterBagClient();
    this.threeDBagClient = options.threeDBagClient || new ThreeDBagClient();
    this.bgtClient = options.bgtClient || new PdokBgtClient();
    this.epClient = options.epClient || new EpOnlineClient();
    this.ahnClient = options.ahnClient || new AhnElevationClient();
    this.dkkClient = options.dkkClient || new KadasterDkkClient();
  }

  /**
   * Zoekt een adres via PDOK Locatieserver en haalt de volledige live overheidsdata op
   */
  async evaluateAddress(addressQuery: string): Promise<LivePipelineEvaluation | null> {
    const encoded = encodeURIComponent(addressQuery);
    const suggestRes = await fetch(
      `https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=${encoded}`
    ).catch(() => null);

    if (!suggestRes || !suggestRes.ok) return null;
    const suggestData = await suggestRes.json();
    const firstDoc = suggestData?.response?.docs?.[0];
    if (!firstDoc?.id) return null;

    const lookupRes = await fetch(
      `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${encodeURIComponent(firstDoc.id)}`
    ).catch(() => null);

    if (!lookupRes || !lookupRes.ok) return null;
    const lookupData = await lookupRes.json();
    const doc = lookupData?.response?.docs?.[0];
    if (!doc) return null;

    const vboId = doc.adresseerbaarobject_id;
    let pandId = doc.pand_id || (doc.gekoppeld_pand && doc.gekoppeld_pand[0]);

    // Indien pandId ontbreekt, resolveer via VBO
    if (!pandId && vboId) {
      try {
        const vboRes = await fetch(
          `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?identificatie=${encodeURIComponent(vboId)}`
        );
        if (vboRes.ok) {
          const vboData = await vboRes.json();
          const href = vboData.features?.[0]?.properties?.['pand.href']?.[0];
          if (href) {
            const pandRes = await fetch(href);
            if (pandRes.ok) {
              const pandData = await pandRes.json();
              pandId = pandData.properties?.identificatie;
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    if (!pandId) return null;

    return this.evaluatePand(pandId, {
      street: doc.straatnaam || doc.weergavenaam || addressQuery,
      houseNumber: String(doc.huisnummer || ''),
      postalCode: doc.postcode,
      city: doc.woonplaatsnaam,
    });
  }

  /**
   * Evalueert een pand direct op basis van zijn BAG pandId
   */
  async evaluatePand(
    pandId: string,
    addressInfo?: { street: string; houseNumber: string; postalCode?: string; city?: string }
  ): Promise<LivePipelineEvaluation | null> {
    const [bagPand, cityJson] = await Promise.all([
      this.bagClient.getPandById(pandId).catch(() => null),
      this.threeDBagClient.get3DModel(pandId).catch(() => null),
    ]);

    if (!bagPand && !cityJson) return null;

    const footprintCoords: Array<[number, number]> =
      bagPand?.geometrieRD && typeof (bagPand.geometrieRD as any).toArray === 'function'
        ? (bagPand.geometrieRD as any).toArray()
        : (cityJson?.vertices ? cityJson.vertices.map((v) => [v.x, v.y]) : []);

    if (footprintCoords.length < 3) return null;

    const xs = footprintCoords.map((c) => c[0]);
    const ys = footprintCoords.map((c) => c[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cX = (minX + maxX) / 2;
    const cY = (minY + maxY) / 2;

    const pMin = RDNAPTransformer.rdToWgs84(minX - 25, minY - 25);
    const pMax = RDNAPTransformer.rdToWgs84(maxX + 25, maxY + 25);
    const bboxWgs84: [number, number, number, number] = [pMin.lng, pMin.lat, pMax.lng, pMax.lat];

    const [vbos, dkkPerceel, ahnResult] = await Promise.all([
      this.bagClient.getVerblijfsobjectenForPand(pandId, (bagPand as any)?.vboHrefs).catch(() => []),
      this.dkkClient.getPerceelForPoint(cX, cY).catch(() => null),
      cityJson?.groundHeightNAP !== undefined
        ? Promise.resolve({ groundLevelNAP: cityJson.groundHeightNAP, source: '3D_BAG' as const })
        : this.ahnClient.getGroundElevationPoint(cX, cY).catch(() => ({ groundLevelNAP: 0.0, source: 'FALLBACK' as const })),
    ]);

    const primaryVbo = vbos[0];
    const entrancePoint: [number, number] = primaryVbo?.rdCoordinates || [footprintCoords[0][0], footprintCoords[0][1]];
    const totalWoonoppervlakte = primaryVbo?.oppervlakte || (bagPand?.oppervlakte ? bagPand.oppervlakte * 0.9 : 120);

    // Bereken verdiepingsplattegronden via FloorGeometryCalculator
    const basePoints = footprintCoords.map(([x, y]) => ({ x, y }));
    const bgPoints = computeFloorGeometry(basePoints, -1, 0, totalWoonoppervlakte, 0.28, {
      vboEntrancePoint: entrancePoint,
    });
    const firstFloorPoints = computeFloorGeometry(basePoints, -1, 1, totalWoonoppervlakte, 0.28, {
      vboEntrancePoint: entrancePoint,
      oppGrond: bagPand?.oppervlakte,
    });
    const secondFloorPoints = computeFloorGeometry(basePoints, -1, 2, totalWoonoppervlakte, 0.28, {
      vboEntrancePoint: entrancePoint,
      oppGrond: bagPand?.oppervlakte,
    });

    const calculatedFloors: EvaluatedFloorResult[] = [
      {
        level: 0,
        name: 'Begane grond',
        polygon: bgPoints.map((p) => [p.x, p.y]),
        areaM2: this.calculatePolygonArea(bgPoints),
      },
      {
        level: 1,
        name: '1e verdieping',
        polygon: firstFloorPoints.map((p) => [p.x, p.y]),
        areaM2: this.calculatePolygonArea(firstFloorPoints),
      },
      {
        level: 2,
        name: '2e verdieping',
        polygon: secondFloorPoints.map((p) => [p.x, p.y]),
        areaM2: this.calculatePolygonArea(secondFloorPoints),
      },
    ];

    return {
      pandId,
      address: {
        street: addressInfo?.street || primaryVbo?.woonplaats || 'Straat',
        houseNumber: addressInfo?.houseNumber || String(primaryVbo?.huisnummer || ''),
        postalCode: addressInfo?.postalCode || primaryVbo?.postcode,
        city: addressInfo?.city || primaryVbo?.woonplaats,
      },
      telemetry: {
        pandId,
        vboId: primaryVbo?.id,
        bagFootprint2D: footprintCoords,
        vboEntrancePoint: entrancePoint,
        bouwjaar: bagPand?.bouwjaar,
        oppervlakteVboM2: primaryVbo?.oppervlakte,
        groundNapM: ahnResult.groundLevelNAP,
        eavesNapM: cityJson?.gutterHeightNAP,
        ridgeNapM: cityJson?.roofHeightNAP,
        perceelnummer: dkkPerceel?.perceelnummer,
      },
      calculatedFloors,
    };
  }

  /**
   * Vergelijkt dynamisch berekende vloeren met de Floorplanner grondwaarheid
   */
  compareFloorsWithGroundTruth(
    calculatedFloors: EvaluatedFloorResult[],
    groundTruthFloors: Array<{ level: number; outerPolygonM: Array<[number, number]>; measuredGrossAreaM2?: number }>
  ): {
    overallMatch: boolean;
    floorComparisons: Array<{ level: number; iou: number; hausdorffDistanceM: number; deltaAreaM2: number }>;
  } {
    const floorComparisons: Array<{ level: number; iou: number; hausdorffDistanceM: number; deltaAreaM2: number }> = [];
    let overallMatch = true;

    for (const gt of groundTruthFloors) {
      const calc = calculatedFloors.find((f) => f.level === gt.level);
      if (!calc) {
        overallMatch = false;
        continue;
      }

      // Vergelijk via rotatie-invariante PolygonSimilarityEngine
      const sim = PolygonSimilarityEngine.calculateRotationInvariantSimilarity(
        calc.polygon,
        gt.outerPolygonM
      );

      const deltaArea = gt.measuredGrossAreaM2
        ? Math.abs(calc.areaM2 - gt.measuredGrossAreaM2)
        : 0;

      floorComparisons.push({
        level: gt.level,
        iou: sim.iou,
        hausdorffDistanceM: sim.hausdorffDistanceM,
        deltaAreaM2: deltaArea,
      });

      if (sim.iou < 0.85) {
        overallMatch = false;
      }
    }

    return {
      overallMatch,
      floorComparisons,
    };
  }

  private calculatePolygonArea(points: Array<{ x: number; y: number }>): number {
    let a = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      a += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return Math.round((Math.abs(a) / 2) * 100) / 100;
  }
}
