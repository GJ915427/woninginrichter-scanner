/**
 * src/domain/orders/dimension-extraction-engine.ts
 *
 * Centrale SSOT Engine voor wiskundige maten-extractie uit ERP velden,
 * e-Order configuraties en vrije tekst omschrijvingen/notities.
 *
 * Ondersteunt 5 polymorfe categorieën conform DDD CPQ standaarden:
 * 1. window_2d (Raambekleding & Buitenzonwering: B × H mm, m²)
 * 2. floor_area (Vloerbekleding: netto m², snijverlies %, bruto m²)
 * 3. curtain_linear (Gordijnen & Rails: railbreedte mm, confectiehoogte mm, plooifactor)
 * 4. stairs (Trappen: treden, open/dicht, renovatie, stootborden, LED, bandering)
 * 5. piece_service (Diensten, uurtarieven, montage, fail-closed fallback)
 */

import type {
  DimensionSpec,
  RawOrderLineInput,
  ConfigurationDimensions,
} from '@/types/order-intake';

export interface ExtractedDimensionResult {
  dimensionSpec: DimensionSpec;
  formattedDim: string | null;
  source: 'erp_fields' | 'description_regex' | 'notes_regex' | 'configuration_fallback' | 'fallback_default';
}

const MAX_DIMENSION_MM = 15000;
const MIN_DIMENSION_MM = 1;

