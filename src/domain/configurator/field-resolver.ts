import { SearchResultItem } from '@/types/product';
import {
  ProductCategory,
  ConfiguratorSchema,
  ConfiguratorField
} from '@/types/configurator';

/**
 * Normaliseert tekst voor tolerante herkenning (diakrieten en hoofdletters verwijderen).
 */
function normalizeStr(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Detecteert de productgroep op basis van ERP metadata (salesGroup, groups en artikelnaam).
 * Geen enkele hardcoded koppeling: zuiver gebaseerd op de werkelijke ERP eigenschappen.
 */
export function detectProductCategory(item: SearchResultItem): ProductCategory {
  const normSalesGroup = normalizeStr(item.salesGroup);
  const normName = normalizeStr(item.name);
  const normGroups = (item.groups || []).map(normalizeStr).join(' ');

  const fullContext = `${normSalesGroup} ${normGroups} ${normName}`;

  // 1. Controleer eerst op gordijnen als salesGroup expliciet gordijn aangeeft
  if (normSalesGroup.includes('gordijn')) {
    return 'gordijnen';
  }

  // 2. Raamdecoratie trefwoorden (Duette, Plissé, Jaloezie, Rolgordijn, Hor, etc.)
  const windowDecoKeywords = [
    'raamdecoratie',
    'duette',
    'plisse',
    'shade',
    'rolgordijn',
    'jaloezie',
    'hor',
    'lamel',
    'vouwgordijn',
    'silhouette',
    'facette',
    'shutter'
  ];

  for (const kw of windowDecoKeywords) {
    if (fullContext.includes(kw)) {
      return 'raamdecoratie';
    }
  }

  // 3. Gordijnen trefwoorden (stoffen, vitrages, inbetweens)
  const curtainKeywords = [
    'gordijn',
    'vitrage',
    'inbetween',
    'velours',
    'overgordijn'
  ];

  for (const kw of curtainKeywords) {
    if (fullContext.includes(kw)) {
      return 'gordijnen';
    }
  }

  // 4. Vloeren trefwoorden (Tapijt, PVC, Laminaat, etc.)
  const flooringKeywords = [
    'vloer',
    'tapijt',
    'pvc',
    'laminaat',
    'parket',
    'vinyl',
    'karpet',
    'marmoleum'
  ];

  for (const kw of flooringKeywords) {
    if (fullContext.includes(kw)) {
      return 'vloeren';
    }
  }

  return 'algemeen';
}

/**
 * Genereert het dynamische veldenschema voor het geselecteerde artikel.
 * Garandeert dat gordijnen nooit naar "Top Down / Bottom Up" vragen,
 * en elk producttype uitsluitend zijn eigen logische velden heeft.
 */
export function resolveConfiguratorSchema(item: SearchResultItem): ConfiguratorSchema {
  const category = detectProductCategory(item);

  switch (category) {
    case 'raamdecoratie':
      return {
        category: 'raamdecoratie',
        categoryLabel: 'Raamdecoratie / Duette & Plissé',
        description: 'Geef de maatwerk breedte en hoogte in millimeters op, samen met de gewenste montagewijze en bedieningsoptie.',
        fields: [
          {
            key: 'breedte',
            label: 'Breedte',
            type: 'number',
            unit: 'mm',
            placeholder: 'bijv. 1200',
            required: true,
            min: 100,
            max: 5000,
            step: 1,
            helpText: 'Nauwkeurige breedtemaat van het raamkozijn in millimeters.'
          },
          {
            key: 'hoogte',
            label: 'Hoogte',
            type: 'number',
            unit: 'mm',
            placeholder: 'bijv. 1800',
            required: true,
            min: 100,
            max: 5000,
            step: 1,
            helpText: 'Nauwkeurige hoogtemaat van het raamkozijn in millimeters.'
          },
          {
            key: 'montagewijze',
            label: 'Montagewijze',
            type: 'select',
            required: true,
            defaultValue: 'in_de_dag',
            options: [
              { value: 'in_de_dag', label: 'In de dag' },
              { value: 'op_de_dag', label: 'Op de dag' }
            ],
            helpText: 'Montage tussen de muren (in de dag) of op de muur/kozijn (op de dag).'
          },
          {
            key: 'bediening',
            label: 'Bediening',
            type: 'select',
            required: true,
            defaultValue: 'handmatig',
            options: [
              { value: 'handmatig', label: 'Handmatig (greep/koord)' },
              { value: 'ketting', label: 'Kettingbediening' },
              { value: 'elektrisch', label: 'Elektrisch / Motor (PowerView/Somfy)' }
            ],
            helpText: 'Kies de gewenste aandrijving of bedieningsvorm.'
          }
        ]
      };

    case 'gordijnen':
      return {
        category: 'gordijnen',
        categoryLabel: 'Gordijnen & Gordijnstoffen',
        description: 'Geef de railbreedte en maakhoogte in millimeters op, samen met het gewenste plooitype.',
        fields: [
          {
            key: 'railbreedte',
            label: 'Railbreedte',
            type: 'number',
            unit: 'mm',
            placeholder: 'bijv. 2400',
            required: true,
            min: 100,
            max: 10000,
            step: 1,
            helpText: 'Totale lengte van de gordijnrail of roede in millimeters.'
          },
          {
            key: 'maakhoogte',
            label: 'Maakhoogte',
            type: 'number',
            unit: 'mm',
            placeholder: 'bijv. 2600',
            required: true,
            min: 100,
            max: 6000,
            step: 1,
            helpText: 'Afstand van de bovenzijde van de rail tot de gewenste onderkant in millimeters.'
          },
          {
            key: 'plooitype',
            label: 'Plooitype',
            type: 'select',
            required: true,
            defaultValue: 'enkele_plooi',
            options: [
              { value: 'enkele_plooi', label: 'Enkele plooi' },
              { value: 'dubbele_plooi', label: 'Dubbele plooi (vlinderplooi)' },
              { value: 'wave_plooi', label: 'Wave plooi' },
              { value: 'retourplooi', label: 'Retourplooi' }
            ],
            helpText: 'Het gewenste confectie- en confectieplooitype voor het gordijn.'
          }
        ]
      };

    case 'vloeren':
      return {
        category: 'vloeren',
        categoryLabel: 'Vloeren (Tapijt, PVC, Laminaat)',
        description: 'Geef het netto vloeroppervlakte in m² op. Standaard snijverlies van 10% wordt automatisch meegecalculeerd.',
        fields: [
          {
            key: 'oppervlakte',
            label: 'Oppervlakte',
            type: 'number',
            unit: 'm²',
            placeholder: 'bijv. 45.5',
            required: true,
            min: 0.1,
            max: 1000,
            step: 0.1,
            helpText: 'Netto gemeten vloeroppervlakte in vierkante meters.'
          },
          {
            key: 'snijverlies',
            label: 'Snijverlies',
            type: 'number',
            unit: '%',
            placeholder: '10',
            required: true,
            defaultValue: 10,
            min: 0,
            max: 50,
            step: 1,
            helpText: 'Aanbevolen snij- en zaagverliespercentage (standaard 10%).'
          }
        ]
      };

    case 'algemeen':
    default:
      return {
        category: 'algemeen',
        categoryLabel: 'Standaard Artikel',
        description: 'Algemeen artikel zonder specifieke maatwerkconfiguratie.',
        fields: [
          {
            key: 'aantal',
            label: 'Aantal',
            type: 'number',
            unit: item.unit || 'stuks',
            defaultValue: 1,
            required: true,
            min: 1,
            max: 9999,
            step: 1,
            helpText: 'Gewenst aantal te bestellen eenheden.'
          },
          {
            key: 'opmerking',
            label: 'Opmerking / Specificatie',
            type: 'text',
            placeholder: 'Optionele toelichting voor offerte',
            required: false,
            helpText: 'Vrije toelichting of specificatie voor dit artikel.'
          }
        ]
      };
  }
}
