/**
 * Knowledge Graph Binder voor V2 Greenfield Cognitive CPQ Search Engine
 * 
 * Voldoet aan:
 * - Grondwet Laag 1B § 6 (Things & Capabilities, not Strings)
 * - INV-GOV-21 (Monetary CPQ SSOT Isolation: salesPrice === basePriceEur, cent-safe float math)
 * - Discretisatie: Strikte dichotomie ($X <= 3$ discreet, $X > 3$ geconsolideerd)
 * - Anti-Cartesian Clutter Guard: Precedentie MONTAGE > BEDIENINGS_TYPE > VORM
 * - Bron A SSOT Zuiverheid: stofFilter voor micro-kleurselectie, geen corruptie van STOF_KLEUR.
 */

import { SearchResultItem, ModelPreset, ProductPreconfiguration } from '@/types/product';
import { CanonicalSeedProduct, CapabilityOption } from './canonical-catalog';
import { ParsedQueryTokens } from './query-intent-resolver';

export interface DiscretizedResultRow extends SearchResultItem {
  rowKey: string;             // Unieke React composite key: e.g. "A00052469::MONTAGE_KLEMSTEUNEN"
  baseProductId: number;      // Canoniek ERP artikel ID (bv. 52469, 100% identiek aan this.id)
  syntheticRowId?: number;    // Optionele numerieke hulpsleutel voor UI-renderers: baseProduct.id * 1000 + optionIndex
  basePriceEur: number;       // Onbewerkte basis adviesprijs (bv. 861.02)
  surchargeEur: number;       // Berekende CPQ optietoeslag conform Bron A (bv. 24.50)
  totalPriceEur: number;      // Cent-safe indicatieve som: Math.round((basePriceEur + surchargeEur) * 100) / 100 (bv. 885.52)
  preconfiguration: ProductPreconfiguration; // Volledige CPQ preselectie voor DynamicConfiguratorForm
}

/**
 * Anti-Cartesian Precedentiehiërarchie bij multidimensionale macro matches.
 * MONTAGE heeft hoogste hardware-specificiteit, gevolgd door bediening en vorm.
 */
const DIMENSION_PRECEDENCE: string[] = ['MONTAGE', 'BEDIENINGS_TYPE', 'VORM', 'STOF_KLEUR', 'KLEUR'];

/**
 * Cent-safe rounding conform IEEE 754 float math mitigatie
 */
export function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Controleert of een optie triggert op één van de gebruikers-tokens
 */
export function matchesOption(option: CapabilityOption, tokens: string[]): boolean {
  if (!tokens || tokens.length === 0) return false;
  return tokens.some(token => {
    const t = token.toLowerCase();
    return option.triggerTokens.some(trigger => trigger.toLowerCase() === t || trigger.toLowerCase().includes(t));
  });
}

/**
 * Converteert een CanonicalSeedProduct naar een basis SearchResultItem
 */
export function toBaseSearchResultItem(product: CanonicalSeedProduct): SearchResultItem {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description || '',
    unit: product.unit,
    salesPrice: product.salesPrice,
    salesGroup: product.salesGroup,
    supplierName: product.supplierName,
    supplierId: product.supplierId,
    groups: [...product.groups],
    vatCode: product.vatCode,
    isDiscontinued: product.isDiscontinued ?? false
  };
}

/**
 * Knoopt intent-tokens aan product-capabilities en genereert discrete rijen (X <= 3)
 * of geconsolideerde rijen (X > 3) conform de CPQ specificaties.
 */
