/**
 * Conclaaf Rules Engine (Bron A Consensus)
 * Synthese van Leger Alpha (Raamdecoratie & Horren) en Leger Beta (Gordijnen & Confectie)
 * Implementeert de deterministische regels, bounds en conditionele velden conform Bron A.
 * Ondersteunt de viervoudige categorie-architectuur: raamdecoratie, gordijnen, vloeren, algemeen.
 */

import { SearchResultItem } from '@/types/product';
import { ProductCategory } from '@/types/configurator';
export type { ProductCategory };
import {
  Configuration,
  ConfigurationStep,
  ConfigurationStepType,
  ConfigurationStepValue,
  ConfigurationError
} from './bron-a-contracts';

/**
 * Classificeert een artikel deterministisch naar een officiële productgroep
 * Hanteert een hiërarchische SSOT: salesGroup heeft prioriteit boven artikelnaam,
 * met expliciete uitsluiting van semantische collisies (zoals vloerlampen en meubelstoffen).
 */
export function determineProductCategory(item: SearchResultItem): ProductCategory {
  if (!item) return 'algemeen';

  const name = (item.name || '').toLowerCase();
  const salesGroup = (item.salesGroup || '').toLowerCase();
  const groups = Array.isArray(item.groups) ? item.groups.join(' ').toLowerCase() : '';
  const code = (item.code || '').toLowerCase();

  // 1. Primaire bron: salesGroup SSOT
  if (salesGroup) {
    if (
      salesGroup.includes('raamdecoratie') ||
      salesGroup.includes('luxaflex') ||
      salesGroup.includes('zonwering') ||
      salesGroup.includes('jaloezie') ||
      salesGroup.includes('horren') ||
      salesGroup.includes('duette') ||
      salesGroup.includes('plissé') ||
      salesGroup.includes('plisse')
    ) {
      return 'raamdecoratie';
    }
    if (
      salesGroup.includes('gordijn') ||
      salesGroup.includes('vitrage') ||
      salesGroup.includes('inbetween')
    ) {
      return 'gordijnen';
    }
    if (
      salesGroup.includes('vloer') ||
      salesGroup.includes('pvc') ||
      salesGroup.includes('laminaat') ||
      salesGroup.includes('parket') ||
      salesGroup.includes('tapijt') ||
      salesGroup.includes('vinyl') ||
      salesGroup.includes('karpet') ||
      salesGroup.includes('naaldvilt') ||
      salesGroup.includes('marmoleum')
    ) {
      return 'vloeren';
    }
    if (
      salesGroup.includes('banken') ||
      salesGroup.includes('stoelen') ||
      salesGroup.includes('tafels') ||
      salesGroup.includes('kasten') ||
      salesGroup.includes('meubels') ||
      salesGroup.includes('verlichting') ||
      salesGroup.includes('accessoires') ||
      salesGroup.includes('bedden') ||
      salesGroup.includes('boxspring')
    ) {
      return 'algemeen';
    }
  }

  // 2. Samengestelde tekst & groepen inspectie
  const combined = `${name} ${groups} ${code}`;

  // Prioriteit A: Samengestelde raamdecoratietermen (moeten VÓÓR gordijn-check geëvalueerd worden)
  if (
    combined.includes('rolgordijn') ||
    combined.includes('vouwgordijn') ||
    combined.includes('duette') ||
    combined.includes('plissé') ||
    combined.includes('plisse') ||
    combined.includes('jaloezie') ||
    combined.includes('raamdecoratie') ||
    combined.includes('luxaflex') ||
    combined.includes('lamel') ||
    combined.includes('hor ') ||
    combined.includes('horren')
  ) {
    return 'raamdecoratie';
  }

  // Prioriteit B: Gordijnen (let op uitsluiting meubelstof)
  const isFurniture =
    combined.includes('bank') ||
    combined.includes('stoel') ||
    combined.includes('fauteuil') ||
    combined.includes('lamp') ||
    combined.includes('tafel') ||
    combined.includes('kast');

  if (
    combined.includes('gordijn') ||
    combined.includes('vitrage') ||
    combined.includes('inbetween') ||
    (!isFurniture && combined.includes('gordijnstof')) ||
    (!isFurniture && combined.includes('stof') && !combined.includes('stofzuiger'))
  ) {
    return 'gordijnen';
  }

  // Prioriteit C: Vloeren (let op uitsluiting van vloerlampen)
  const isFloorLamp = combined.includes('vloerlamp');
  if (
    !isFloorLamp &&
    (combined.includes('vloer') ||
      combined.includes('pvc') ||
      combined.includes('laminaat') ||
      combined.includes('parket') ||
      combined.includes('tapijt') ||
      combined.includes('vinyl') ||
      combined.includes('karpet') ||
      combined.includes('naaldvilt') ||
      combined.includes('marmoleum'))
  ) {
    return 'vloeren';
  }

  return 'algemeen';
}

