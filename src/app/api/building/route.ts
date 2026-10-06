import { NextResponse } from 'next/server';
import { KadasterBagClient } from '@/data/bag/kadaster-bag-client';
import { ThreeDBagClient } from '@/data/cityjson/three-d-bag-client';
import { PdokBgtClient } from '@/data/bgt/pdok-bgt-client';
import { EpOnlineClient } from '@/data/ep-online/ep-online-client';
import { AhnElevationClient } from '@/data/ahn/ahn-elevation-client';
import { KadasterDkkClient, KadasterPerceel, KadasterGrens } from '@/data/kadaster/kadaster-dkk-client';
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
  const ahnClient = new AhnElevationClient();
  const dkkClient = new KadasterDkkClient();

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
            id: feat.properties.identificatie || vboIdParam,
            identificatie: feat.properties.identificatie || vboIdParam,
            oppervlakte: feat.properties.oppervlakte,
            gebruiksdoel: feat.properties.gebruiksdoel,
            status: feat.properties.status,
            huisnummer: feat.properties.huisnummer,
            huisletter: feat.properties.huisletter,
            toevoeging: feat.properties.toevoeging || feat.properties.huisnummertoevoeging,
            postcode: feat.properties.postcode,
            woonplaats: feat.properties.woonplaats_naam || feat.properties.woonplaatsnaam,
            rdCoordinates: feat.geometry?.coordinates || [0, 0],
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
                    id: feat.properties.identificatie || vboId,
                    identificatie: feat.properties.identificatie || vboId,
                    oppervlakte: feat.properties.oppervlakte,
                    gebruiksdoel: feat.properties.gebruiksdoel,
                    status: feat.properties.status,
                    huisnummer: feat.properties.huisnummer,
                    huisletter: feat.properties.huisletter,
                    toevoeging: feat.properties.toevoeging || feat.properties.huisnummertoevoeging,
                    postcode: feat.properties.postcode,
                    woonplaats: feat.properties.woonplaats_naam || feat.properties.woonplaatsnaam,
                    rdCoordinates: feat.geometry?.coordinates || [0, 0],
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

  // 2. Resolve via Coordinates with Point-in-Polygon & nearest tolerance
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

    // Bereken bounding box voor BGT, DKK en buren
    const geom: Array<{ x: number; y: number }> =
      bagPand?.geometrieRD && typeof (bagPand.geometrieRD as any).toArray === 'function'
        ? (bagPand.geometrieRD as any).toArray().map(([x, y]: [number, number]) => ({ x, y }))
        : (cityJson?.vertices ? cityJson.vertices.map((v) => ({ x: v.x, y: v.y })) : []);

    let bgtInstallaties: any[] = [];
    let bgtBomen: any[] = [];
    let bgtWegdelen: any[] = [];
    let bgtScheidingen: any[] = [];
    let bgtTerreindelen: any[] = [];
    let dkkPerceel: KadasterPerceel | null = null;
    let dkkGrenzen: KadasterGrens[] = [];
    let neighbors: any[] = [];

    if (geom && geom.length > 0) {
      const xs = geom.map((p) => p.x);
      const ys = geom.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const cX = (minX + maxX) / 2;
      const cY = (minY + maxY) / 2;

      // Bbox in WGS84 voor BGT API
      const pMin = RDNAPTransformer.rdToWgs84(minX - 30, minY - 30);
      const pMax = RDNAPTransformer.rdToWgs84(maxX + 30, maxY + 30);
      const bboxWgs84: [number, number, number, number] = [pMin.lng, pMin.lat, pMax.lng, pMax.lat];

      // Parallel BGT, DKK en buren ophalen
      const [installaties, bomen, wegdelen, scheidingen, terreinen, perceel, grenzen, nbs] =
        await Promise.all([
          bgtClient.getGebouwInstallaties(bboxWgs84).catch(() => []),
          bgtClient.getVegetatieObjecten(bboxWgs84).catch(() => []),
          bgtClient.getWegdelen(bboxWgs84).catch(() => []),
          bgtClient.getScheidingen(bboxWgs84).catch(() => []),
          bgtClient.getTerreindelen(bboxWgs84).catch(() => []),
          dkkClient.getPerceelForPoint(cX, cY).catch(() => null),
          dkkClient
            .getKadastraleGrenzen({
              minX: minX - 30,
              minY: minY - 30,
              maxX: maxX + 30,
              maxY: maxY + 30,
            })
            .catch(() => []),
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
      bgtWegdelen = wegdelen;
      bgtScheidingen = scheidingen;
      bgtTerreindelen = terreinen;
      dkkPerceel = perceel;
      dkkGrenzen = grenzen;
      neighbors = nbs.filter((n) => n.identificatie !== bagPand?.identificatie);
    }

    // 2. Haal VBO's op via officiële hrefs en parallel resolutie
    const rawVbos = await bagClient
      .getVerblijfsobjectenForPand(pandId, (bagPand as any)?.vboHrefs)
      .catch(() => []);

    const finalVbos = rawVbos.length > 0 ? rawVbos : (initialVbo ? [initialVbo] : []);

    // 3. EP-Online resolutie (query param of afgeleid uit primair VBO)
    const parsedHuisnummer = parseInt(huisnummerStr, 10);
    let resolvedPostcode = postcode;
    let resolvedHuisnummer = !isNaN(parsedHuisnummer) ? parsedHuisnummer : undefined;
    let resolvedToevoeging = toevoeging || undefined;

    if ((!resolvedPostcode || resolvedHuisnummer === undefined) && finalVbos.length > 0) {
      const primaryVbo = finalVbos[0];
      if (primaryVbo.postcode) resolvedPostcode = primaryVbo.postcode;
      if (typeof primaryVbo.huisnummer === 'number') {
        resolvedHuisnummer = primaryVbo.huisnummer;
      } else if (primaryVbo.huisnummer) {
        const parsed = parseInt(String(primaryVbo.huisnummer), 10);
        if (!isNaN(parsed)) resolvedHuisnummer = parsed;
      }
      if (primaryVbo.toevoeging || primaryVbo.huisletter) {
        resolvedToevoeging = primaryVbo.toevoeging || primaryVbo.huisletter;
      }
    }

    let epData: any = null;
    if (resolvedPostcode && resolvedHuisnummer !== undefined) {
      epData = await epClient
        .getEnergyData(resolvedPostcode, resolvedHuisnummer, resolvedToevoeging)
        .catch(() => null);
    }

    // 4. Resolveer AHN maaiveldhoogte (3D BAG of directe WMS fallback)
    let ahnResult: any = null;
    if (cityJson && typeof cityJson.groundHeightNAP === 'number') {
      ahnResult = AhnElevationClient.getGroundDatumFrom3DBAG(cityJson);
    } else if (geom && geom.length > 0) {
      const xs = geom.map((p) => p.x);
      const ys = geom.map((p) => p.y);
      const cX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cY = (Math.min(...ys) + Math.max(...ys)) / 2;
      ahnResult = await ahnClient.getGroundElevationPoint(cX, cY).catch(() => ({
        groundLevelNAP: 0.0,
        source: 'FALLBACK' as const,
      }));
    } else {
      ahnResult = { groundLevelNAP: 0.0, source: 'FALLBACK' };
    }

    const result = {
      pandId,
      bag: bagPand,
      cityJson,
      ahn: ahnResult,
      vbos: finalVbos,
      bgt: {
        installaties: bgtInstallaties,
        bomen: bgtBomen,
        wegdelen: bgtWegdelen,
        scheidingen: bgtScheidingen,
        terreindelen: bgtTerreindelen,
      },
      kadaster: {
        perceel: dkkPerceel,
        grenzen: dkkGrenzen,
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
