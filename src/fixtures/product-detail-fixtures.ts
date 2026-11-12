import { ProductDetailData } from '../types/product-detail';

/**
 * EasyM2M Hoofdscherm 6 Product Detail Concrete Mock Fixtures
 * SSOT voor GIW Duette® 32mm SmartCord op positie 01a (Raam Rechts).
 */
export const MOCK_PRODUCT_DETAIL_DATA: ProductDetailData = {
  orderId: 'ORD-2026-0881',
  orderNumber: '0881',
  customerName: 'Fam. Jaspers (Villa Maastricht)',
  customerLocation: 'Sint Pieterstraat 12, Maastricht',
  roomName: 'Hal',
  positionCode: '01a',
  positionDescription: '01a (Raam Rechts)',
  status: 'Definitief',
  fsmStage: 'Montage gepland',
  attachmentsCount: 7,
  productName: 'GIW Duette® 32mm SmartCord',
  productCategory: 'Binnenzonwering',
  measurements: {
    width: {
      points: [1100, 1098, 1102],
      minRawMm: 1098,
      deductionMm: 5,
      formulaDescription: '-5 mm (In de dag speling: -2.5mm per zijde GSW Norm)',
      finalProductionMm: 1093,
    },
    height: {
      points: [2240, 2242, 2238],
      minRawMm: 2238,
      deductionMm: 0,
      formulaDescription: '0 mm (In de dag montage)',
      finalProductionMm: 2238,
    },
    installationHeightMm: 2650,
    isInstallationHeightFixed: true,
  },
  priceCents: 89522, // € 895,22
  specifications: {
    fabric: 'Champagne F85807 (Lichtdoorlatend)',
    profileColor: 'Warm Champagne / Wit RAL 9010',
    operation: 'SmartCord Top-Down / Bottom-Up',
    mountType: 'In de dag (25mm beugel)',
    stackHeight: 'ca. 145 mm',
  },
  checklists: [
    {
      id: 'cl-1',
      title: 'Glaslatdiepte ≥ 19mm gecontroleerd',
      checked: true,
      detail: 'Geschikt voor standaard montagesteunen zonder tussenlat. Diepte gemeten: 24mm op aluminium profiel.',
    },
    {
      id: 'cl-2',
      title: 'EN 13120 kindveiligheid aanwezig',
      checked: true,
      detail: 'Bedieningskoord bevindt zich minstens 1500mm boven afgewerkte vloer. SmartCord breekt los bij overbelasting.',
    },
    {
      id: 'cl-3',
      title: 'Doorgangscontrole raam & klink',
      checked: true,
      detail: 'Draai-/kiepvleugel vrij van belemmeringen. Raamkruk steekt 42mm uit; pakket valt hier netjes 15mm voor.',
    },
  ],
  bracketInfo: {
    mountDescription: 'Bovendorpel montage met 25mm speling tot glas',
    colorCode: 'RAL 9010 Wit Gecoat',
    supportLeft: '50mm van kant',
    supportRight: '50mm van kant',
    centerSupport: 'N.v.t. (<1600mm)',
  },
  feedItems: [
    {
      id: 'feed-1',
      type: 'note',
      author: 'Karel Bakker',
      role: 'Inmeter',
      timestamp: '24-03-2026 14:32',
      description: 'Let op radiatorknop links; 25mm extra speling vereist voor montage SmartCord bedieningsbeugels.',
      badge: 'Gekoppeld',
      badgeVariant: 'info',
      actionLabel: '1 bijlage (Kozijndetail L) Beantwoorden',
    },
    {
      id: 'feed-2',
      type: 'issue',
      title: 'Lichte kras op bovenprofiel',
      description: 'Transportschade tijdens overslag. Touch-up lakstift RAL 9010 vereist vóór oplevering.',
      badge: '#IS-2026-04 In behandeling',
      badgeVariant: 'warning',
      priority: 'Prioriteit: Midden',
      actionLabel: 'Details bekijken →',
    },
    {
      id: 'feed-3',
      type: 'photo',
      title: 'Bovendorpel detail',
      description: 'Lasermeting nisdiepte',
      imageUrl: '/images/bovendorpel-nis.jpg',
      actionLabel: '+ Notitie',
    },
    {
      id: 'feed-4',
      type: 'planning',
      author: 'Montageplanning',
      role: 'Info',
      timestamp: '25-03-2026 09:15',
      description: 'Voorboren in stucwerk vereist steenboor 6mm; beugelschroeven 4.0×40mm vooraf meegeleverd in montagekist.',
      badge: 'Werfnotitie',
      badgeVariant: 'info',
      actionLabel: 'Bewerken',
    },
  ],
};
