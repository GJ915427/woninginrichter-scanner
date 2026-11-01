/**
 * src/fixtures/matrix-mock-data.ts
 *
 * Mock data voor de 7 reële LogicTrade orders in het DDD CPQ formaat.
 * Alle bedragen zijn gecentraliseerd in integer centen (Zero Float Math).
 */

import { MatrixOrder } from '../types/matrix';

export const MATRIX_ORDERS_MOCK_DATA: MatrixOrder[] = [
  {
    id: "V26001761",
    klant: "DrHaack holding b.v.",
    plaats: "Maastricht",
    offerte: "O26001215",
    orderdatum: "01 okt 2026",
    status: "Definitief",
    fsmPhase: "5. Bestellen (Actueel)",
    fsmStep: 5,
    verkoper: "Carlo Heinemans",
    filiaal: "Winkel GSW BV",
    totaalbedragCents: 497030,
    scopeDescription: "Marmoleum Vloerenproject over 4 Kamers + Egalisatie",
    positionCount: 4,
    orderlineCount: 7,
    etages: [
      {
        id: "etage_bg",
        name: "Begane Grond",
        rooms: [
          {
            id: "rm_k3",
            name: "Kamer 3",
            clusters: [],
            positions: [{ id: "pos_k3_vloer", name: "Vloer", type: "Vloer", vlak: "Kamer 3 Vloer" }]
          },
          {
            id: "rm_k6",
            name: "Kamer 6",
            clusters: [],
            positions: [{ id: "pos_k6_vloer", name: "Vloer", type: "Vloer", vlak: "Kamer 6 Vloer" }]
          },
          {
            id: "rm_k7",
            name: "Kamer 7",
            clusters: [],
            positions: [{ id: "pos_k7_vloer", name: "Vloer", type: "Vloer", vlak: "Kamer 7 Vloer" }]
          },
          {
            id: "rm_k8",
            name: "Kamer 8",
            clusters: [],
            positions: [{ id: "pos_k8_vloer", name: "Vloer", type: "Vloer", vlak: "Kamer 8 Vloer" }]
          }
        ]
      }
    ],
    products: [
      {
        id: "p_marmoleum",
        code: "A00033250",
        category: "Vloeren",
        name: "Forbo Marmoleum 200cm (Splash 3430)",
        unit: "m¹",
        posPrices: {
          pos_k3_vloer: { quantity: 1, unit: "m¹", unitPriceCents: 91365, totalPriceCents: 91365, dim: "18.2 m²", note: "Splash 3430 (2 banen)", line: 30 },
          pos_k6_vloer: { quantity: 1, unit: "m¹", unitPriceCents: 41700, totalPriceCents: 41700, dim: "8.3 m²", note: "+ rest uit kamer 7", line: 60 },
          pos_k7_vloer: { quantity: 1, unit: "m¹", unitPriceCents: 89400, totalPriceCents: 89400, dim: "17.8 m²", note: "Splash 3430 (2 banen)", line: 50 },
          pos_k8_vloer: { quantity: 1, unit: "m¹", unitPriceCents: 41165, totalPriceCents: 41165, dim: "8.2 m²", note: "+ rest uit kamer 3", line: 40 }
        }
      },
      {
        id: "p_egalisatie",
        code: "A00036786",
        category: "Voorbereiding",
        name: "Egaliseren 2mm cement dekvloer (primer + schuren)",
        unit: "m²",
        posPrices: {
          pos_project_algemeen: { quantity: 48, unit: "m²", unitPriceCents: 2334, totalPriceCents: 112032, dim: "2mm vloervolgend", note: "Voorbereiding eindvloer (4 vertrekken)", line: 70 }
        }
      },
      {
        id: "p_legkosten",
        code: "A00038472",
        category: "Dienst / Arbeid",
        name: "Legkosten marmoleum incl. lijm",
        unit: "m²",
        posPrices: {
          pos_project_algemeen: { quantity: 48, unit: "m²", unitPriceCents: 1800, totalPriceCents: 86400, dim: "Verlijmd", note: "Vakkundige plaatsing over 4 kamers", line: 80 }
        }
      }
    ],
    rawLines: [
      { line: 30, productCode: "A00033250", description: "Forbo Marmoleum Kamer 3", quantity: 1, priceCents: 91365, totalCents: 91365, positionName: "pos_k3_vloer", roomName: "Kamer 3" },
      { line: 40, productCode: "A00033250", description: "Forbo Marmoleum Kamer 8", quantity: 1, priceCents: 41165, totalCents: 41165, positionName: "pos_k8_vloer", roomName: "Kamer 8" },
      { line: 50, productCode: "A00033250", description: "Forbo Marmoleum Kamer 7", quantity: 1, priceCents: 89400, totalCents: 89400, positionName: "pos_k7_vloer", roomName: "Kamer 7" },
      { line: 60, productCode: "A00033250", description: "Forbo Marmoleum Kamer 6", quantity: 1, priceCents: 41700, totalCents: 41700, positionName: "pos_k6_vloer", roomName: "Kamer 6" },
      { line: 70, productCode: "A00036786", description: "Egaliseren 2mm cement dekvloer", quantity: 48, priceCents: 2334, totalCents: 112032, positionName: "pos_project_algemeen" },
      { line: 80, productCode: "A00038472", description: "Legkosten marmoleum incl. lijm", quantity: 48, priceCents: 1800, totalCents: 86400, positionName: "pos_project_algemeen" }
    ]
  },
  {
    id: "V26001797",
    klant: "DA.AN interior design & living",
    plaats: "Maastricht",
    offerte: "O26001230",
    orderdatum: "15 sep 2026",
    status: "Definitief",
    fsmPhase: "5. Bestellen (Actueel)",
    fsmStep: 5,
    verkoper: "Carlo Heinemans",
    filiaal: "Winkel GSW BV",
    totaalbedragCents: 685200,
    scopeDescription: "Showroom Pui & Etalage Luxaflex PowerView + Interstil Rail",
    positionCount: 6,
    orderlineCount: 12,
    etages: [
      {
        id: "etage_bg",
        name: "Begane Grond / Showroom",
        rooms: [
          {
            id: "rm_achterpui",
            name: "Achterpui",
            clusters: [],
            positions: [
              { id: "pos_pui_links", name: "Pui Links", type: "Raam" },
              { id: "pos_pui_midden", name: "Pui Midden", type: "Raam" },
              { id: "pos_pui_rechts", name: "Pui Rechts", type: "Raam" }
            ]
          },
          {
            id: "rm_etalage",
            name: "Etalage",
            clusters: [],
            positions: [
              { id: "pos_etalage_raam", name: "Etalageruit", type: "Raampartij" },
              { id: "pos_etalage_plafond", name: "Plafond", type: "Plafondmontage" }
            ]
          }
        ]
      }
    ],
    products: [
      {
        id: "p_rolgordijn_pv",
        code: "A00042630",
        category: "Raambekleding",
        name: "Luxaflex Rolgordijn PowerView® Gen 3 (Stof 6434)",
        unit: "stuks",
        posPrices: {
          pos_pui_links: { quantity: 1, unit: "st", unitPriceCents: 62700, totalPriceCents: 62700, dim: "1250 × 2400", note: "Accumotor (Blijvende maat)", line: 10 },
          pos_pui_midden: { quantity: 1, unit: "st", unitPriceCents: 63400, totalPriceCents: 63400, dim: "1350 × 2400", note: "Accumotor (Blijvende maat)", line: 20 },
          pos_pui_rechts: { quantity: 1, unit: "st", unitPriceCents: 62700, totalPriceCents: 62700, dim: "1250 × 2400", note: "Accumotor (Blijvende maat)", line: 30 }
        }
      },
      {
        id: "p_inbetween_morph",
        code: "0107290032",
        category: "Gordijnen",
        name: "Kendix Inbetween MORPH 32 (Wave 8cm)",
        unit: "delen",
        posPrices: {
          pos_etalage_raam: { quantity: 4, unit: "delen", unitPriceCents: 44440, totalPriceCents: 177758, dim: "Breedte 4600", note: "Wave 8cm + zoom", line: 100 }
        }
      }
    ]
  },
  {
    id: "V26001376",
    klant: "Jaspers",
    plaats: "Maastricht",
    offerte: "O26000865",
    orderdatum: "07 aug 2026",
    status: "Definitief",
    fsmPhase: "5. Bestellen (Actueel)",
    fsmStep: 5,
    verkoper: "Carlo Heinemans",
    filiaal: "Winkel GSW BV",
    totaalbedragCents: 1925000,
    scopeDescription: "Complete Villa: 18x Duette® over 6 Kamers + Gordijnen & Rolgordijnen",
    positionCount: 15,
    orderlineCount: 10,
    etages: [
      {
        id: "etage_bg",
        name: "Begane Grond",
        rooms: [
          {
            id: "rm_voordeur",
            name: "Hal / Voordeur",
            clusters: [],
            positions: [
              { id: "pos_vd_links", name: "Raam Links", type: "Raam", vlak: "Wand Voorgevel" },
              { id: "pos_vd_rechts", name: "Raam Rechts", type: "Raam", vlak: "Wand Voorgevel" }
            ]
          },
          {
            id: "rm_woonkamer",
            name: "Woonkamer",
            clusters: [
              { id: "cl_erker", name: "Erker Voorgevel (3 ramen)", positionIds: ["pos_wk_voor", "pos_wk_z1", "pos_wk_z2"] }
            ],
            positions: [
              { id: "pos_wk_voor", name: "Voorzijde", type: "Raam", vlak: "Erker Voorgevel" },
              { id: "pos_wk_z1", name: "Zijraam 1", type: "Raam", vlak: "Erker Zijwand L" },
              { id: "pos_wk_z2", name: "Zijraam 2", type: "Raam", vlak: "Erker Zijwand R" },
              { id: "pos_wk_z3", name: "Zijraam 3", type: "Raam", vlak: "Zijgevel Tuin" },
              { id: "pos_wk_pui", name: "Schuifpui", type: "Pui", vlak: "Achtergevel Tuin" }
            ]
          },
          {
            id: "rm_eetkamer",
            name: "Eetkamer",
            clusters: [],
            positions: [
              { id: "pos_ek_links", name: "Raam Links", type: "Raam", vlak: "Achtergevel Tuin" },
              { id: "pos_ek_rechts", name: "Raam Rechts", type: "Raam", vlak: "Achtergevel Tuin" }
            ]
          },
          {
            id: "rm_studeer",
            name: "Studeerkamer",
            clusters: [],
            positions: [
              { id: "pos_sk_links", name: "Raam Links", type: "Raam", vlak: "Zijgevel Oprit" },
              { id: "pos_sk_rechts", name: "Raam Rechts", type: "Raam", vlak: "Zijgevel Oprit" }
            ]
          }
        ]
      },
      {
        id: "etage_1e",
        name: "1e Verdieping",
        rooms: [
          {
            id: "rm_portaal",
            name: "Portaal / Overloop",
            clusters: [],
            positions: [
              { id: "pos_pt_links", name: "Raam Links", type: "Raam" },
              { id: "pos_pt_rechts", name: "Raam Rechts", type: "Raam" }
            ]
          },
          {
            id: "rm_slaap",
            name: "Hoofdslaapkamer",
            clusters: [],
            positions: [
              { id: "pos_sl_zlinks", name: "Zijkant L", type: "Raam" },
              { id: "pos_sl_vlinks", name: "Voorzijde L", type: "Raam" }
            ]
          }
        ]
      }
    ],
    products: [
      {
        id: "p_inmeetservice",
        code: "A00034988",
        category: "Dienst / Service",
        name: "Inmeetservice",
        unit: "keer",
        posPrices: {
          pos_project_algemeen: { quantity: 1, unit: "post", unitPriceCents: 0, totalPriceCents: 0, note: "Inbegrepen", line: 10, isInbegrepen: true }
        }
      },
      {
        id: "p_duette_32",
        code: "A000066057",
        category: "Raambekleding",
        name: "GIW Duette® 32mm SmartCord TDBU (F85807 Champagne)",
        unit: "stuks",
        posPrices: {
          pos_vd_links: { quantity: 1, unit: "st", unitPriceCents: 89522, totalPriceCents: 89522, dim: "1100 × 2240", note: "Top Down / Bottom Up", line: 20, subPos: "a" },
          pos_vd_rechts: { quantity: 1, unit: "st", unitPriceCents: 89522, totalPriceCents: 89522, dim: "1100 × 2240", note: "Top Down / Bottom Up", line: 30, subPos: "a" },
          pos_wk_voor: { quantity: 1, unit: "st", unitPriceCents: 79358, totalPriceCents: 79358, dim: "1100 × 1720", note: "Top Down / Bottom Up", line: 40, subPos: "a" },
          pos_wk_z1: { quantity: 1, unit: "st", unitPriceCents: 79358, totalPriceCents: 79358, dim: "1100 × 1695", note: "Top Down / Bottom Up", line: 50, subPos: "a" },
          pos_wk_z2: { quantity: 1, unit: "st", unitPriceCents: 79358, totalPriceCents: 79358, dim: "1100 × 1695", note: "Top Down / Bottom Up", line: 50, subPos: "a" },
          pos_wk_z3: { quantity: 1, unit: "st", unitPriceCents: 79358, totalPriceCents: 79358, dim: "1100 × 1695", note: "Top Down / Bottom Up", line: 50, subPos: "a" }
        }
      },
      {
        id: "p_duette_transparant",
        code: "A000066057",
        category: "Raambekleding",
        name: "GIW Duette® 32mm Transparant (F85607 Champagne)",
        unit: "stuks",
        posPrices: {
          pos_ek_links: { quantity: 1, unit: "st", unitPriceCents: 92000, totalPriceCents: 92000, dim: "1100 × 2660", note: "Transparant SmartCord", line: 70, subPos: "a" },
          pos_ek_rechts: { quantity: 1, unit: "st", unitPriceCents: 92000, totalPriceCents: 92000, dim: "1100 × 2680", note: "Transparant SmartCord", line: 70, subPos: "a" }
        }
      },
      {
        id: "p_duette_25_trufit",
        code: "A000066057",
        category: "Raambekleding",
        name: "GIW Duette® 25mm TruFit Plakprofiel TDBU",
        unit: "stuks",
        posPrices: {
          pos_sk_links: { quantity: 1, unit: "st", unitPriceCents: 65000, totalPriceCents: 65000, dim: "1100 × 1555", note: "TruFit MA", line: 90, subPos: "a" },
          pos_sk_rechts: { quantity: 1, unit: "st", unitPriceCents: 65000, totalPriceCents: 65000, dim: "1100 × 1555", note: "TruFit MA", line: 90, subPos: "a" },
          pos_pt_links: { quantity: 1, unit: "st", unitPriceCents: 65000, totalPriceCents: 65000, dim: "1100 × 1005", note: "TruFit MA", line: 90, subPos: "a" },
          pos_pt_rechts: { quantity: 1, unit: "st", unitPriceCents: 65000, totalPriceCents: 65000, dim: "1100 × 1005", note: "TruFit MA", line: 90, subPos: "a" },
          pos_sl_zlinks: { quantity: 1, unit: "st", unitPriceCents: 65000, totalPriceCents: 65000, dim: "1100 × 1005", note: "TruFit MA", line: 90, subPos: "a" }
        }
      },
      {
        id: "p_inbetween_mundo",
        code: "0117990105",
        category: "Gordijnen",
        name: "Gordijnstoffen MUNDO 105 (Waveconfectie)",
        unit: "stuks",
        posPrices: {
          pos_wk_pui: { quantity: 1, unit: "stel", unitPriceCents: 125000, totalPriceCents: 125000, dim: "Breedte 4800", note: "Waveplooi op Interstil rail", line: 110, subPos: "a" }
        }
      },
      {
        id: "p_rail_rond25",
        code: "A00038958",
        category: "Gordijnrails",
        name: "Interstil Rond 25mm Alu Binnenloop (52 glijders)",
        unit: "stuks",
        posPrices: {
          pos_wk_pui: { quantity: 1, unit: "st", unitPriceCents: 55000, totalPriceCents: 55000, dim: "4800 mm", note: "6 plafondsteunen, 52 glijders", line: 120, subPos: "b" }
        }
      },
      {
        id: "p_montage_villa",
        code: "A00033263",
        category: "Dienst / Arbeid",
        name: "Montagekosten complete villa (20 eenheden)",
        unit: "post",
        posPrices: {
          pos_project_algemeen: { quantity: 20, unit: "stuks", unitPriceCents: 5500, totalPriceCents: 110000, note: "Montage 20 eenheden", line: 130 }
        }
      }
    ],
    rawLines: [
      { line: 10, productCode: "A00034988", description: "Inmeetservice", quantity: 1, priceCents: 0, totalCents: 0, positionName: "pos_project_algemeen" },
      { line: 20, productCode: "A000066057", description: "Duette® 32mm Voordeur L", quantity: 1, priceCents: 89522, totalCents: 89522, positionName: "pos_vd_links", roomName: "Hal / Voordeur" },
      { line: 30, productCode: "A000066057", description: "Duette® 32mm Voordeur R", quantity: 1, priceCents: 89522, totalCents: 89522, positionName: "pos_vd_rechts", roomName: "Hal / Voordeur" },
      { line: 40, productCode: "A000066057", description: "Duette® 32mm Woonkamer Voor", quantity: 1, priceCents: 79358, totalCents: 79358, positionName: "pos_wk_voor", roomName: "Woonkamer" },
      { line: 50, productCode: "A000066057", description: "Duette® 32mm Woonkamer Zijkant 1-3", quantity: 3, priceCents: 79358, totalCents: 238074, positionName: "pos_wk_z1", roomName: "Woonkamer" },
      { line: 70, productCode: "A000066057", description: "Duette® 32mm Eetkamer L/R", quantity: 2, priceCents: 92000, totalCents: 184000, positionName: "pos_ek_links", roomName: "Eetkamer" },
      { line: 90, productCode: "A000066057", description: "Duette® 25mm TruFit Studeer/Portaal/Slaap", quantity: 5, priceCents: 65000, totalCents: 325000, positionName: "pos_sk_links", roomName: "Studeerkamer" },
      { line: 110, productCode: "0117990105", description: "Gordijnstoffen MUNDO 105", quantity: 1, priceCents: 125000, totalCents: 125000, positionName: "pos_wk_pui", roomName: "Woonkamer" },
      { line: 120, productCode: "A00038958", description: "Interstil Alu Binnenloop Rond 25", quantity: 1, priceCents: 55000, totalCents: 55000, positionName: "pos_wk_pui", roomName: "Woonkamer" },
      { line: 130, productCode: "A00033263", description: "Montagekosten zonwering", quantity: 20, priceCents: 5500, totalCents: 110000, positionName: "pos_project_algemeen" }
    ]
  },
  {
    id: "V26001584",
    klant: "Tripels",
    plaats: "Maastricht",
    offerte: "O26001141",
    orderdatum: "08 sep 2026",
    status: "Definitief",
    fsmPhase: "5. Bestellen (Actueel)",
    fsmStep: 5,
    verkoper: "Carlo Heinemans",
    filiaal: "Winkel GSW BV",
    totaalbedragCents: 214500,
    scopeDescription: "Maatwerk Vloerkleed Interfloor Imola met Banderering & Antislip",
    positionCount: 1,
    orderlineCount: 4,
    etages: [
      {
        id: "etage_bg",
        name: "Begane Grond",
        rooms: [
          {
            id: "rm_woonkamer",
            name: "Woonkamer",
            clusters: [],
            positions: [{ id: "pos_wk_zithoek", name: "Vloer Zithoek", type: "Vloerkleed" }]
          }
        ]
      }
    ],
    products: [
      {
        id: "p_imola",
        code: "A00067020",
        category: "Vloerkleed",
        name: "Interfloor Imola 400cm Projecttapijt (386 Aqua)",
        unit: "stuks",
        posPrices: {
          pos_wk_zithoek: { quantity: 1, unit: "st", unitPriceCents: 145000, totalPriceCents: 145000, dim: "280 × 225 cm", note: "1 × 2.35 mtr van 400cm rol", line: 40 }
        }
      }
    ]
  },
  {
    id: "V26001553",
    klant: "Dirks",
    plaats: "Maastricht",
    offerte: "O26001112",
    orderdatum: "24 aug 2026",
    status: "Definitief",
    fsmPhase: "5. Bestellen (Actueel)",
    fsmStep: 5,
    verkoper: "Carlo Heinemans",
    filiaal: "Winkel GSW BV",
    totaalbedragCents: 438500,
    scopeDescription: "Gordijnen & Elektrische Interstil Rails Zithoek & Slaapkamer",
    positionCount: 4,
    orderlineCount: 8,
    etages: [
      {
        id: "etage_bg",
        name: "Begane Grond",
        rooms: [
          {
            id: "rm_zithoek",
            name: "Zithoek",
            clusters: [],
            positions: [
              { id: "pos_zh_achter", name: "Achterzijde", type: "Raam" },
              { id: "pos_zh_rechts", name: "Rechts", type: "Raam" }
            ]
          }
        ]
      }
    ],
    products: [
      {
        id: "p_mart_visser",
        code: "GPC60274797",
        category: "Gordijnen",
        name: "Mart Visser PEARLS REMAIN (Kleur 91, Wave 6cm)",
        unit: "stuks",
        posPrices: {
          pos_zh_achter: { quantity: 1, unit: "stuk", unitPriceCents: 85000, totalPriceCents: 85000, dim: "Wave 6cm", note: "Op bestaande rail", line: 10 },
          pos_zh_rechts: { quantity: 1, unit: "stuk", unitPriceCents: 85000, totalPriceCents: 85000, dim: "Wave 6cm", note: "Op bestaande rail", line: 20 }
        }
      }
    ]
  },
  {
    id: "V26001710",
    klant: "Amory",
    plaats: "Maastricht",
    offerte: "O26001180",
    orderdatum: "12 sep 2026",
    status: "Definitief",
    fsmPhase: "5. Bestellen (Actueel)",
    fsmStep: 5,
    verkoper: "Carlo Heinemans",
    filiaal: "Winkel GSW BV",
    totaalbedragCents: 167500,
    scopeDescription: "Inbetween Wave Confectie Zolder & Werkkamer",
    positionCount: 2,
    orderlineCount: 4,
    etages: [
      {
        id: "etage_2e",
        name: "2e Verdieping / Zolder",
        rooms: [
          {
            id: "rm_zolder",
            name: "Zolder Studio",
            clusters: [],
            positions: [{ id: "pos_zolder_dakkapel", name: "Dakkapel", type: "Raam" }]
          }
        ]
      }
    ],
    products: [
      {
        id: "p_inbetween_zolder",
        code: "0107290032",
        category: "Gordijnen",
        name: "Kendix Inbetween MORPH 32",
        unit: "delen",
        posPrices: {
          pos_zolder_dakkapel: { quantity: 2, unit: "delen", unitPriceCents: 45000, totalPriceCents: 90000, dim: "Wave 8cm", note: "Dakkapel raam", line: 10 }
        }
      }
    ]
  },
  {
    id: "V26001479",
    klant: "Cobben",
    plaats: "Maastricht",
    offerte: "O26000950",
    orderdatum: "18 aug 2026",
    status: "Definitief",
    fsmPhase: "5. Bestellen (Actueel)",
    fsmStep: 5,
    verkoper: "Carlo Heinemans",
    filiaal: "Winkel GSW BV",
    totaalbedragCents: 830000,
    scopeDescription: "Volledige Woning: Houten Jaloezieën & Screens",
    positionCount: 8,
    orderlineCount: 15,
    etages: [
      {
        id: "etage_bg",
        name: "Begane Grond",
        rooms: [
          {
            id: "rm_woonkamer_cobben",
            name: "Woonkamer",
            clusters: [],
            positions: [
              { id: "pos_wk_voor_c", name: "Voorzijde", type: "Raam" },
              { id: "pos_wk_achter_c", name: "Achterzijde", type: "Raam" }
            ]
          }
        ]
      }
    ],
    products: [
      {
        id: "p_jaloezie_hout",
        code: "A000066057",
        category: "Raambekleding",
        name: "Luxaflex Houten Jaloezieën 50mm (Wit)",
        unit: "stuks",
        posPrices: {
          pos_wk_voor_c: { quantity: 1, unit: "st", unitPriceCents: 95000, totalPriceCents: 95000, dim: "1800 × 2400", note: "Ladderband 38mm", line: 10 },
          pos_wk_achter_c: { quantity: 1, unit: "st", unitPriceCents: 95000, totalPriceCents: 95000, dim: "1800 × 2400", note: "Ladderband 38mm", line: 20 }
        }
      }
    ]
  }
];
