import { 
  CanonicalSeedProduct, 
  ProductCapability, 
  CapabilityOption, 
  DomainCategory, 
  ItemRole 
} from './canonical-catalog';
import { FtsProductRow } from '@/lib/supabase/client';

/**
 * Regex definities voor robuuste categorisatie en uitsluiting
 */
const FLOOR_CATEGORY_REGEX = /\b(?:tapijt|vloer|vloeren|vloerbedekking|vinyl|pvc|laminaat|parket|karpet)\b/i;
const INSECT_SCREEN_REGEX = /\b(?:hor|horren|hordeur|hordeuren|inzethor|inzethorren|inklemhor|inklemhorren|rolhor|rolhorren|plissehor|plissehordeur)\b/i;
const ACCESSORY_REGEX = /\b(?:klemsteun|klemsteunen|stang|stangen|onderdeel|onderdelen|montageset|bevestiging|steun|steunen|profiel|profielen|adapter|accessoire|accessoires|toebehor|toebehoren|stalenboek|staalboek|collectieboek|staalkaart|stofstaal|kleurenstaal|monster|staalaanvraag)\b/i;
const SERVICE_REGEX = /\b(?:plaatsen|monteren|montage\s+arbeid|inmeten|meten|advies|reparatie|stofferen|service)\b/i;
const DISCONTINUED_REGEX = /\b(?:uitlopend|uitlopende(?:\s+collectie)?)\b/i;

/**
 * Canonieke synoniemen mapping ter voorkoming van FTS meervoud/variant mismatch
 */
export const CANONICAL_SYNONYMS: Record<string, string[]> = {
  DUETTE_SHADE: ['duette', 'duettes', 'duet', 'duette gordijn', 'duette raam'],
  PLISSE_SHADE: ['plisse', 'plissé', 'plisségordijn', 'plissegordijn', 'plisses'],
  TAPIJT: ['tapijt', 'vloerbedekking'],
  HOR: ['hor', 'horren', 'insectenhor', 'inzethor', 'plissehor']
};

/**
 * Bepaalt het overkoepelende domein op basis van ERP categorie en artikelnaam.
 * Om valse categorisatie door marketingtermen in de vrije beschrijving (bv. "van vloer tot plafond",
 * "inclusief profiel") te voorkomen, worden categorieën uitsluitend geëvalueerd op cat en name.
 */