export class DimensionExtractionEngine {
  /**
   * Extraheert de polymorfe DimensionSpec en geformatteerde weergave uit een orderregel.
   */
  public extractDimension(
    line: RawOrderLineInput,
    productGroupCode?: string,
    fallbackDimensions?: ConfigurationDimensions
  ): ExtractedDimensionResult {
    const groupCode = productGroupCode || '';
    const desc = line.description || '';
    const notes = line.notes || '';
    const unit = line.unit || 'stuks';

    // 0. Fail-Closed Check op ongeldige / absurde numerieke ERP velden
    if (line.width_mm !== undefined || line.height_mm !== undefined) {
      const w = line.width_mm;
      const h = line.height_mm;
      if (
        (w !== undefined && (w < MIN_DIMENSION_MM || w > MAX_DIMENSION_MM)) ||
        (h !== undefined && (h < MIN_DIMENSION_MM || h > MAX_DIMENSION_MM))
      ) {
        return {
          dimensionSpec: { type: 'piece_service', unit },
          formattedDim: null,
          source: 'fallback_default',
        };
      }
    }

    // 1. Directe ERP velden (width_mm & height_mm)
    if (
      line.width_mm !== undefined &&
      line.width_mm >= MIN_DIMENSION_MM &&
      line.width_mm <= MAX_DIMENSION_MM &&
      line.height_mm !== undefined &&
      line.height_mm >= MIN_DIMENSION_MM &&
      line.height_mm <= MAX_DIMENSION_MM
    ) {
      const widthMm = line.width_mm;
      const heightMm = line.height_mm;
      const areaM2 = Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;
      return {
        dimensionSpec: {
          type: 'window_2d',
          widthMm,
          heightMm,
          areaM2,
        },
        formattedDim: `${widthMm} × ${heightMm}`,
        source: 'erp_fields',
      };
    }

    // 2. Trappen (stairs)
    const isStairs =
      groupCode === '6.4' ||
      /trap/i.test(groupCode) ||
      ((!groupCode || groupCode === '9.9') && (
        /\btrap(pen|loper|renovatie|tred(e|en))?\b/i.test(desc) ||
        /\btrap(pen|loper|renovatie|tred(e|en))?\b/i.test(notes)
      ));

    if (isStairs) {
      const stairsResult = this.parseStairs(desc, notes, unit, groupCode);
      if (stairsResult) return stairsResult;
    }

    // 3. Vaste Vloerbekleding (floor_area)
    const isFloor =
      groupCode.startsWith('3.') ||
      /vloer|pvc|laminaat|parket|tapijt|ondervloer/i.test(groupCode) ||
      /vloer|pvc|laminaat|parket|tapijt|ondervloer/i.test(desc) ||
      /vloer|pvc|laminaat|parket|tapijt|ondervloer/i.test(notes);

    if (isFloor) {
      const floorResult = this.parseFloor(line, desc, notes, unit, groupCode);
      if (floorResult) return floorResult;
    }

    // 4. Gordijnen & Rails (curtain_linear)
    const isExplicitHardWindow =
      groupCode.startsWith('2.') ||
      /rolgordijn|vouwgordijn|plisse|duette|jaloezie|hor/i.test(desc) ||
      /rolgordijn|vouwgordijn|plisse|duette|jaloezie|hor/i.test(notes);

    const isCurtain =
      !isExplicitHardWindow &&
      (groupCode.startsWith('1.') ||
        /gordijn|inbetween|vitrage|rail/i.test(groupCode) ||
        /gordijn|inbetween|vitrage|rail/i.test(desc) ||
        /gordijn|inbetween|vitrage|rail/i.test(notes));

    if (isCurtain) {
      const curtainResult = this.parseCurtain(desc, notes, unit, groupCode);
      if (curtainResult) return curtainResult;
    }

    // 5. Raambekleding & Buitenzonwering (window_2d) via regex
    const isWindow =
      groupCode.startsWith('2.') ||
      /raam|duette|plisse|jaloezie|hor|screen|rolluik|zonwering/i.test(groupCode) ||
      /raam|duette|plisse|jaloezie|hor|screen|rolluik|zonwering/i.test(desc) ||
      /raam|duette|plisse|jaloezie|hor|screen|rolluik|zonwering/i.test(notes);

    const windowRegexResult = this.parseWindow2D(desc, notes, unit);
    if (windowRegexResult) {
      return windowRegexResult;
    }

    // 6. Synthese uit e-Order fallbackDimensions (Unilux / KeJe / Luxaflex)
    if (
      fallbackDimensions &&
      fallbackDimensions.width_mm !== undefined &&
      fallbackDimensions.width_mm >= MIN_DIMENSION_MM &&
      fallbackDimensions.width_mm <= MAX_DIMENSION_MM &&
      fallbackDimensions.height_mm !== undefined &&
      fallbackDimensions.height_mm >= MIN_DIMENSION_MM &&
      fallbackDimensions.height_mm <= MAX_DIMENSION_MM
    ) {
      const widthMm = fallbackDimensions.width_mm;
      const heightMm = fallbackDimensions.height_mm;
      const areaM2 = Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;
      return {
        dimensionSpec: {
          type: 'window_2d',
          widthMm,
          heightMm,
          areaM2,
        },
        formattedDim: `${widthMm} × ${heightMm}`,
        source: 'configuration_fallback',
      };
    }

    // 7. Diensten & Overig (piece_service) fail-closed fallback
    return {
      dimensionSpec: {
        type: 'piece_service',
        unit,
      },
      formattedDim: null,
      source: 'fallback_default',
    };
  }

  /**
   * Bijectieve parsing van dimensietekst naar DimensionSpec.
   */
  public parseDimensionString(dimText: string, categoryOrGroupCode?: string): DimensionSpec {
    const syntheticLine: RawOrderLineInput = {
      line_number: 1,
      description: dimText,
      notes: dimText,
    };
    const result = this.extractDimension(syntheticLine, categoryOrGroupCode);
    return result.dimensionSpec;
  }

