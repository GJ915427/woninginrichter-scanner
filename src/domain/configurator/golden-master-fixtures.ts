import { SearchResultItem } from '@/types/product';
import { ConfigurationStepType } from '@/domain/configurator/bron-a-contracts';

export interface GoldenExpectedOutput {
  status: 'valid' | 'invalid' | 'incomplete';
  stepCount: number;
  totalSurchargeEur?: number;
  expectedErrors?: { code: string; stepType?: string }[];
  expectedSteps?: {
    stepType: string;
    stepName?: string;
    required?: boolean;
    expectedValue?: string | number;
  }[];
  expectedCurtainMetrics?: {
    totalFabricWidthMeters: number;
    fullnessMultiplier: number;
  };
}

export interface GoldenVector {
  id: string;
  category: 'raamdecoratie' | 'gordijnen' | 'vloeren' | 'algemeen';
  description: string;
  product: SearchResultItem;
  inputs: {
    stepType: string;
    value: string | number;
  }[];
  expected: GoldenExpectedOutput;
}

export const GOLDEN_MASTER_VECTORS: GoldenVector[] = [
  // 1. Happy Path - Raamdecoratie: Duette standaard (A00052469)
  {
    id: 'duette-standard',
    category: 'raamdecoratie',
    description: 'Luxaflex Duette shade 25 mm met standaard handgreep en montage (€0 toeslag)',
    product: {
      id: 219609,
      code: 'A00052469',
      name: 'Luxaflex Duette® shade 25 mm',
      unit: 'stk',
      salesPrice: 285.0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 101,
      groups: ['Duette', 'Raamdecoratie'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'BREEDTE', value: 1000 },
      { stepType: 'HOOGTE', value: 1500 },
      { stepType: 'VORM', value: 'STANDAARD' },
      { stepType: 'MONTAGE', value: 'STANDAARD' },
      { stepType: 'BEDIENINGS_TYPE', value: 'HANDGREEP' },
      { stepType: 'STOF_KLEUR', value: 'ELAN_101' },
    ],
    expected: {
      status: 'valid',
      stepCount: 11,
      totalSurchargeEur: 0.0,
    },
  },

  // 2. Happy Path - Gordijnen: VLIET dubbele plooi & loodveter (0103960000)
  {
    id: 'curtain-double-pleat-lead',
    category: 'gordijnen',
    description: 'Gordijnstoffen VLIET met dubbele plooi (2.5x) en loodveter toeslag (€12,50)',
    product: {
      id: 161126,
      code: '0103960000',
      name: 'Gordijnstoffen VLIET 00',
      unit: 'm1',
      salesPrice: 42.5,
      salesGroup: 'Gordijnstoffen',
      supplierName: 'LOFT79',
      supplierId: 102,
      groups: ['Gordijnstoffen', 'Inbetween'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'BREEDTE', value: 2400 },
      { stepType: 'HOOGTE', value: 2600 },
      { stepType: 'PLOOISOORT', value: 'DUBBEL' },
      { stepType: 'LOODVETER', value: 'JA' },
      { stepType: 'OPENING', value: 'STEL' },
    ],
    expected: {
      status: 'valid',
      stepCount: 5,
      totalSurchargeEur: 12.5,
      expectedCurtainMetrics: {
        totalFabricWidthMeters: 6.0, // 2.4 * 2.5 = 6.0
        fullnessMultiplier: 2.5,
      },
    },
  },

  // 3. Happy Path - Vloeren: Novilon Viva Vinyl (VIN01)
  {
    id: 'flooring-vinyl-standard',
    category: 'vloeren',
    description: 'Novilon Viva Vinyl met 10% snijverlies en plakplint toeslag (€4,50)',
    product: {
      id: 401,
      code: 'VIN01',
      name: 'Novilon Viva Vinyl',
      unit: 'm2',
      salesPrice: 34.95,
      salesGroup: 'Vinyl',
      supplierName: 'Forbo',
      supplierId: 103,
      groups: ['Vloeren', 'Vinyl'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'OPPERVLAKTE', value: 35 },
      { stepType: 'SNIJVERLIES', value: '10_PROCENT' },
      { stepType: 'LEGWYZE', value: 'ZWEVEND' },
      { stepType: 'PLINTEN', value: 'PLAKPLINT' },
    ],
    expected: {
      status: 'valid',
      stepCount: 4,
      totalSurchargeEur: 4.5,
    },
  },

  // 4. Happy Path - Meubels: Het Anker Bank (BNK01)
  {
    id: 'furniture-sofa-assembly',
    category: 'algemeen',
    description: 'Het Anker Bank met standaard levering en montage service toeslag (€45,00)',
    product: {
      id: 201,
      code: 'BNK01',
      name: 'Bank 3-zits in Stof creme Brioni',
      unit: 'stk',
      salesPrice: 1250.0,
      salesGroup: 'Banken',
      supplierName: 'Het Anker',
      supplierId: 104,
      groups: ['Meubels', 'Zitmeubelen'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'AANTAL', value: 1 },
      { stepType: 'UITVOERING', value: 'STANDAARD' },
      { stepType: 'MONTAGE_SERVICE', value: 'UITPAKKEN_MONTEREN' },
    ],
    expected: {
      status: 'valid',
      stepCount: 3,
      totalSurchargeEur: 45.0,
    },
  },

  // 5. Edge Case - PowerView motorisering met Accu (€185 toeslag)
  {
    id: 'duette-powerview-accu',
    category: 'raamdecoratie',
    description: 'Luxaflex Duette met PowerView motor en geïntegreerde Accu (+€185,00)',
    product: {
      id: 219609,
      code: 'A00052469',
      name: 'Luxaflex Duette® shade 25 mm',
      unit: 'stk',
      salesPrice: 285.0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 101,
      groups: ['Duette', 'Raamdecoratie'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'BREEDTE', value: 1000 },
      { stepType: 'HOOGTE', value: 1500 },
      { stepType: 'MONTAGE', value: 'STANDAARD' },
      { stepType: 'BEDIENINGS_TYPE', value: 'POWERVIEW' },
      { stepType: 'VOEDINGSTYPE', value: 'ACCU' },
      { stepType: 'VOEDINGSZIJDE', value: 'RECHTS' },
      { stepType: 'STOF_KLEUR', value: 'ELAN_101' },
    ],
    expected: {
      status: 'valid',
      stepCount: 11,
      totalSurchargeEur: 185.0,
    },
  },

  // 6. Edge Case - PowerView motorisering met Transformator (€230 toeslag)
  {
    id: 'duette-powerview-transformator',
    category: 'raamdecoratie',
    description: 'Luxaflex Duette met PowerView motor en 230V Transformator (+€230,00)',
    product: {
      id: 219609,
      code: 'A00052469',
      name: 'Luxaflex Duette® shade 25 mm',
      unit: 'stk',
      salesPrice: 285.0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 101,
      groups: ['Duette', 'Raamdecoratie'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'BREEDTE', value: 1000 },
      { stepType: 'HOOGTE', value: 1500 },
      { stepType: 'MONTAGE', value: 'STANDAARD' },
      { stepType: 'BEDIENINGS_TYPE', value: 'POWERVIEW' },
      { stepType: 'VOEDINGSTYPE', value: 'TRANSFORMATOR' },
      { stepType: 'VOEDINGSZIJDE', value: 'LINKS' },
      { stepType: 'STOF_KLEUR', value: 'ELAN_101' },
    ],
    expected: {
      status: 'valid',
      stepCount: 11,
      totalSurchargeEur: 230.0,
    },
  },

  // 7. Edge Case - TruFit op maximale breedtelimiet (1280 mm)
  {
    id: 'duette-trufit-max-bound',
    category: 'raamdecoratie',
    description: 'Luxaflex Duette met TruFit op exact 1280 mm breedte (blijft valid, toeslag €68,50)',
    product: {
      id: 219609,
      code: 'A00052469',
      name: 'Luxaflex Duette® shade 25 mm',
      unit: 'stk',
      salesPrice: 285.0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 101,
      groups: ['Duette', 'Raamdecoratie'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'BREEDTE', value: 1280 },
      { stepType: 'HOOGTE', value: 1500 },
      { stepType: 'MONTAGE', value: 'MONTAGE_TRUFIT' },
      { stepType: 'BEDIENINGS_TYPE', value: 'HANDGREEP' },
      { stepType: 'PROFIELKLEUR', value: 'WIT' },
      { stepType: 'STOF_KLEUR', value: 'ELAN_101' },
    ],
    expected: {
      status: 'valid',
      stepCount: 11,
      totalSurchargeEur: 68.5,
      expectedErrors: [],
    },
  },

  // 8. Corner Case - TruFit breedte overschreden (1281 mm)
  {
    id: 'duette-trufit-exceeded',
    category: 'raamdecoratie',
    description: 'TruFit breedte van 1281 mm triggert ERR_TRUFIT_WIDTH_EXCEEDED',
    product: {
      id: 219609,
      code: 'A00052469',
      name: 'Luxaflex Duette® shade 25 mm',
      unit: 'stk',
      salesPrice: 285.0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 101,
      groups: ['Duette', 'Raamdecoratie'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'BREEDTE', value: 1281 },
      { stepType: 'HOOGTE', value: 1500 },
      { stepType: 'MONTAGE', value: 'MONTAGE_TRUFIT' },
      { stepType: 'PROFIELKLEUR', value: 'WIT' },
    ],
    expected: {
      status: 'invalid',
      stepCount: 11,
      expectedErrors: [{ code: 'ERR_TRUFIT_WIDTH_EXCEEDED' }],
    },
  },

  // 9. Corner Case - TruFit mechanische auto-correctie naar HANDGREEP
  {
    id: 'duette-trufit-chain-auto-correct',
    category: 'raamdecoratie',
    description: 'Selectie van MONTAGE_TRUFIT met initiële KETTING bediening dwingt HANDGREEP af',
    product: {
      id: 219609,
      code: 'A00052469',
      name: 'Luxaflex Duette® shade 25 mm',
      unit: 'stk',
      salesPrice: 285.0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 101,
      groups: ['Duette', 'Raamdecoratie'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'BREEDTE', value: 1000 },
      { stepType: 'HOOGTE', value: 1500 },
      { stepType: 'BEDIENINGS_TYPE', value: 'KETTING' },
      { stepType: 'MONTAGE', value: 'MONTAGE_TRUFIT' },
      { stepType: 'PROFIELKLEUR', value: 'WIT' },
      { stepType: 'STOF_KLEUR', value: 'ELAN_101' },
    ],
    expected: {
      status: 'valid',
      stepCount: 11,
      expectedSteps: [
        {
          stepType: 'BEDIENINGS_TYPE',
          expectedValue: 'HANDGREEP',
        },
      ],
      expectedErrors: [],
    },
  },

  // 10. Corner Case - Negatieve afmetingen vangen fail-closed op
  {
    id: 'duette-invalid-negative-dimension',
    category: 'raamdecoratie',
    description: 'Negatieve breedte (-500 mm) triggert ERR_OUT_OF_BOUNDS fail-closed',
    product: {
      id: 219609,
      code: 'A00052469',
      name: 'Luxaflex Duette® shade 25 mm',
      unit: 'stk',
      salesPrice: 285.0,
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex Nederland',
      supplierId: 101,
      groups: ['Duette', 'Raamdecoratie'],
      vatCode: 'H',
    },
    inputs: [
      { stepType: 'BREEDTE', value: -500 },
      { stepType: 'HOOGTE', value: 1500 },
    ],
    expected: {
      status: 'invalid',
      stepCount: 11,
      expectedErrors: [{ code: 'ERR_OUT_OF_BOUNDS' }],
    },
  },
];
