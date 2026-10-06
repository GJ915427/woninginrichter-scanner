import { Point3D } from '../../domain/geometry/types';
import { CityJSON3DModel, SemanticSurface } from '../types';

export interface CityJSONTransform {
  scale: [number, number, number];
  translate: [number, number, number];
}

export interface ThreeDBagClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class ThreeDBagClient {
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(options: ThreeDBagClientOptions = {}) {
    this.baseUrl =
      options.baseUrl || 'https://api.3dbag.nl/collections/pand/items';
    this.fetchFn = options.fetchFn || fetch.bind(globalThis);
  }

  /**
   * Applies metadata.transform (v * scale + translate) to quantized integer vertices.
   */
  static transformVertices(
    rawVertices: number[][],
    transform?: CityJSONTransform
  ): Point3D[] {
    const scale = transform?.scale || [1, 1, 1];
    const translate = transform?.translate || [0, 0, 0];

    return rawVertices.map(([vx, vy, vz]) => ({
      x: Math.round((vx * scale[0] + translate[0]) * 1000) / 1000,
      y: Math.round((vy * scale[1] + translate[1]) * 1000) / 1000,
      z: Math.round((vz * scale[2] + translate[2]) * 1000) / 1000,
    }));
  }

  /**
   * Parses a CityJSON 2.0 object or CityJSONFeature into a structured CityJSON3DModel.
   */
  static parseCityJSON(data: any, preferredLod: '1.2' | '1.3' | '2.2' = '2.2'): CityJSON3DModel {
    if (!data) {
      throw new Error('CityJSON data is null or undefined');
    }

    const transform: CityJSONTransform =
      data.metadata?.transform ||
      data.transform || {
        scale: [1, 1, 1],
        translate: [0, 0, 0],
      };

    const rawVertices: number[][] =
      data.feature?.vertices || data.vertices || [];
    const vertices = this.transformVertices(rawVertices, transform);

    const cityObjects =
      data.feature?.CityObjects || data.CityObjects || {};

    const objectKeys = Object.keys(cityObjects);
    if (objectKeys.length === 0) {
      throw new Error('No CityObjects found in CityJSON data');
    }

    // Identify main building and building parts
    const mainPandId =
      objectKeys.find((k) => cityObjects[k].type === 'Building') ||
      objectKeys.find((k) => !k.includes('-')) ||
      objectKeys[0];
    const mainObj = cityObjects[mainPandId];

    // Find the object with geometry or children
    let targetGeomObj = mainObj;
    for (const key of objectKeys) {
      const obj = cityObjects[key];
      if (obj.geometry && obj.geometry.length > 0) {
        targetGeomObj = obj;
        break;
      }
    }

    // Attributes may be on main parent object
    const attributes = {
      ...(mainObj.attributes || {}),
      ...(targetGeomObj.attributes || {}),
    };

    const geometries = targetGeomObj.geometry || [];

    // Select requested LoD or fallback to highest available LoD
    let selectedGeom = geometries.find((g: any) => g.lod === preferredLod);
    if (!selectedGeom) {
      selectedGeom =
        geometries.find((g: any) => g.lod === '2.2') ||
        geometries.find((g: any) => g.lod === '1.3') ||
        geometries.find((g: any) => g.lod === '1.2') ||
        geometries[0];
    }

    const surfaces: SemanticSurface[] = [];
    const lod = (selectedGeom?.lod || '2.2') as '1.2' | '1.3' | '2.2';

    if (selectedGeom) {
      const geomType = selectedGeom.type;
      const boundaries = selectedGeom.boundaries || [];
      const semanticsSurfaces = selectedGeom.semantics?.surfaces || [];
      const semanticsValues = selectedGeom.semantics?.values || [];

      if (geomType === 'MultiSurface' || geomType === 'CompositeSurface') {
        // boundaries: [ [ring0, ring1...], ... ]
        boundaries.forEach((surface: number[][], faceIdx: number) => {
          const semIdx = semanticsValues[faceIdx];
          const semDef =
            semIdx !== undefined && semanticsSurfaces[semIdx]
              ? semanticsSurfaces[semIdx]
              : { type: 'WallSurface' };

          const exteriorRing = surface[0] || [];
          const polygon3D = exteriorRing.map((vIdx) => vertices[vIdx]).filter(Boolean);

          surfaces.push({
            type: semDef.type,
            surfaceIndex: faceIdx,
            faceIndices: surface,
            polygon3D,
            lod,
          });
        });
      } else if (geomType === 'Solid') {
        // boundaries: [ shell0, ... ] where shell0 is array of surfaces
        boundaries.forEach((shell: number[][][], shellIdx: number) => {
          const shellSemValues = semanticsValues[shellIdx] || semanticsValues;
          shell.forEach((surface: number[][], faceIdx: number) => {
            const semIdx = shellSemValues[faceIdx];
            const semDef =
              semIdx !== undefined && semanticsSurfaces[semIdx]
                ? semanticsSurfaces[semIdx]
                : { type: 'WallSurface' };

            const exteriorRing = surface[0] || [];
            const polygon3D = exteriorRing.map((vIdx) => vertices[vIdx]).filter(Boolean);

            surfaces.push({
              type: semDef.type,
              surfaceIndex: faceIdx,
              faceIndices: surface,
              polygon3D,
              lod,
            });
          });
        });
      }
    }

    const groundHeightNAP = attributes.b3_h_maaiveld ?? 0;
    const roofHeightNAP = attributes.b3_h_dak_max ?? (groundHeightNAP + 6.0);
    const gutterHeightNAP = attributes.b3_h_dak_50p ?? (groundHeightNAP + 3.0);
    const roofType = attributes.b3_dak_type || 'zadeldak';

    return {
      pandId: mainPandId,
      vertices,
      surfaces,
      lod,
      groundHeightNAP: Math.round(groundHeightNAP * 100) / 100,
      roofHeightNAP: Math.round(roofHeightNAP * 100) / 100,
      gutterHeightNAP: Math.round(gutterHeightNAP * 100) / 100,
      roofType,
      attributes,
    };
  }

  /**
   * Fetches CityJSON 3D model for a given BAG Pand ID from the 3D BAG API.
   */
  async get3DModel(
    pandId: string,
    lod: '1.2' | '1.3' | '2.2' = '2.2'
  ): Promise<CityJSON3DModel> {
    const formattedId = pandId.startsWith('NL.IMBAG.Pand.')
      ? pandId
      : `NL.IMBAG.Pand.${pandId}`;

    const url = `${this.baseUrl}/${encodeURIComponent(formattedId)}`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new Error(`3D BAG API error: HTTP ${res.status}`);
    }

    const json = await res.json();
    return ThreeDBagClient.parseCityJSON(json, lod);
  }
}