export class ConclaafRulesEngine {
  private product: SearchResultItem;
  private category: ProductCategory;
  private config: Configuration;

  constructor(product: SearchResultItem) {
    this.product = product;
    this.category = determineProductCategory(product);
    this.config = this.createInitialConfiguration();
    this.evaluateRules();
  }

  public getConfiguration(): Configuration {
    return this.config;
  }

  public getCategory(): ProductCategory {
    return this.category;
  }

  /**
   * Retourneert een diepe, ontkoppelde kopie van de configuratiestate
   * Garandeert nieuwe geheugenreferenties voor React 19 re-renders
   */
  public getImmutableSnapshot(): Configuration {
    return JSON.parse(JSON.stringify(this.config));
  }

  private createInitialConfiguration(): Configuration {
    // Deterministische sessie-ID afgeleid van artikelgegevens (elimineert SSR hydration mismatches)
    const guid = `sess_${this.product.code || 'art'}_${this.product.id || '0'}`;

    // Categorie 1: Gordijnen (Confectie)
    if (this.category === 'gordijnen') {
      return {
        configurationGuid: guid,
        articleCode: this.product.code,
        articleDescription: this.product.name,
        quantity: 1,
        steps: [
          {
            id: 'BREEDTE',
            description: 'Railbreedte',
            code: 'WIDTH',
            type: ConfigurationStepType.Numeric,
            sequence: 1,
            show: true,
            enabled: true,
            required: true,
            minValue: 500,
            maxValue: 10000,
            suffix: 'mm',
            value: '2000'
          },
          {
            id: 'HOOGTE',
            description: 'Maakhoogte',
            code: 'HEIGHT',
            type: ConfigurationStepType.Numeric,
            sequence: 2,
            show: true,
            enabled: true,
            required: true,
            minValue: 500,
            maxValue: 4000,
            suffix: 'mm',
            value: '2500'
          },
          {
            id: 'PLOOISOORT',
            description: 'Plooisoort',
            code: 'PLEAT',
            type: ConfigurationStepType.Select,
            sequence: 3,
            show: true,
            enabled: true,
            required: true,
            value: 'ENKEL',
            possibleValues: [
              { key: 'ENKEL', value: 'Enkele plooi (2.0x)', chargeAmount: 0 },
              { key: 'DUBBEL', value: 'Vlinderplooi / Dubbel (2.5x)', chargeAmount: 0 },
              { key: 'WAVE', value: 'Wave plooi (2.3x)', chargeAmount: 18.00 }
            ]
          },
          {
            id: 'LOODVETER',
            description: 'Onderzoom afwerking',
            code: 'HEM',
            type: ConfigurationStepType.Select,
            sequence: 4,
            show: true,
            enabled: true,
            required: true,
            value: 'NEE',
            possibleValues: [
              { key: 'NEE', value: 'Standaard zoom (onderzoom 10 cm)', chargeAmount: 0 },
              { key: 'JA', value: 'Loodveter / verzwaarde onderzoom', chargeAmount: 12.50 }
            ]
          },
          {
            id: 'OPENING',
            description: 'Sluiting & Stelwijze',
            code: 'SPLIT',
            type: ConfigurationStepType.Select,
            sequence: 5,
            show: true,
            enabled: true,
            required: true,
            value: 'STEL',
            possibleValues: [
              { key: 'STEL', value: 'Stel (2 gelijke delen vanuit midden)', chargeAmount: 0 },
              { key: 'LINKS', value: '1 deel naar links', chargeAmount: 0 },
              { key: 'RECHTS', value: '1 deel naar rechts', chargeAmount: 0 }
            ]
          }
        ],
        errors: []
      };
    }

    // Categorie 2: Vloeren (Oppervlakte, Snijverlies, Legwijze, Plinten)
    if (this.category === 'vloeren') {
      return {
        configurationGuid: guid,
        articleCode: this.product.code,
        articleDescription: this.product.name,
        quantity: 1,
        steps: [
          {
            id: 'OPPERVLAKTE',
            description: 'Te leggen oppervlakte',
            code: 'SURFACE_AREA',
            type: ConfigurationStepType.Numeric,
            sequence: 1,
            show: true,
            enabled: true,
            required: true,
            minValue: 1,
            maxValue: 1000,
            suffix: 'm²',
            value: '25'
          },
          {
            id: 'SNIJVERLIES',
            description: 'Snijverlies percentage',
            code: 'CUTTING_WASTE',
            type: ConfigurationStepType.Select,
            sequence: 2,
            show: true,
            enabled: true,
            required: true,
            value: '5_PROCENT',
            possibleValues: [
              { key: '5_PROCENT', value: '5% Snijverlies (Standaard recht leggen)', chargeAmount: 0 },
              { key: '10_PROCENT', value: '10% Snijverlies (Visgraat / Diagonaal leggen)', chargeAmount: 0 }
            ]
          },
          {
            id: 'LEGWYZE',
            description: 'Montagewijze / Legservice',
            code: 'FLOOR_INSTALL',
            type: ConfigurationStepType.Select,
            sequence: 3,
            show: true,
            enabled: true,
            required: true,
            value: 'ZWEVEND',
            possibleValues: [
              { key: 'ZWEVEND', value: 'Zwevend leggen met ondervloer', chargeAmount: 0 },
              { key: 'VERLIJMD', value: 'Volledig verlijmd op geëgaliseerde ondergrond', chargeAmount: 18.50 }
            ]
          },
          {
            id: 'PLINTEN',
            description: 'Plintafwerking',
            code: 'SKIRTING',
            type: ConfigurationStepType.Select,
            sequence: 4,
            show: true,
            enabled: true,
            required: true,
            value: 'GEEN',
            possibleValues: [
              { key: 'GEEN', value: 'Geen plinten', chargeAmount: 0 },
              { key: 'PLAKPLINT', value: 'Bijpassende plakplinten (+ € 4,50/m¹)', chargeAmount: 4.50 },
              { key: 'HOGE_MDF', value: 'Hoge MDF plinten 70mm wit (+ € 9,50/m¹)', chargeAmount: 9.50 }
            ]
          }
        ],
        errors: []
      };
    }

    // Categorie 3: Algemeen (Meubels, Verlichting, Accessoires)
    if (this.category === 'algemeen') {
      return {
        configurationGuid: guid,
        articleCode: this.product.code,
        articleDescription: this.product.name,
        quantity: 1,
        steps: [
          {
            id: 'AANTAL',
            description: 'Aantal stuks',
            code: 'QUANTITY',
            type: ConfigurationStepType.Numeric,
            sequence: 1,
            show: true,
            enabled: true,
            required: true,
            minValue: 1,
            maxValue: 100,
            suffix: 'stuks',
            value: '1'
          },
          {
            id: 'UITVOERING',
            description: 'Kleur- en Materiaaluitvoering',
            code: 'EXECUTION',
            type: ConfigurationStepType.Select,
            sequence: 2,
            show: true,
            enabled: true,
            required: true,
            value: 'STANDAARD',
            possibleValues: [
              { key: 'STANDAARD', value: 'Standaard fabrieksuitvoering', chargeAmount: 0 },
              { key: 'MAATWERK_KLEUR', value: 'Kleur naar wens / staaluitvoering', chargeAmount: 25.00 }
            ]
          },
          {
            id: 'MONTAGE_SERVICE',
            description: 'Bezorging & Montageservice',
            code: 'ASSEMBLY',
            type: ConfigurationStepType.Select,
            sequence: 3,
            show: true,
            enabled: true,
            required: true,
            value: 'STANDAARD_LEVERING',
            possibleValues: [
              { key: 'STANDAARD_LEVERING', value: 'Standaard levering (drempel)', chargeAmount: 0 },
              { key: 'UITPAKKEN_MONTEREN', value: 'Bezorgen, uitpakken, monteren en verpakking retour', chargeAmount: 45.00 }
            ]
          }
        ],
        errors: []
      };
    }

    // Categorie 4: Standaard Raamdecoratie (Hunter Douglas, Luxaflex, etc.)
    const presetVorm = this.product.modelPreset?.vorm || ':10';
    const presetBediening = this.product.modelPreset?.bediening || 'STANDAARD';

    return {
      configurationGuid: guid,
      articleCode: this.product.code,
      articleDescription: this.product.name,
      quantity: 1,
      steps: [
        {
          id: 'BREEDTE',
          description: 'Breedte',
          code: 'WIDTH',
          type: ConfigurationStepType.Numeric,
          sequence: 1,
          show: true,
          enabled: true,
          required: true,
          minValue: 300,
          maxValue: 3000,
          suffix: 'mm',
          value: '1000'
        },
        {
          id: 'HOOGTE',
          description: 'Hoogte',
          code: 'HEIGHT',
          type: ConfigurationStepType.Numeric,
          sequence: 2,
          show: true,
          enabled: true,
          required: true,
          minValue: 300,
          maxValue: 3000,
          suffix: 'mm',
          value: '1500'
        },
        {
          id: 'MAATVOERING',
          description: 'Maatvoeringstype',
          code: 'MEASURE_TYPE',
          type: ConfigurationStepType.Select,
          sequence: 3,
          show: true,
          enabled: true,
          required: true,
          value: 'BLIJVENDE_MAAT',
          possibleValues: [
            { key: 'BLIJVENDE_MAAT', value: 'Blijvende maat (strakke dagmaat, fabriek trekt tolerantie af)', chargeAmount: 0 },
            { key: 'MAAKMAAT', value: 'Maakmaat (exacte doek-/productiemaat)', chargeAmount: 0 }
          ]
        },
        {
          id: 'VORM',
          description: 'Model / Vorm',
          code: 'SHAPE',
          type: ConfigurationStepType.Select,
          sequence: 4,
          show: true,
          enabled: true,
          required: true,
          value: presetVorm,
          possibleValues: [
            { key: ':10', value: ':10 Standaard (Bottom-Up)', chargeAmount: 0 },
            { key: ':20', value: ':20 Top Down / Bottom Up', chargeAmount: 37.19 },
            { key: ':30', value: ':30 Dag en Nacht (Duo-stof)', chargeAmount: 78.50 }
          ]
        },
        {
          id: 'MONTAGE',
          description: 'Montagewijze',
          code: 'MOUNT',
          type: ConfigurationStepType.Select,
          sequence: 5,
          show: true,
          enabled: true,
          required: true,
          value: 'STANDAARD',
          possibleValues: [
            { key: 'STANDAARD', value: 'Standaard (In de dag / Op de dag steunen)', chargeAmount: 0 },
            { key: 'MONTAGE_TRUFIT', value: 'TruFit® (Plakprofiel op het glas / zonder boren)', chargeAmount: 68.50 },
            { key: 'KLEMSTEUNEN', value: 'Klemsteunen op draai-kiepraam', chargeAmount: 24.50 }
          ]
        },
        {
          id: 'BEDIENINGS_TYPE',
          description: 'Bedieningstype',
          code: 'OPERATION',
          type: ConfigurationStepType.Select,
          sequence: 6,
          show: true,
          enabled: true,
          required: true,
          value: presetBediening === 'SmartCord' ? 'SMARTCORD' : 'STANDAARD',
          possibleValues: [
            { key: 'STANDAARD', value: 'Koordbediening met kindveilige breker', chargeAmount: 0 },
            { key: 'HANDGREEP', value: 'Handgreepbediening (LiteRise / Ingespannen)', chargeAmount: 0 },
            { key: 'SMARTCORD', value: 'SmartCord® bediening (intrekbaar koord)', chargeAmount: 0 },
            { key: 'KETTING', value: 'Kettingbediening', chargeAmount: 0 },
            { key: 'POWERVIEW', value: 'PowerView® Motor (230V / Accu elektrisch)', chargeAmount: 185.00 }
          ]
        },
        {
          id: 'BEDIENINGSZIJDE',
          description: 'Bedieningszijde',
          code: 'OP_SIDE',
          type: ConfigurationStepType.Select,
          sequence: 7,
          show: true,
          enabled: true,
          required: true,
          value: 'RECHTS',
          possibleValues: [
            { key: 'RECHTS', value: 'Rechts', chargeAmount: 0 },
            { key: 'LINKS', value: 'Links', chargeAmount: 0 }
          ]
        },
        {
          id: 'VOEDINGSTYPE',
          description: 'Voedingstype Motor',
          code: 'POWER_TYPE',
          type: ConfigurationStepType.Select,
          sequence: 8,
          show: false,
          enabled: true,
          required: true,
          value: 'ACCU',
          possibleValues: [
            { key: 'ACCU', value: 'Herlaadbare Li-ion batterijpack (geïntegreerd)', chargeAmount: 0 },
            { key: 'TRANSFORMATOR', value: '230V Transformator met netvoedingsadapter', chargeAmount: 45.00 }
          ]
        },
        {
          id: 'VOEDINGSZIJDE',
          description: 'Voedingszijde',
          code: 'POWER_SIDE',
          type: ConfigurationStepType.Select,
          sequence: 9,
          show: false,
          enabled: true,
          required: true,
          value: 'RECHTS',
          possibleValues: [
            { key: 'RECHTS', value: 'Rechts', chargeAmount: 0 },
            { key: 'LINKS', value: 'Links', chargeAmount: 0 }
          ]
        },
        {
          id: 'PROFIELKLEUR',
          description: 'TruFit® Profielkleur',
          code: 'PROFILE_COLOR',
          type: ConfigurationStepType.Select,
          sequence: 10,
          show: false,
          enabled: true,
          required: true,
          value: 'WIT',
          possibleValues: [
            { key: 'WIT', value: 'Wit (RAL 9016)', chargeAmount: 0 },
            { key: 'CREME', value: 'Crème / Gebroken wit (RAL 9001)', chargeAmount: 0 },
            { key: 'ZILVER', value: 'Technisch Zilver (Geanodiseerd aluminium)', chargeAmount: 0 },
            { key: 'ANTRACIET', value: 'Antraciet (RAL 7016)', chargeAmount: 0 },
            { key: 'ZWART', value: 'Zwart (RAL 9005)', chargeAmount: 0 }
          ]
        },
        {
          id: 'STOF_KLEUR',
          description: 'Stofkeuze & Kleur',
          code: 'FABRIC',
          type: ConfigurationStepType.Select,
          sequence: 11,
          show: true,
          enabled: true,
          required: true,
          value: 'ELAN_101',
          possibleValues: [
            { key: 'ELAN_101', value: 'DU-101 Elan Chalk White (Lichtdoorlatend)', chargeAmount: 0 },
            { key: 'ELAN_102', value: 'DU-102 Elan Soft Sand (Lichtdoorlatend)', chargeAmount: 0 },
            { key: 'BATISTE_201', value: 'DU-201 Batiste Cream (Lichtdoorlatend)', chargeAmount: 15.00 },
            { key: 'BATISTE_202', value: 'DU-202 Batiste Pebble (Lichtdoorlatend)', chargeAmount: 15.00 },
            { key: 'BLACKOUT_301', value: 'DU-301 Architella Blackout Night (Verduisterend)', chargeAmount: 42.50 }
          ]
        }
      ],
      errors: []
    };
  }