export function resolveDomainCategory(rawCategory: string, name: string, fullText: string): DomainCategory {
  const cat = (rawCategory || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();
  const text = (fullText || '').toLowerCase();

  // 1. Vloeren inspectie (strikt op cat en name om "van vloer tot plafond" bij raambekleding niet te raken)
  if (FLOOR_CATEGORY_REGEX.test(cat) || FLOOR_CATEGORY_REGEX.test(lowerName)) {
    return 'VLOEREN';
  }

  // 2. Diensten inspectie
  if (SERVICE_REGEX.test(cat) || SERVICE_REGEX.test(lowerName)) {
    return 'DIENSTEN';
  }

  // 3. Accessoires inspectie:
  // Regex op categorie en naam; alleen expliciete 'toebehor' of staalboeken/monsters worden in de beschrijving gezocht
  const isToebehorenOrSample = /\b(?:toebehor|toebehoren|stalenboek|collectieboek|staalkaart|monster)\b/i.test(text);
  if (
    cat.includes('accessoire') || 
    cat.includes('toebehor') || 
    ACCESSORY_REGEX.test(cat) || 
    ACCESSORY_REGEX.test(lowerName) || 
    isToebehorenOrSample
  ) {
    return 'ACCESSOIRES';
  }

  // 4. Insectenhorren inspectie: expliciete uitsluiting van 'horizonta' en 'toebehor'
  const isHorizontaal = lowerName.includes('horizonta') || cat.includes('horizonta');
  const isToebehoren = cat.includes('toebehor') || lowerName.includes('toebehor') || isToebehorenOrSample;
  if (!isHorizontaal && !isToebehoren && (INSECT_SCREEN_REGEX.test(cat) || INSECT_SCREEN_REGEX.test(lowerName))) {
    return 'HORREN';
  }

  // 5. Raambekleding inspectie
  if (
    cat.includes('raam') || 
    cat.includes('gordijn') || 
    cat.includes('luxaflex') || 
    isHorizontaal ||
    /\b(?:duette|plisse|plissé|jaloezie|lamel|rolgordijn|vouwgordijn|silhouet|silhouette)\b/i.test(lowerName)
  ) {
    return 'RAAMBEKLEDING';
  }

  return 'UNCLASSIFIED';
}

/**
 * Bepaalt de rol van het artikel (Hoofdproduct vs Accessoire vs Dienst)
 */
export function resolveItemRole(domain: DomainCategory, name: string): ItemRole {
  if (domain === 'DIENSTEN') return 'SERVICE';
  if (domain === 'ACCESSOIRES') return 'ACCESSORY';
  if (ACCESSORY_REGEX.test(name)) return 'ACCESSORY';
  if (SERVICE_REGEX.test(name)) return 'SERVICE';
  if (domain === 'UNCLASSIFIED') return 'UNKNOWN';
  return 'PRODUCT';
}

/**
 * Bepaalt het specifieke entity type.
 */
export function resolveEntityType(name: string, domain: DomainCategory, itemRole: ItemRole): string {
  const lowerName = name.toLowerCase();

  // Diensten-guard: voorkomt dat "Stalen service plissé shades" per ongeluk PLISSE_SHADE wordt
  if (itemRole === 'SERVICE' || domain === 'DIENSTEN') {
    return 'SERVICE';
  }

  if (itemRole === 'ACCESSORY') {
    if (lowerName.includes('klemsteun')) return 'KLEMSTEUN_ACCESSOIRE';
    return 'GENERIC_ACCESSORY';
  }

  if (domain === 'VLOEREN') {
    return 'TAPIJT';
  }

  if (domain === 'HORREN') {
    return 'HOR';
  }

  if (lowerName.includes('duette')) return 'DUETTE_SHADE';
  if (lowerName.includes('plisse') || lowerName.includes('plissé')) return 'PLISSE_SHADE';
  if (lowerName.includes('jaloezie')) return 'JALOEZIE';
  if (lowerName.includes('rolgordijn')) return 'ROLGORDIJN';

  return 'GENERIC_PRODUCT';
}

/**
 * Lost de canonieke basisprijs op.
 * Accessoires en diensten krijgen NOOIT de € 861.02 basisprijs van Duette hoofdproducten!
 */
export function resolveBaselinePrice(
  code: string, 
  rawPrice: number, 
  entityType: string, 
  name: string, 
  itemRole: ItemRole
): number {
  if (rawPrice > 0) return rawPrice;

  // Accessoires en diensten mogen nooit een synthetische hoofdproduct-prijs krijgen
  if (itemRole === 'ACCESSORY' || itemRole === 'SERVICE') {
    return 0.0;
  }

  // Canonieke geijkte basis adviesprijzen voor raambekleding hoofdproducten bij data-gaps
  if (entityType === 'DUETTE_SHADE' || code === 'A00052469' || (code === '52469' && name.toLowerCase().includes('duette'))) {
    return 861.02;
  }

  if (entityType === 'PLISSE_SHADE') {
    return 420.00;
  }

  return 0.0;
}

/**
 * Discrete capabilities voor Duette® shades conform Bron A SSOT regels.
 * Exact conform CapabilityOption en ProductCapability interfaces uit Tranche 1.
 * Keys zijn 100% uitgelijnd met ConclaafRulesEngine SSOT ('STANDAARD').
 */
export const DUETTE_CAPABILITIES: ProductCapability[] = [
  {
    dimension: 'MONTAGE',
    options: [
      {
        stepId: 'MONTAGE',
        key: 'KLEMSTEUNEN',
        name: 'Klemsteunen op draai-kiepraam',
        surchargeEur: 24.50,
        isMacro: true,
        triggerTokens: ['klem', 'klemsteun', 'klemsteunen', 'draai', 'draaikiep', 'draai-kiep', 'kiep', 'kiepraam']
      },
      {
        stepId: 'MONTAGE',
        key: 'MONTAGE_TRUFIT',
        name: 'TruFit® (Plakprofiel draai-kiepraam)',
        surchargeEur: 68.50,
        isMacro: true,
        triggerTokens: ['trufit', 'plakprofiel', 'plak', 'plakstrip', 'zonder boren', 'geen boren', 'draai', 'draaikiep', 'draai-kiep', 'kiep', 'kiepraam']
      },
      {
        stepId: 'MONTAGE',
        key: 'STANDAARD',
        name: 'Standaard wand-/plafondmontage',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['standaard', 'schroef', 'schroeven', 'wand', 'plafond', 'in de dag', 'op de dag']
      }
    ]
  },
  {
    dimension: 'BEDIENINGS_TYPE',
    options: [
      {
        stepId: 'BEDIENINGS_TYPE',
        key: 'SMARTCORD',
        name: 'SmartCord® bediening (intrekbaar koord)',
        surchargeEur: 37.19,
        isMacro: true,
        triggerTokens: ['smartcord', 'smart', 'cord']
      },
      {
        stepId: 'BEDIENINGS_TYPE',
        key: 'POWERVIEW',
        name: 'PowerView® Automation motorbediening',
        surchargeEur: 185.00,
        isMacro: true,
        triggerTokens: ['powerview', 'motor', 'elektrisch', 'app', 'afstandsbediening', 'accu']
      },
      {
        stepId: 'BEDIENINGS_TYPE',
        key: 'STANDAARD',
        name: 'Standaard koordbediening',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['koord', 'handmatig', 'standaard']
      }
    ]
  },
  {
    dimension: 'VORM',
    options: [
      {
        stepId: 'VORM',
        key: ':20',
        name: 'Top-Down / Bottom-Up (:20)',
        surchargeEur: 37.19,
        isMacro: true,
        triggerTokens: [':20', '20', 'top-down', 'top down', 'bottom up', 'tdbu']
      },
      {
        stepId: 'VORM',
        key: ':10',
        name: 'Standaard Vrijhangend (:10)',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: [':10', '10', 'standaard', 'vrijhangend']
      }
    ]
  },
  {
    dimension: 'STOF_KLEUR',
    options: [
      {
        stepId: 'STOF_KLEUR',
        key: 'ELAN_101',
        name: 'Elan Zuiver Wit (101)',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['wit', 'white', 'helderwit']
      },
      {
        stepId: 'STOF_KLEUR',
        key: 'BATISTE_202',
        name: 'Elan Antraciet (201)',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['antraciet', 'grijs', 'donkergrijs']
      },
      {
        stepId: 'STOF_KLEUR',
        key: 'BLACKOUT_301',
        name: 'Elan Verduisterend Zwart (301)',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['zwart', 'black', 'verduisterend']
      }
    ]
  }
];

/**
 * Discrete capabilities voor Plissé® shades conform Bron A SSOT regels.
 */
export const PLISSE_CAPABILITIES: ProductCapability[] = [
  {
    dimension: 'MONTAGE',
    options: [
      {
        stepId: 'MONTAGE',
        key: 'KLEMSTEUNEN',
        name: 'Klemsteunen op draai-kiepraam',
        surchargeEur: 24.50,
        isMacro: true,
        triggerTokens: ['klem', 'klemsteun', 'klemsteunen', 'draai', 'draaikiep', 'draai-kiep', 'kiep', 'kiepraam']
      },
      {
        stepId: 'MONTAGE',
        key: 'MONTAGE_TRUFIT',
        name: 'TruFit® (Plakprofiel draai-kiepraam)',
        surchargeEur: 68.50,
        isMacro: true,
        triggerTokens: ['trufit', 'plakprofiel', 'plak', 'plakstrip', 'zonder boren', 'geen boren', 'draai', 'draaikiep', 'draai-kiep', 'kiep', 'kiepraam']
      },
      {
        stepId: 'MONTAGE',
        key: 'STANDAARD',
        name: 'Standaard wand-/plafondmontage',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['standaard', 'schroef', 'schroeven', 'wand', 'plafond', 'in de dag', 'op de dag']
      }
    ]
  },
  {
    dimension: 'BEDIENINGS_TYPE',
    options: [
      {
        stepId: 'BEDIENINGS_TYPE',
        key: 'SMARTCORD',
        name: 'SmartCord® bediening (intrekbaar koord)',
        surchargeEur: 37.19,
        isMacro: true,
        triggerTokens: ['smartcord', 'smart', 'cord']
      },
      {
        stepId: 'BEDIENINGS_TYPE',
        key: 'STANDAARD',
        name: 'Standaard ketting-/koordbediening',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['koord', 'ketting', 'handmatig', 'standaard']
      }
    ]
  },
  {
    dimension: 'VORM',
    options: [
      {
        stepId: 'VORM',
        key: ':20',
        name: 'Top-Down / Bottom-Up (:20)',
        surchargeEur: 37.19,
        isMacro: true,
        triggerTokens: [':20', '20', 'top-down', 'top down', 'bottom up', 'tdbu']
      },
      {
        stepId: 'VORM',
        key: ':10',
        name: 'Standaard Vrijhangend (:10)',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: [':10', '10', 'standaard', 'vrijhangend']
      }
    ]
  },
  {
    dimension: 'STOF_KLEUR',
    options: [
      {
        stepId: 'STOF_KLEUR',
        key: 'ELAN_101',
        name: 'Elan Zuiver Wit (101)',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['wit', 'white', 'helderwit']
      },
      {
        stepId: 'STOF_KLEUR',
        key: 'BATISTE_202',
        name: 'Elan Antraciet (201)',
        surchargeEur: 0,
        isMacro: false,
        triggerTokens: ['antraciet', 'grijs', 'donkergrijs']
      }
    ]
  }
];

/**
 * Verrijkt een ruwe FtsProductRow uit Supabase tot een volwaardig CanonicalSeedProduct.
 */
export function mapFtsRowToCanonicalProduct(row: FtsProductRow): CanonicalSeedProduct {
  const fullText = `${row.name || ''} ${row.description || ''} ${row.sales_group || ''}`;
  const domain = resolveDomainCategory(row.sales_group || '', row.name || '', fullText);
  const itemRole = resolveItemRole(domain, row.name || '');
  const entityType = resolveEntityType(row.name || '', domain, itemRole);

  const rawSalesPrice = typeof row.sales_price === 'number' 
    ? row.sales_price 
    : parseFloat(String(row.sales_price || '0')) || 0;

  const resolvedPrice = resolveBaselinePrice(
    row.code || '', 
    rawSalesPrice, 
    entityType, 
    row.name || '', 
    itemRole
  );

  let capabilities: ProductCapability[] = [];
  if (itemRole === 'PRODUCT') {
    if (entityType === 'DUETTE_SHADE') {
      capabilities = DUETTE_CAPABILITIES;
    } else if (entityType === 'PLISSE_SHADE') {
      capabilities = PLISSE_CAPABILITIES;
    }
  }

  // Behoud van PostgreSQL text[] groups array uit Supabase
  const groups = Array.isArray(row.groups) && row.groups.length > 0
    ? [...row.groups]
    : (row.sales_group ? [row.sales_group] : []);

  const synonyms = CANONICAL_SYNONYMS[entityType] ? [...CANONICAL_SYNONYMS[entityType]] : [];

  // Robuuste discontinued-detectie: controleer zowel het optionele boolean veld als tekstuele indicators in de ERP beschrijving
  const isDiscontinued = Boolean(
    row.is_discontinued ||
    DISCONTINUED_REGEX.test(`${row.name || ''} ${row.description || ''}`)
  );

  return {
    id: row.id,
    code: row.code || `LT-${row.id}`,
    name: row.name || 'Onbekend artikel',
    description: row.description || '',
    unit: row.unit || 'Stuk',
    salesPrice: resolvedPrice,
    salesGroup: row.sales_group || 'Overig',
    supplierName: row.supplier_name || 'Onbekend',
    supplierId: row.supplier_id ?? null,
    groups,
    vatCode: 'HOOG',
    domain,
    itemRole,
    entityType,
    brand: row.supplier_name || 'Generiek',
    capabilities,
    synonyms,
    isDiscontinued
  };
}