export function discretizeSearchResults(
  product: CanonicalSeedProduct,
  intent: ParsedQueryTokens
): DiscretizedResultRow[] {
  const baseItem = toBaseSearchResultItem(product);
  const basePrice = product.salesPrice || 0;

  // 1. Onderzoek welke capabilities matchen met de zoek-tokens
  const matchingDimensions: { dimension: string; options: CapabilityOption[] }[] = [];
  const microFilterBadges: string[] = [];
  const basePreconfiguration: ProductPreconfiguration = {};

  // Behandel micro-opties (bv. kleur 'wit', 'antraciet')
  for (const cap of product.capabilities) {
    if (cap.dimension === 'STOF_KLEUR' || cap.dimension === 'KLEUR') {
      const matchedColor = cap.options.find(opt => matchesOption(opt, intent.attributeTokens));
      if (matchedColor) {
        microFilterBadges.push(`Kleurvoorkeur: ${matchedColor.name}`);
        // Bron A SSOT Zuiverheid: injecteer uitsluitend stofFilter om STOF_KLEUR step niet te corrumperen
        basePreconfiguration.stofFilter = matchedColor.name.toUpperCase().includes('WIT') ? 'WIT' : matchedColor.key;
      }
      continue;
    }

    // Macro-dimensies (MONTAGE, BEDIENINGS_TYPE, VORM)
    const matchedOptions = cap.options.filter(opt => opt.isMacro && matchesOption(opt, intent.attributeTokens));
    if (matchedOptions.length > 0) {
      matchingDimensions.push({ dimension: cap.dimension, options: matchedOptions });
    }
  }

  // 2. ModelPreset afhandeling (bv. AU20 / UA20)
  let modelPresetSurcharge = 0;
  if (intent.modelPreset && (product.entityType === 'DUETTE_SHADE' || product.entityType === 'PLISSE_SHADE')) {
    baseItem.modelPreset = { ...intent.modelPreset };
    modelPresetSurcharge = intent.modelPreset.surchargeEur || 0;
    if (intent.modelPreset.vorm) {
      basePreconfiguration.VORM = intent.modelPreset.vorm.startsWith(':') ? intent.modelPreset.vorm : `:${intent.modelPreset.vorm}`;
    }
    if (intent.modelPreset.bediening) {
      basePreconfiguration.BEDIENINGS_TYPE = intent.modelPreset.bediening.toUpperCase();
    }
  }

  // 3. Geen macro-opties gematcht? Retourneer 1 enkele geconsolideerde regel
  if (matchingDimensions.length === 0) {
    const surcharge = roundToCents(modelPresetSurcharge);
    const total = roundToCents(basePrice + surcharge);
    const badges = [...microFilterBadges];

    return [{
      ...baseItem,
      rowKey: `${product.code}::DEFAULT`,
      baseProductId: product.id,
      syntheticRowId: product.id * 1000 + 1,
      salesPrice: basePrice,
      basePriceEur: basePrice,
      surchargeEur: surcharge,
      totalPriceEur: total,
      featureBadges: badges.length > 0 ? badges : undefined,
      preconfiguration: { ...basePreconfiguration }
    }];
  }

  // 4. Anti-Cartesian Guard: Sorteer dimensies volgens precedentie MONTAGE > BEDIENINGS_TYPE > VORM
  matchingDimensions.sort((a, b) => {
    const idxA = DIMENSION_PRECEDENCE.indexOf(a.dimension);
    const idxB = DIMENSION_PRECEDENCE.indexOf(b.dimension);
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  // Primaire dimensie voor discretisatie
  const primaryDim = matchingDimensions[0];
  const secondaryDims = matchingDimensions.slice(1);

  // Secundaire dimensies landen als informatieve badges zonder premature toeslagen
  const secondaryBadges: string[] = [];
  const secondaryPreconf: ProductPreconfiguration = {};
  for (const sec of secondaryDims) {
    if (sec.options.length === 1) {
      const secOpt = sec.options[0];
      secondaryBadges.push(secOpt.name);
      secondaryPreconf[sec.dimension] = secOpt.key;
      // Dual-key backwards compatibility
      secondaryPreconf[sec.dimension.toLowerCase()] = secOpt.key;
    } else {
      // Meervoudige opties op secundaire dimensie: informatieve vermelding
      secondaryBadges.push(`${sec.dimension.toLowerCase()}: diverse opties`);
    }
  }

  // 5. Genereer discrete rijen langs de primaire dimensie (maximaal 3 rijen per basisartikel)
  const rows: DiscretizedResultRow[] = [];
  const candidateOptions = primaryDim.options.slice(0, 3);

  candidateOptions.forEach((option, idx) => {
    const optionIndex = idx + 1;
    const optionSurcharge = option.surchargeEur ?? 0;
    const totalSurcharge = roundToCents(modelPresetSurcharge + optionSurcharge);
    const totalPrice = roundToCents(basePrice + totalSurcharge);

    const rowBadges = [
      option.name, // Schone badge zónder "Voorgeselecteerd:" prefix!
      ...secondaryBadges,
      ...microFilterBadges
    ];

    const rowPreconf: ProductPreconfiguration = {
      ...basePreconfiguration,
      ...secondaryPreconf,
      [primaryDim.dimension]: option.key,
      [primaryDim.dimension.toLowerCase()]: option.key
    };

    rows.push({
      ...baseItem,
      rowKey: `${product.code}::${primaryDim.dimension}_${option.key}`,
      baseProductId: product.id,
      syntheticRowId: product.id * 1000 + optionIndex,
      salesPrice: basePrice, // Strikt onbewerkte basisprijs conform consumentencontract
      basePriceEur: basePrice,
      surchargeEur: totalSurcharge,
      totalPriceEur: totalPrice,
      featureBadges: rowBadges,
      preconfiguration: rowPreconf
    });
  });

  return rows;
}
