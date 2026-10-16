/**
 * Canonical Seed Catalogus voor V2 Greenfield Cognitive CPQ Search Engine
 * 
 * Voldoet aan:
 * - Grondwet Laag 1B § 6 (Things & Capabilities, not Strings)
 * - INV-GOV-21 (Monetary CPQ SSOT Isolation: toeslagen gesynchroniseerd met Bron A SSOT)
 * - State Sanitation: Immutability via deepFreeze en asynchrone CatalogProvider interface
 */

export type DomainCategory = 
  | 'RAAMBEKLEDING'
  | 'VLOEREN'
  | 'HORREN'
  | 'ACCESSOIRES'
  | 'DIENSTEN'
  | 'UNCLASSIFIED';

export type ItemRole = 'PRODUCT' | 'ACCESSORY' | 'SERVICE' | 'UNKNOWN';

export interface CapabilityOption {
  stepId: string;          // Formele SSOT stap (bv. 'MONTAGE', 'BEDIENINGS_TYPE', 'VORM', 'STOF_KLEUR')
  key: string;             // Bron A SSOT key (bv. 'KLEMSTEUNEN', 'MONTAGE_TRUFIT', ':20', 'ELAN_101')
  name: string;            // Menselijk leesbaar label (bv. 'Klemsteunen op draai-kiepraam')
  surchargeEur: number;    // Cent-safe Bron A optietoeslag (bv. 24.50, 68.50)
  isMacro: boolean;        // true = discrete kandidaat als X <= 3; false = micro-optie of standaard
  triggerTokens: string[]; // Zoektermen die deze capability activeren
}

export interface ProductCapability {
  dimension: string;       // 'MONTAGE' | 'BEDIENINGS_TYPE' | 'VORM' | 'STOF_KLEUR'
  options: CapabilityOption[];
}

export interface CanonicalSeedProduct {
  id: number;               // Canoniek numeriek ERP artikel ID (bv. 52469)
  code: string;             // Unieke SKU code (bv. "A00052469")
  name: string;             // Officiële artikelnaam (bv. "Duette® shade")
  description?: string;
  unit: string;             // Basiseenheid (bv. "Stuk", "m2")
  salesPrice: number;       // Onbewerkte basis adviesprijs (bv. 861.02)
  salesGroup: string;       // ERP verkoopgroep
  supplierName: string;     // Leverancier (bv. "Luxaflex")
  supplierId: number | null;// Leverancier ID
  groups: string[];         // Canonieke categorie-mappen
  vatCode: string;          // BTW-code (bv. "HOOG")
  domain: DomainCategory;   // Domeinclassificatie
  itemRole: ItemRole;       // Rol van het artikel (Hoofdproduct vs los onderdeel)
  entityType: string;       // Bv. "DUETTE_SHADE", "TAPIJT", "KLEMSTEUN_ACCESSOIRE"
  brand: string;            // Bv. "Luxaflex", "Interfloor"
  capabilities: ProductCapability[];
  synonyms?: string[];      // Alternatieve benamingen / meervouden
  isDiscontinued?: boolean;
}

export interface CatalogProvider {
  getCatalog(): Promise<CanonicalSeedProduct[]>;
  getProductById(id: number): Promise<CanonicalSeedProduct | null>;
  findProducts(predicate?: (p: CanonicalSeedProduct) => boolean): Promise<CanonicalSeedProduct[]>;
}