  /**
   * Converteert een DimensionSpec naar een consistente geformatteerde string.
   */
  public formatDimensionSpec(spec: DimensionSpec): string | null {
    switch (spec.type) {
      case 'stairs': {
        const parts: string[] = [];
        if (spec.isOpen) parts.push('open');
        if (spec.hasRisers && !spec.isOpen) parts.push('dicht');
        if (spec.ledLighting) parts.push('LED');
        if (spec.bandering) parts.push('gebandeerd');

        const optionsStr = parts.length > 0 ? ` (${parts.join(' + ')})` : '';
        return `${spec.stepsCount} treden${optionsStr}`;
      }
      case 'floor_area': {
        const wasteStr = spec.wastePercentage ? ` (+${spec.wastePercentage}% snijverlies)` : '';
        const areaFormatted = spec.netAreaM2.toString().replace('.', ',');
        return `${areaFormatted} m²${wasteStr}`;
      }
      case 'window_2d': {
        return `${spec.widthMm} × ${spec.heightMm}`;
      }
      case 'curtain_linear': {
        if (spec.heightMm) {
          let pleatLabel = '';
          if (spec.pleatFactor === 2.2) pleatLabel = ' (wave)';
          else if (spec.pleatFactor === 2.5) pleatLabel = ' (vlinder)';
          else if (spec.pleatFactor === 2.0) pleatLabel = ' (enkel)';
          return `${spec.widthMm} × ${spec.heightMm} mm${pleatLabel}`;
        }
        return `${spec.widthMm} mm`;
      }
      case 'piece_service':
      default:
        return null;
    }
  }

  // =========================================================================
  // Private Category Parsers
  // =========================================================================

  private parseStairs(
    desc: string,
    notes: string,
    unit: string,
    groupCode: string = ''
  ): ExtractedDimensionResult | null {
    const fullText = `${desc} ${notes} ${groupCode}`.trim();

    // Tredenaantal
    const stepsMatch = fullText.match(/(\d+)\s*(?:trede|treden|stappen|tredes)/i);
    const stepsCount = stepsMatch ? parseInt(stepsMatch[1], 10) : 13;

    // Stair Type
    const isRenovation = /renovatie/i.test(fullText);
    const isLoper = /loper/i.test(fullText);
    const isStoffering = /stoffer/i.test(fullText);
    const isOpen = /open/i.test(fullText);

    let stairType: 'dicht' | 'open' | 'renovatie' | 'stoffering' | 'loper' = 'dicht';
    if (isRenovation) stairType = 'renovatie';
    else if (isLoper) stairType = 'loper';
    else if (isStoffering) stairType = 'stoffering';
    else if (isOpen) stairType = 'open';

    const hasRisers = isRenovation ? !isOpen || /stootbord|dicht/i.test(fullText) : !isOpen && stairType !== 'loper';
    const ledLighting = /led/i.test(fullText);
    const bandering = /bandering|gebandeerd|feston/i.test(fullText);

    const spec: DimensionSpec = {
      type: 'stairs',
      stepsCount: Math.max(1, stepsCount),
      stairType,
      hasRisers,
      isOpen,
      ledLighting,
      bandering,
    };

    return {
      dimensionSpec: spec,
      formattedDim: this.formatDimensionSpec(spec),
      source: stepsMatch ? (desc.includes(stepsMatch[0]) ? 'description_regex' : 'notes_regex') : 'fallback_default',
    };
  }

  private parseFloor(
    line: RawOrderLineInput,
    desc: string,
    notes: string,
    unit: string,
    groupCode: string = ''
  ): ExtractedDimensionResult | null {
    const fullText = `${desc} ${notes} ${groupCode}`.trim();

    // 1. Zoek naar m2 in tekst
    const floorMatch = fullText.match(/([\d.,]+)\s*(?:m2|m²)/i);
    let netAreaM2: number | null = null;
    let source: ExtractedDimensionResult['source'] = 'description_regex';

    if (floorMatch) {
      netAreaM2 = parseFloat(floorMatch[1].replace(',', '.'));
      source = desc.includes(floorMatch[0]) ? 'description_regex' : 'notes_regex';
    } else if (unit.toLowerCase() === 'm2' && line.quantity && line.quantity > 0) {
      netAreaM2 = line.quantity;
      source = 'erp_fields';
    }

    if (netAreaM2 === null || isNaN(netAreaM2) || netAreaM2 <= 0) {
      return null;
    }

    // Snijverlies
    const wasteMatch = fullText.match(/(?:\+(\d+)%|\((\d+)%\)\s*snijverlies|\+(\d+)\s*%\s*snijverlies)/i);
    let wastePercentage: number;
    if (wasteMatch) {
      wastePercentage = parseInt(wasteMatch[1] || wasteMatch[2] || wasteMatch[3], 10);
    } else if (/visgraat/i.test(fullText)) {
      wastePercentage = 10;
    } else {
      wastePercentage = 5;
    }

    const grossAreaM2 = Math.round(netAreaM2 * (1 + wastePercentage / 100) * 100) / 100;

    const spec: DimensionSpec = {
      type: 'floor_area',
      netAreaM2,
      wastePercentage,
      grossAreaM2,
    };

    return {
      dimensionSpec: spec,
      formattedDim: this.formatDimensionSpec(spec),
      source,
    };
  }