  public updateStep(stepId: string, value: string): Configuration {
    const step = this.config.steps.find(s => s.id === stepId);
    if (step) {
      step.value = value;
      if (step.possibleValues) {
        step.selectedValue = step.possibleValues.find(v => v.key === value) || null;
      }
    }

    this.evaluateRules();
    return this.getImmutableSnapshot();
  }

  /**
   * Evalueert de synthese van alle regels uit Bron A (TruFit, PowerView, Gordijnen, Bounds)
   */
  private evaluateRules(): void {
    const errors: ConfigurationError[] = [];

    // Generieke bounds en numerieke validatie voor alle numerieke stappen
    for (const step of this.config.steps) {
      if (step.type === ConfigurationStepType.Numeric && step.show) {
        const raw = step.value?.trim() || '';
        const numVal = Number(raw);

        if (raw === '' || isNaN(numVal)) {
          errors.push({
            code: 'ERR_NUMERIC_INVALID',
            stepId: step.id,
            message: `Ongeldige numerieke waarde voor ${step.description.toLowerCase()}: "${step.value}". Voer een geldig getal in.`,
            severity: 'error'
          });
        } else {
          if (step.minValue != null && numVal < step.minValue) {
            errors.push({
              code: 'ERR_OUT_OF_BOUNDS',
              stepId: step.id,
              message: `Minimale ${step.description.toLowerCase()} is ${step.minValue} ${step.suffix || ''} (huidige invoer: ${numVal}).`,
              severity: 'error'
            });
          }
          if (step.maxValue != null && numVal > step.maxValue) {
            const montage = this.config.steps.find(s => s.id === 'MONTAGE');
            const isTruFit = montage?.value === 'MONTAGE_TRUFIT';
            // Als TruFit actief is, wordt overschrijding afgehandeld door de specifieke TruFit-regel hieronder
            if (!(isTruFit && (step.id === 'BREEDTE' || step.id === 'HOOGTE'))) {
              errors.push({
                code: 'ERR_OUT_OF_BOUNDS',
                stepId: step.id,
                message: `Maximale ${step.description.toLowerCase()} is ${step.maxValue} ${step.suffix || ''} (huidige invoer: ${numVal}).`,
                severity: 'error'
              });
            }
          }
        }
      }
    }

    if (this.category === 'raamdecoratie') {
      const montage = this.config.steps.find(s => s.id === 'MONTAGE');
      const bediening = this.config.steps.find(s => s.id === 'BEDIENINGS_TYPE');
      const bedieningsZijde = this.config.steps.find(s => s.id === 'BEDIENINGSZIJDE');
      const voedingType = this.config.steps.find(s => s.id === 'VOEDINGSTYPE');
      const voedingZijde = this.config.steps.find(s => s.id === 'VOEDINGSZIJDE');
      const profielKleur = this.config.steps.find(s => s.id === 'PROFIELKLEUR');
      const breedte = this.config.steps.find(s => s.id === 'BREEDTE');
      const hoogte = this.config.steps.find(s => s.id === 'HOOGTE');
      const vorm = this.config.steps.find(s => s.id === 'VORM');

      // Regel 1: TruFit montage regels
      if (montage?.value === 'MONTAGE_TRUFIT') {
        if (breedte) breedte.maxValue = 1280;
        if (hoogte) hoogte.maxValue = 2200;

        if (profielKleur) profielKleur.show = true;

        // TruFit vereist uitsluitend Handgreep
        if (bediening) {
          bediening.value = 'HANDGREEP';
          if (bediening.possibleValues) {
            bediening.possibleValues.forEach(pv => {
              pv.show = pv.key === 'HANDGREEP';
            });
          }
        }

        // Vorm beperkt tot :10 en :20
        if (vorm && vorm.value === ':30') {
          vorm.value = ':20';
        }

        // Validatie bounds voor TruFit
        const wVal = Number(breedte?.value || 0);
        if (!isNaN(wVal) && wVal > 1280) {
          errors.push({
            code: 'ERR_TRUFIT_WIDTH_EXCEEDED',
            stepId: 'BREEDTE',
            message: 'TruFit® plakprofiel overschrijdt maximale breedte van 1280 mm (huidige invoer: ' + wVal + ' mm)',
            severity: 'error'
          });
        }

        const hVal = Number(hoogte?.value || 0);
        if (!isNaN(hVal) && hVal > 2200) {
          errors.push({
            code: 'ERR_TRUFIT_HEIGHT_EXCEEDED',
            stepId: 'HOOGTE',
            message: 'TruFit® plakprofiel overschrijdt maximale hoogte van 2200 mm (huidige invoer: ' + hVal + ' mm)',
            severity: 'error'
          });
        }
      } else {
        // Reset naar standaard afmetingen
        if (breedte) breedte.maxValue = 3000;
        if (hoogte) hoogte.maxValue = 3000;
        if (profielKleur) profielKleur.show = false;
        if (bediening && bediening.possibleValues) {
          bediening.possibleValues.forEach(pv => {
            pv.show = true;
          });
        }
      }

      // Regel 2: PowerView Motorbediening
      if (bediening?.value === 'POWERVIEW') {
        if (bedieningsZijde) bedieningsZijde.show = false;
        if (voedingType) voedingType.show = true;
        if (voedingZijde) voedingZijde.show = true;
      } else {
        if (bedieningsZijde) bedieningsZijde.show = bediening?.value !== 'HANDGREEP';
        if (voedingType) voedingType.show = false;
        if (voedingZijde) voedingZijde.show = false;
      }
    }

    this.config.errors = errors;
  }

