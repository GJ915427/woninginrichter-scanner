import { NextResponse } from 'next/server';
import { KadasterBagClient } from '@/data/bag/kadaster-bag-client';
import { ThreeDBagClient } from '@/data/cityjson/three-d-bag-client';
import { PdokBgtClient } from '@/data/bgt/pdok-bgt-client';
import { EpOnlineClient } from '@/data/ep-online/ep-online-client';
import { RDNAPTransformer } from '@/domain/geometry/rd-nap-trans';

// In-memory BFF server cache (1 hour TTL)
interface CacheEntry {
  timestamp: number;
  data: any;
}
const CACHE_TTL_MS = 3600 * 1000;
const serverCache = new Map<string, CacheEntry>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pandIdParam = searchParams.get('pandId');
  const vboIdParam = searchParams.get('vboId');
  let pandId = pandIdParam;
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const postcode = searchParams.get('postcode') || '';
  const huisnummerStr = searchParams.get('huisnummer') || '';
  const toevoeging = searchParams.get('toevoeging') || '';

  const bagClient = new KadasterBagClient();
  const threeDBagClient = new ThreeDBagClient();
  const bgtClient = new PdokBgtClient();
  const epClient = new EpOnlineClient();

  // 1. Resolve via VBO ID if provided and pandId is missing
  let initialVbo: any = null;
  if (vboIdParam) {
    try {
      const vboRes = await fetch(
        `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?identificatie=${encodeURIComponent(vboIdParam)}`
      );
      if (vboRes.ok) {
        const vboData = await vboRes.json();
        const feat = vboData.features?.[0];
        if (feat?.properties) {
          initialVbo = {
            identificatie: feat.properties.identificatie || vboIdParam,
            oppervlakte: feat.properties.oppervlakte,
            gebruiksdoel: feat.properties.gebruiksdoel,
            status: feat.properties.status,
          };
          if (!pandId && feat.properties['pand.href']?.[0]) {
            const pandRes = await fetch(feat.properties['pand.href'][0]);
            if (pandRes.ok) {
              const pandData = await pandRes.json();
              pandId = pandData.properties?.identificatie || null;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to resolve pand from vboIdParam:', e);
    }
  }

  if (!initialVbo && latStr && lngStr) {
    try {
      const revRes = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${latStr}&lon=${lngStr}&type=adres&rows=1`
      );
      if (revRes.ok) {
        const revData = await revRes.json();
        const revDoc = revData.response?.docs?.[0];
        if (revDoc?.id) {
          const lkRes = await fetch(
            `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${revDoc.id}`
          );
          if (lkRes.ok) {
            const lkData = await lkRes.json();
            const doc = lkData.response?.docs?.[0];
            const vboId = doc?.adresseerbaarobject_id;
            if (vboId) {
              const vboRes = await fetch(
                `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?identificatie=${encodeURIComponent(vboId)}`
              );
              if (vboRes.ok) {
                const vboData = await vboRes.json();
                const feat = vboData.features?.[0];
                if (feat?.properties) {
                  initialVbo = {
                    identificatie: feat.properties.identificatie || vboId,
                    oppervlakte: feat.properties.oppervlakte,
                    gebruiksdoel: feat.properties.gebruiksdoel,
                    status: feat.properties.status,
                  };
                  if (!pandId && feat.properties['pand.href']?.[0]) {
                    const pandRes = await fetch(feat.properties['pand.href'][0]);
                    if (pandRes.ok) {
                      const pandData = await pandRes.json();
                      pandId = pandData.properties?.identificatie || null;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to reverse-resolve VBO:', e);
    }
  }

  // 2. Resolve via Coordinates with Point-in-Polygon & largest area preference
  if (!pandId && latStr && lngStr) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      const rd = RDNAPTransformer.wgs84ToRd(lat, lng);
      const nearbyPanden = await bagClient
        .getPandenByBbox({
          minX: rd.x - 25,
          minY: rd.y - 25,
          maxX: rd.x + 25,
          maxY: rd.y + 25,
        })
        .catch(() => []);

      if (nearbyPanden.length > 0) {
        const containing = nearbyPanden.find((p) => {
          try {
            return (p.geometrieRD as any)?.contains?.({ x: rd.x, y: rd.y });
          } catch {
            return false;
          }
        });

        if (containing) {
          pandId = containing.identificatie;
        } else {
          // Find closest building within 5 meters tolerance instead of blind largest-area bias
          let closestPand: any = null;
          let minDistance = 5.0;
          for (const p of nearbyPanden) {
            const geom = p.geometrieRD;
            if (geom?.vertices && Array.isArray(geom.vertices)) {
              for (const v of geom.vertices) {
                const dist = Math.hypot(v.x - rd.x, v.y - rd.y);
                if (dist < minDistance) {
                  minDistance = dist;
                  closestPand = p;
                }
              }
            }
          }
          if (closestPand) {
            pandId = closestPand.identificatie;
          }
        }
      }
    }
  }

  if (!pandId) {
    return NextResponse.json({ error: 'Missing required pandId or coordinates' }, { status: 400 });
  }

  // Check cache
  const cacheKey = `${pandId}:${postcode}:${huisnummerStr}:${toevoeging}`;
  const cached = serverCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  try {
    // 1. Haal BAG pand en 3D BAG CityJSON parallel op
    const [bagPand, cityJson] = await Promise.all([
      bagClient.getPandById(pandId).catch(() => null),
      threeDBagClient.get3DModel(pandId).catch(() => null),
    ]);

    if (!bagPand && !cityJson) {
      return NextResponse.json({ error: `Pand niet gevonden: ${pandId}` }, { status: 404 });
    }

    // Bereken bounding box voor BGT en buren
    const geom: Array<{ x: number; y: number }> =
      bagPand?.geometrieRD && typeof (bagPand.geometrieRD as any).toArray === 'function'
        ? (bagPand.geometrieRD as any).toArray().map(([x, y]: [number, number]) => ({ x, y }))
        : (cityJson?.vertices ? cityJson.vertices.map((v) => ({ x: v.x, y: v.y })) : []);
    let bgtInstallaties: any[] = [];
    let bgtBomen: any[] = [];
    let neighbors: any[] = [];

    if (geom && geom.length > 0) {
      const xs = geom.map((p) => p.x);
      const ys = geom.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Bbox in WGS84 voor BGT API
      const pMin = RDNAPTransformer.rdToWgs84(minX - 30, minY - 30);
      const pMax = RDNAPTransformer.rdToWgs84(maxX + 30, maxY + 30);
      const bboxWgs84: [number, number, number, number] = [pMin.lng, pMin.lat, pMax.lng, pMax.lat];

      // Parallel BGT en buren ophalen
      const [installaties, bomen, nbs] = await Promise.all([
        bgtClient.getGebouwInstallaties(bboxWgs84).catch(() => []),
        bgtClient.getVegetatieObjecten(bboxWgs84).catch(() => []),
        bagClient
          .getPandenByBbox({
            minX: minX - 25,
            minY: minY - 25,
            maxX: maxX + 25,
            maxY: maxY + 25,
          })
          .catch(() => []),
      ]);

      bgtInstallaties = installaties;
      bgtBomen = bomen;
      neighbors = nbs.filter((n) => n.identificatie !== bagPand?.identificatie);
    }

    // 2. Haal VBO's en EP-Online op
    const huisnummer = parseInt(huisnummerStr, 10);
    const [vbos, epData] = await Promise.all([
      bagClient.getVerblijfsobjectenByPand(pandId).catch(() => []),
      postcode && !isNaN(huisnummer)
        ? epClient.getEnergyData(postcode, huisnummer, toevoeging).catch(() => null)
        : Promise.resolve(null),
    ]);

    const finalVbos = (vbos && vbos.length > 0) ? vbos : (initialVbo ? [initialVbo] : []);
    const result = {
      pandId,
      bag: bagPand,
      cityJson,
      vbos: finalVbos,
      bgt: {
        installaties: bgtInstallaties,
        bomen: bgtBomen,
      },
      neighbors,
      epOnline: epData,
      retrievedAt: new Date().toISOString(),
    };

    serverCache.set(cacheKey, { timestamp: Date.now(), data: result });

    return NextResponse.json(result, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Interne serverfout bij ophalen gebouwdata' },
      { status: 500 }
    );
  }
}