  private parseCurtain(
    desc: string,
    notes: string,
    unit: string,
    groupCode: string = ''
  ): ExtractedDimensionResult | null {
    const fullText = `${desc} ${notes} ${groupCode}`.trim();

    // Plooifactor
    let pleatFactor: number | undefined;
    if (/wave/i.test(fullText)) pleatFactor = 2.2;
    else if (/vlinder|dubbel/i.test(fullText)) pleatFactor = 2.5;
    else if (/enkel/i.test(fullText)) pleatFactor = 2.0;

    // Detecteer breedte en hoogte
    // Variant 1: Breedte X cm / mm Hoogte Y cm / mm
    const bhMatch = fullText.match(/breedte\s*(\d+)\s*(cm|mm)?.*?hoogte\s*(\d+)\s*(cm|mm)?/i);
    if (bhMatch) {
      const wUnit = bhMatch[2]?.toLowerCase() || 'cm';
      const hUnit = bhMatch[4]?.toLowerCase() || 'cm';
      const wRaw = parseInt(bhMatch[1], 10);
      const hRaw = parseInt(bhMatch[3], 10);
      const widthMm = wUnit === 'cm' ? wRaw * 10 : wRaw;
      const heightMm = hUnit === 'cm' ? hRaw * 10 : hRaw;

      if (widthMm >= MIN_DIMENSION_MM && widthMm <= MAX_DIMENSION_MM && heightMm >= MIN_DIMENSION_MM && heightMm <= MAX_DIMENSION_MM) {
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm,
          pleatFactor,
        };
        return {
          dimensionSpec: spec,
          formattedDim: this.formatDimensionSpec(spec),
          source: desc.includes(bhMatch[0]) ? 'description_regex' : 'notes_regex',
        };
      }
    }