  /**
   * Berekent de totale meerprijzen conform Bron A
   */
  public calculateTotalSurcharge(): { basePriceEur: number; totalSurchargeEur: number; finalPriceEur: number } {
    let totalSurchargeEur = 0;

    for (const step of this.config.steps) {
      if (step.show && step.possibleValues && step.value) {
        const selected = step.possibleValues.find(v => v.key === step.value);
        if (selected && selected.chargeAmount) {
          totalSurchargeEur += selected.chargeAmount;
        }
      }
    }

    const basePriceEur = this.product.salesPrice || 0;
    const finalPriceEur = Number((basePriceEur + totalSurchargeEur).toFixed(2));

    return {
      basePriceEur,
      totalSurchargeEur: Number(totalSurchargeEur.toFixed(2)),
      finalPriceEur
    };
  }

  /**
   * Berekent gordijnmetrics (baanbreedtes, stofmeters, plooifactor) conform CurtainV2
   */
  public calculateCurtainMetrics(): {
    railWidthMm: number;
    dropHeightMm: number;
    fullnessMultiplier: number;
    totalFabricWidthMeters: number;
  } {
    const widthStep = this.config.steps.find(s => s.id === 'BREEDTE');
    const heightStep = this.config.steps.find(s => s.id === 'HOOGTE');
    const pleatStep = this.config.steps.find(s => s.id === 'PLOOISOORT');

    const railWidthMm = Number(widthStep?.value || 2000);
    const dropHeightMm = Number(heightStep?.value || 2500);

    let fullnessMultiplier = 2.0;
    if (pleatStep?.value === 'DUBBEL') fullnessMultiplier = 2.5;
    if (pleatStep?.value === 'WAVE') fullnessMultiplier = 2.3;

    const totalFabricWidthMeters = Number(((railWidthMm / 1000) * fullnessMultiplier).toFixed(2));

    return {
      railWidthMm,
      dropHeightMm,
      fullnessMultiplier,
      totalFabricWidthMeters
    };
  }
}