export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export const CANONICAL_SEED_CATALOG: CanonicalSeedProduct[] = [
  {
    id: 52469,
    code: 'A00052469',
    name: 'Duette® shade',
    description: 'Luxaflex Duette® shade 25mm plissébekleding op maat',
    unit: 'Stuk',
    salesPrice: 861.02,
    salesGroup: 'Duette',
    supplierName: 'Luxaflex',
    supplierId: 101,
    groups: ['Raambekleding', 'Duette Shades'],
    vatCode: 'HOOG',
    domain: 'RAAMBEKLEDING',
    itemRole: 'PRODUCT',
    entityType: 'DUETTE_SHADE',
    brand: 'Luxaflex',
    synonyms: ['duette', 'duettes', 'duet', 'duette gordijn', 'duette raam'],
    capabilities: [
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
            triggerTokens: ['trufit', 'plakprofiel', 'plak', 'zonder boren', 'draai', 'draaikiep', 'draai-kiep', 'kiep', 'kiepraam']
          },
          {
            stepId: 'MONTAGE',
            key: 'STANDAARD',
            name: 'Standaard wand-/plafondmontage',
            surchargeEur: 0,
            isMacro: false,
            triggerTokens: ['standaard', 'schroeven', 'wand', 'plafond']
          }
        ]
      },
      {
        dimension: 'BEDIENINGS_TYPE',
        options: [
          {
            stepId: 'BEDIENINGS_TYPE',
            key: 'SMARTCORD',
            name: 'SmartCord® bediening',
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
            triggerTokens: ['powerview', 'motor', 'elektrisch', 'accu', 'motorbediening']
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
            triggerTokens: ['top-down', 'topdown', 'vrijhangend', '20', ':20']
          },
          {
            stepId: 'VORM',
            key: ':10',
            name: 'Standaard Bottom-Up (:10)',
            surchargeEur: 0,
            isMacro: false,
            triggerTokens: ['bottom-up', '10', ':10', 'standaard']
          }
        ]
      },
      {
        dimension: 'STOF_KLEUR',
        options: [
          { stepId: 'STOF_KLEUR', key: 'ELAN_101', name: 'Elan Helderwit', surchargeEur: 0, isMacro: false, triggerTokens: ['wit', 'white', 'helderwit'] },
          { stepId: 'STOF_KLEUR', key: 'ELAN_102', name: 'Elan Gebroken wit', surchargeEur: 0, isMacro: false, triggerTokens: ['offwhite', 'creme', 'gebroken wit'] },
          { stepId: 'STOF_KLEUR', key: 'BATISTE_201', name: 'Batiste Lichtgrijs', surchargeEur: 0, isMacro: false, triggerTokens: ['grijs', 'lichtgrijs'] },
          { stepId: 'STOF_KLEUR', key: 'BATISTE_202', name: 'Batiste Antraciet', surchargeEur: 0, isMacro: false, triggerTokens: ['antraciet', 'donkergrijs'] },
          { stepId: 'STOF_KLEUR', key: 'BLACKOUT_301', name: 'Blackout Verduisterend Zwart', surchargeEur: 0, isMacro: false, triggerTokens: ['zwart', 'black', 'verduisterend'] }
        ]
      }
    ]
  },
  {
    id: 52470,
    code: 'A00052470',
    name: 'Plissé shade',
    description: 'Luxaflex Plissé shade 20mm enkele stof',
    unit: 'Stuk',
    salesPrice: 420.00,
    salesGroup: 'Plisse',
    supplierName: 'Luxaflex',
    supplierId: 101,
    groups: ['Raambekleding', 'Plisse Shades'],
    vatCode: 'HOOG',
    domain: 'RAAMBEKLEDING',
    itemRole: 'PRODUCT',
    entityType: 'PLISSE_SHADE',
    brand: 'Luxaflex',
    synonyms: ['plisse', 'plissé', 'plisségordijn', 'plissegordijn'],
    capabilities: [
      {
        dimension: 'MONTAGE',
        options: [
          {
            stepId: 'MONTAGE',
            key: 'KLEMSTEUNEN',
            name: 'Klemsteunen op draai-kiepraam',
            surchargeEur: 24.50,
            isMacro: true,
            triggerTokens: ['klem', 'klemsteun', 'klemsteunen', 'draai', 'draaikiep', 'draai-kiep', 'kiep']
          },
          {
            stepId: 'MONTAGE',
            key: 'MONTAGE_TRUFIT',
            name: 'TruFit® (Plakprofiel draai-kiepraam)',
            surchargeEur: 68.50,
            isMacro: true,
            triggerTokens: ['trufit', 'plakprofiel', 'plak', 'zonder boren', 'draai', 'draaikiep', 'draai-kiep', 'kiep']
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
            triggerTokens: ['top-down', 'topdown', '20', ':20']
          }
        ]
      }
    ]
  },
  {
    id: 61001,
    code: 'ACC-KLEM-01',
    name: 'Luxaflex Klemsteun set',
    description: 'Losse klemsteunenset voor montage op draai-kiepramen zonder boren',
    unit: 'Set',
    salesPrice: 24.50,
    salesGroup: 'Onderdelen',
    supplierName: 'Luxaflex',
    supplierId: 101,
    groups: ['Onderdelen', 'Montagebeslag'],
    vatCode: 'HOOG',
    domain: 'ACCESSOIRES',
    itemRole: 'ACCESSORY',
    entityType: 'KLEMSTEUN_ACCESSOIRE',
    brand: 'Luxaflex',
    synonyms: ['klemsteun', 'klemsteunen', 'klemsteun set', 'klemhouder'],
    capabilities: []
  },
  {
    id: 71001,
    code: 'VLOER-400-DUETTE',
    name: '400 Ab Duette Tapijt',
    description: 'Interfloor kamerbreed tapijt 400cm breed',
    unit: 'm1',
    salesPrice: 89.95,
    salesGroup: 'Tapijt',
    supplierName: 'Interfloor',
    supplierId: 202,
    groups: ['Vloeren', 'Tapijt'],
    vatCode: 'HOOG',
    domain: 'VLOEREN',
    itemRole: 'PRODUCT',
    entityType: 'TAPIJT',
    brand: 'Interfloor',
    synonyms: ['tapijt duette', 'duette vloerbedekking', 'duette tapijt'],
    capabilities: [
      {
        dimension: 'KLEUR',
        options: [
          { stepId: 'KLEUR', key: 'ANTRACIET', name: 'Antraciet', surchargeEur: 0, isMacro: false, triggerTokens: ['antraciet'] },
          { stepId: 'KLEUR', key: 'BEIGE', name: 'Beige', surchargeEur: 0, isMacro: false, triggerTokens: ['beige'] }
        ]
      }
    ]
  },
  {
    id: 71002,
    code: 'VLOER-TAP-ANT',
    name: 'Interfloor Tapijt Antraciet',
    description: 'Interfloor projecttapijt hoogpolig antraciet',
    unit: 'm1',
    salesPrice: 65.00,
    salesGroup: 'Tapijt',
    supplierName: 'Interfloor',
    supplierId: 202,
    groups: ['Vloeren', 'Tapijt'],
    vatCode: 'HOOG',
    domain: 'VLOEREN',
    itemRole: 'PRODUCT',
    entityType: 'TAPIJT',
    brand: 'Interfloor',
    synonyms: ['tapijt antraciet', 'vloerbedekking antraciet', 'tapijt'],
    capabilities: []
  },
  {
    id: 99999,
    code: 'UNK-ERP-001',
    name: 'Onbekend ERP artikel',
    description: 'Artikel met onvolledige ERP data zonder verkoopgroep of leverancier',
    unit: 'Stuk',
    salesPrice: 0.00,
    salesGroup: '',
    supplierName: '',
    supplierId: null,
    groups: [],
    vatCode: 'HOOG',
    domain: 'UNCLASSIFIED',
    itemRole: 'UNKNOWN',
    entityType: 'UNCLASSIFIED_ITEM',
    brand: '',
    capabilities: []
  }
];

export class InMemorySeedCatalogProvider implements CatalogProvider {
  private readonly catalog: readonly CanonicalSeedProduct[];

  constructor(seedData: CanonicalSeedProduct[] = CANONICAL_SEED_CATALOG) {
    // Forceer immutability via deepFreeze om side-effects en data-lekkage uit te sluiten
    this.catalog = deepFreeze(JSON.parse(JSON.stringify(seedData)) as CanonicalSeedProduct[]);
  }

  async getCatalog(): Promise<CanonicalSeedProduct[]> {
    return this.catalog as unknown as CanonicalSeedProduct[];
  }

  async getProductById(id: number): Promise<CanonicalSeedProduct | null> {
    const found = this.catalog.find(p => p.id === id);
    return found ? found : null;
  }

  async findProducts(predicate?: (p: CanonicalSeedProduct) => boolean): Promise<CanonicalSeedProduct[]> {
    if (!predicate) return this.catalog as unknown as CanonicalSeedProduct[];
    return deepFreeze(this.catalog.filter(predicate)) as unknown as CanonicalSeedProduct[];
  }
}