    // Variant 2: Kruismaat 300 x 250 cm
    const crossMatch = fullText.replace(/×/g, 'x').match(/(\d+)\s*x\s*(\d+)\s*(cm|mm)?/i);
    if (crossMatch && !/rail/i.test(fullText)) {
      const u = crossMatch[3]?.toLowerCase() || (parseInt(crossMatch[1], 10) <= 500 ? 'cm' : 'mm');
      const wRaw = parseInt(crossMatch[1], 10);
      const hRaw = parseInt(crossMatch[2], 10);
      const widthMm = u === 'cm' ? wRaw * 10 : wRaw;
      const heightMm = u === 'cm' ? hRaw * 10 : hRaw;

      if (widthMm >= MIN_DIMENSION_MM && widthMm <= MAX_DIMENSION_MM && heightMm >= MIN_DIMENSION_MM && heightMm <= MAX_DIMENSION_MM) {
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm,
          pleatFactor,
        };
        return {
          dimensionSpec: spec,
          formattedDim: this.formatDimensionSpec(spec),
          source: desc.includes(crossMatch[0]) ? 'description_regex' : 'notes_regex',
        };
      }
    }

    // Variant 3: Lineaire railmaat (bijv. 4,20 m1 of 4200 mm)
    const m1Match = fullText.match(/([\d.,]+)\s*(?:m1|m¹|meter)/i);
    if (m1Match) {
      const meters = parseFloat(m1Match[1].replace(',', '.'));
      const widthMm = Math.round(meters * 1000);
      if (widthMm >= MIN_DIMENSION_MM && widthMm <= MAX_DIMENSION_MM) {
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm: undefined,
          pleatFactor: undefined,
        };
        return {
          dimensionSpec: spec,
          formattedDim: `${widthMm} mm`,
          source: desc.includes(m1Match[0]) ? 'description_regex' : 'notes_regex',
        };
      }
    }

    const linearMmMatch = fullText.match(/(\d+)\s*mm/i);
    if (linearMmMatch) {
      const widthMm = parseInt(linearMmMatch[1], 10);
      if (widthMm >= MIN_DIMENSION_MM && widthMm <= MAX_DIMENSION_MM) {
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm: undefined,
          pleatFactor: undefined,
        };
        return {
          dimensionSpec: spec,
          formattedDim: `${widthMm} mm`,
          source: desc.includes(linearMmMatch[0]) ? 'description_regex' : 'notes_regex',
        };
      }
    }

    return null;
  }

  private parseWindow2D(
    desc: string,
    notes: string,
    unit: string
  ): ExtractedDimensionResult | null {
    // 1. Zoek in description en daarna notes
    for (const text of [desc, notes]) {
      if (!text) continue;
      const source: ExtractedDimensionResult['source'] = text === desc ? 'description_regex' : 'notes_regex';

      // A. Label syntax: B 1800 H 2400 of Breedte: 1800 Hoogte: 2400
      const bhMatch = text.match(/(?:B|Breedte)[:\s]*(\d+)\s*(?:cm|mm)?[\s,]+(?:H|Hoogte)[:\s]*(\d+)\s*(?:cm|mm)?/i);
      if (bhMatch) {
        const widthMm = parseInt(bhMatch[1], 10);
        const heightMm = parseInt(bhMatch[2], 10);
        if (widthMm < MIN_DIMENSION_MM || widthMm > MAX_DIMENSION_MM || heightMm < MIN_DIMENSION_MM || heightMm > MAX_DIMENSION_MM) {
          return {
            dimensionSpec: { type: 'piece_service', unit },
            formattedDim: null,
            source: 'fallback_default',
          };
        }
        const areaM2 = Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;
        return {
          dimensionSpec: {
            type: 'window_2d',
            widthMm,
            heightMm,
            areaM2,
          },
          formattedDim: `${widthMm} × ${heightMm}`,
          source,
        };
      }

      // B. Kruismaat syntax: 140x220cm, 850 × 1200 mm, 1800 × 2400
      const crossMatch = text.replace(/×/g, 'x').match(/(\d+)\s*x\s*(\d+)\s*(cm|mm)?/i);
      if (crossMatch) {
        const u = crossMatch[3]?.toLowerCase();
        let widthMm = parseInt(crossMatch[1], 10);
        let heightMm = parseInt(crossMatch[2], 10);

        if (u === 'cm' || (!u && widthMm <= 500 && heightMm <= 500)) {
          widthMm *= 10;
          heightMm *= 10;
        }

        if (widthMm < MIN_DIMENSION_MM || widthMm > MAX_DIMENSION_MM || heightMm < MIN_DIMENSION_MM || heightMm > MAX_DIMENSION_MM) {
          return {
            dimensionSpec: { type: 'piece_service', unit },
            formattedDim: null,
            source: 'fallback_default',
          };
        }

        const areaM2 = Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;
        return {
          dimensionSpec: {
            type: 'window_2d',
            widthMm,
            heightMm,
            areaM2,
          },
          formattedDim: `${widthMm} × ${heightMm}`,
          source,
        };
      }
    }

    return null;
  }
}

export const dimensionExtractionEngine = new DimensionExtractionEngine();
