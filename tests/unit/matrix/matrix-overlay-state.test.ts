/**
 * tests/unit/matrix/matrix-overlay-state.test.ts
 *
 * Vitest tests voor de zuivere reducer en helper logica van de overlay state coordinator en cascade mutators.
 * Draait zuiver en deterministisch in Node.js test environment (Zero DOM dependency).
 */

import { describe, expect, it } from 'vitest';
import {
  assignVlakToPositionInOrder,
  buildCellKey,
  cascadeDeletePosition,
  dissolveClusterInOrder,
  findCellKeyByOrderLine,
  findOrderLineByCompoundKey,
  isGestureBeyondThreshold,
  matrixOverlayReducer,
  mergePositionsIntoCluster,
  parseCellKey,
  resolveCellData,
  updateCellInOrder,
} from '../../../src/utils/matrix-overlay-state';
import { ActiveOverlay, MatrixOrder, MatrixProduct, Room } from '../../../src/types/matrix';

describe('Matrix Overlay State Coordinator & Cascading Mutators (Unit Tests)', () => {
  describe('TC-OVR-01: Single-Active Overlay State Reducer', () => {
    it('opent een overlay en overschrijft eventuele voorgaande overlay atomair', () => {
      let state: ActiveOverlay | null = null;

      // 1. Open context menu op etage
      state = matrixOverlayReducer(state, {
        type: 'OPEN',
        payload: { type: 'context_menu', menuType: 'etage', targetId: 'et-1', x: 100, y: 200 },
      });
      expect(state).toEqual({
        type: 'context_menu',
        menuType: 'etage',
        targetId: 'et-1',
        x: 100,
        y: 200,
      });

      // 2. Open cel bewerkingsdrawer (moet etage menu direct overschrijven)
      state = matrixOverlayReducer(state, {
        type: 'OPEN',
        payload: { type: 'cell_edit', positionId: 'pos-1', productId: 'prod-1' },
      });
      expect(state).toEqual({
        type: 'cell_edit',
        positionId: 'pos-1',
        productId: 'prod-1',
      });

      // 3. Sluiten zet state op null
      state = matrixOverlayReducer(state, { type: 'CLOSE' });
      expect(state).toBeNull();
    });
  });

  describe('TC-OVR-02: Compound Key Helpers & Lookups', () => {
    it('construeert en parseert compound keys correct voor subposities', () => {
      expect(buildCellKey('pos_wk_pui', 'a')).toBe('pos_wk_pui__a');
      expect(buildCellKey('pos_wk_pui', ' b ')).toBe('pos_wk_pui__b');
      expect(buildCellKey('pos_wk_pui', undefined)).toBe('pos_wk_pui');
      expect(buildCellKey('pos_wk_pui', '')).toBe('pos_wk_pui');

      expect(parseCellKey('pos_wk_pui__a')).toEqual({ positionId: 'pos_wk_pui', subPos: 'a' });
      expect(parseCellKey('pos_wk_pui')).toEqual({ positionId: 'pos_wk_pui' });
    });

    it('resolvet celdata met fallback van compound key naar basis-key', () => {
      const product: MatrixProduct = {
        id: 'prod-gordijn',
        code: 'G01',
        name: 'Gordijnstoffen',
        category: 'Gordijnen',
        unit: 'stel',
        posPrices: {
          'pos-1': { quantity: 1, unitPriceCents: 50000, totalPriceCents: 50000 },
          'pos-2__a': { quantity: 1, unitPriceCents: 125000, totalPriceCents: 125000, subPos: 'a' },
        },
      };

      // Vraag compound key op
      expect(resolveCellData(product, 'pos-2', 'a')?.totalPriceCents).toBe(125000);
      // Vraag basis-key op
      expect(resolveCellData(product, 'pos-1')?.totalPriceCents).toBe(50000);
      // Niet-bestaande key levert undefined
      expect(resolveCellData(product, 'pos-3')).toBeUndefined();
    });
  });

  describe('TC-OVR-03: Touch / Gesture Threshold Evaluator', () => {
    it('detecteert of beweging binnen of buiten de 10px drempel valt', () => {
      // 5px verplaatsing (binnen drempel -> niet annuleren)
      expect(isGestureBeyondThreshold(100, 100, 103, 104, 10)).toBe(false);

      // Precies 10px verplaatsing (3^2 + 4^2 = 25 -> 5px < 10)
      expect(isGestureBeyondThreshold(0, 0, 6, 8, 10)).toBe(false);

      // 15px verplaatsing (buiten drempel -> long-press annuleren)
      expect(isGestureBeyondThreshold(100, 100, 115, 100, 10)).toBe(true);
      expect(isGestureBeyondThreshold(100, 100, 100, 112, 10)).toBe(true);
    });
  });

  describe('TC-OVR-04: 4-ledige Referentiële Cascade Deletion (cascadeDeletePosition)', () => {
    it('wist positie, verwijdert celprijzen en compound keys, snoeit clusters en herrekent ordertotaal', () => {
      const initialRoom: Room = {
        id: 'room-1',
        name: 'Woonkamer',
        clusters: [
          { id: 'cl-erker', name: 'Erker', positionIds: ['pos-erker-1', 'pos-erker-2'] },
          { id: 'cl-single', name: 'Solo', positionIds: ['pos-single'] },
        ],
        positions: [
          { id: 'pos-erker-1', name: 'Erker L', type: 'Raam' },
          { id: 'pos-erker-2', name: 'Erker R', type: 'Raam' },
          { id: 'pos-single', name: 'Zijraam', type: 'Raam' },
        ],
      };

      const initialOrder: MatrixOrder = {
        id: 'V26001376',
        klant: 'Jaspers',
        plaats: 'Maastricht',
        offerte: 'O1',
        orderdatum: '07 aug 2026',
        status: 'Definitief',
        fsmPhase: '5. Bestellen',
        fsmStep: 5,
        verkoper: 'Carlo',
        filiaal: 'GSW',
        totaalbedragCents: 300000,
        etages: [{ id: 'et-1', name: 'BG', rooms: [initialRoom] }],
        products: [
          {
            id: 'prod-1',
            code: 'P01',
            name: 'Duette',
            category: 'Raam',
            unit: 'st',
            posPrices: {
              'pos-erker-1': { quantity: 1, unitPriceCents: 100000, totalPriceCents: 100000 },
              'pos-erker-1__b': { quantity: 1, unitPriceCents: 50000, totalPriceCents: 50000 },
              'pos-erker-2': { quantity: 1, unitPriceCents: 100000, totalPriceCents: 100000 },
              'pos-single': { quantity: 1, unitPriceCents: 50000, totalPriceCents: 50000 },
            },
          },
        ],
      };

      // 1. Verwijder 'pos-single': cluster 'cl-single' moet volledig gesnoeid worden omdat hij leeg raakt
      const orderAfterSingle = cascadeDeletePosition(initialOrder, 'pos-single');
      const roomAfterSingle = orderAfterSingle.etages[0].rooms[0];

      expect(roomAfterSingle.positions.map((p) => p.id)).toEqual(['pos-erker-1', 'pos-erker-2']);
      // 'cl-single' is gesnoeid!
      expect(roomAfterSingle.clusters.map((c) => c.id)).toEqual(['cl-erker']);
      // 'pos-single' prijs is gewist
      expect(orderAfterSingle.products[0].posPrices['pos-single']).toBeUndefined();
      // Ordertotaal herrekend: 100000 + 50000 + 100000 = 250000 cent
      expect(orderAfterSingle.totaalbedragCents).toBe(250000);

      // 2. Verwijder 'pos-erker-1': zowel 'pos-erker-1' als compound key 'pos-erker-1__b' moeten gewist worden!
      const orderAfterErker1 = cascadeDeletePosition(orderAfterSingle, 'pos-erker-1');
      const roomAfterErker1 = orderAfterErker1.etages[0].rooms[0];

      expect(roomAfterErker1.positions.map((p) => p.id)).toEqual(['pos-erker-2']);
      expect(roomAfterErker1.clusters[0].positionIds).toEqual(['pos-erker-2']);
      expect(orderAfterErker1.products[0].posPrices['pos-erker-1']).toBeUndefined();
      expect(orderAfterErker1.products[0].posPrices['pos-erker-1__b']).toBeUndefined();
      // Ordertotaal herrekend: alleen 'pos-erker-2' blijft over: 100000 cent
      expect(orderAfterErker1.totaalbedragCents).toBe(100000);
    });
  });

  describe('TC-OVR-05: updateCellInOrder & Ordertotaal Synchronisatie', () => {
    it('werkt celprijs bij onder compound key en herberekent ordertotaal atomair', () => {
      const order: MatrixOrder = {
        id: 'V1',
        klant: 'Jaspers',
        plaats: 'M',
        offerte: 'O1',
        orderdatum: '01 jan',
        status: 'Def',
        fsmPhase: '5',
        fsmStep: 5,
        verkoper: 'C',
        filiaal: 'G',
        totaalbedragCents: 100000,
        etages: [
          {
            id: 'et-1',
            name: 'BG',
            rooms: [{ id: 'r-1', name: 'Woonkamer', clusters: [], positions: [{ id: 'pos-1', name: 'P1', type: 'R' }] }],
          },
        ],
        products: [
          {
            id: 'prod-1',
            code: 'P01',
            name: 'Duette',
            category: 'R',
            unit: 'st',
            posPrices: {
              'pos-1': { quantity: 1, unitPriceCents: 100000, totalPriceCents: 100000 },
            },
          },
        ],
      };

      // Voeg een tweede deelregel toe onder compound key 'pos-1__b' ter waarde van € 450,00 (45000 cent)
      const updated = updateCellInOrder(
        order,
        'prod-1',
        'pos-1',
        { quantity: 1, unitPriceCents: 45000, totalPriceCents: 45000, subPos: 'b' },
        'b'
      );

      expect(updated.products[0].posPrices['pos-1__b']).toBeDefined();
      expect(updated.products[0].posPrices['pos-1__b'].totalPriceCents).toBe(45000);
      // Ordertotaal gesynchroniseerd: 100000 + 45000 = 145000 cent
      expect(updated.totaalbedragCents).toBe(145000);
    });
  });

  describe('TC-OVR-06: mergePositionsIntoCluster & Cluster Deduplicatie', () => {
    it('voegt geselecteerde posities samen in een cluster en ontkoppelt ze uit voorgaande clusters', () => {
      const order: MatrixOrder = {
        id: 'V1',
        klant: 'Jaspers',
        plaats: 'Maastricht',
        offerte: 'O1',
        orderdatum: '01 jan',
        status: 'Def',
        fsmPhase: '5',
        fsmStep: 5,
        verkoper: 'C',
        filiaal: 'G',
        totaalbedragCents: 100000,
        etages: [
          {
            id: 'et-1',
            name: 'BG',
            rooms: [
              {
                id: 'room-1',
                name: 'Woonkamer',
                clusters: [
                  { id: 'cl-old', name: 'Oud Cluster', positionIds: ['pos-1', 'pos-2'] },
                ],
                positions: [
                  { id: 'pos-1', name: 'Raam L', type: 'Raam' },
                  { id: 'pos-2', name: 'Raam M', type: 'Raam' },
                  { id: 'pos-3', name: 'Raam R', type: 'Raam' },
                ],
              },
            ],
          },
        ],
        products: [],
      };

      // Voeg pos-2 en pos-3 samen tot een nieuw cluster 'Nieuwe Erker'
      const updated = mergePositionsIntoCluster(order, 'room-1', 'Nieuwe Erker', ['pos-2', 'pos-3']);
      const room = updated.etages[0].rooms[0];

      // pos-2 moet uit 'cl-old' verwijderd zijn; alleen pos-1 blijft over in 'cl-old'
      const oldCl = room.clusters.find((c) => c.id === 'cl-old');
      expect(oldCl?.positionIds).toEqual(['pos-1']);

      // Nieuw cluster aangemaakt met pos-2 en pos-3
      const newCl = room.clusters.find((c) => c.name === 'Nieuwe Erker');
      expect(newCl).toBeDefined();
      expect(newCl?.positionIds).toEqual(['pos-2', 'pos-3']);
    });

    it('voegt posities toe aan een bestaand cluster indien dezelfde naam wordt gekozen', () => {
      const order: MatrixOrder = {
        id: 'V1',
        klant: 'Jaspers',
        plaats: 'M',
        offerte: 'O1',
        orderdatum: '01 jan',
        status: 'Def',
        fsmPhase: '5',
        fsmStep: 5,
        verkoper: 'C',
        filiaal: 'G',
        totaalbedragCents: 0,
        etages: [
          {
            id: 'et-1',
            name: 'BG',
            rooms: [
              {
                id: 'room-1',
                name: 'Woonkamer',
                clusters: [{ id: 'cl-1', name: 'Erker', positionIds: ['pos-1'] }],
                positions: [
                  { id: 'pos-1', name: 'P1', type: 'R' },
                  { id: 'pos-2', name: 'P2', type: 'R' },
                ],
              },
            ],
          },
        ],
        products: [],
      };

      const updated = mergePositionsIntoCluster(order, 'room-1', 'Erker', ['pos-2']);
      const room = updated.etages[0].rooms[0];
      expect(room.clusters.length).toBe(1);
      expect(room.clusters[0].positionIds).toEqual(['pos-1', 'pos-2']);
    });
  });

  describe('TC-OVR-07: assignVlakToPositionInOrder', () => {
    it('kent een bouwkundig vlak toe aan de corresponderende positie', () => {
      const order: MatrixOrder = {
        id: 'V1',
        klant: 'Jaspers',
        plaats: 'M',
        offerte: 'O1',
        orderdatum: '01 jan',
        status: 'Def',
        fsmPhase: '5',
        fsmStep: 5,
        verkoper: 'C',
        filiaal: 'G',
        totaalbedragCents: 0,
        etages: [
          {
            id: 'et-1',
            name: 'BG',
            rooms: [
              {
                id: 'room-1',
                name: 'Woonkamer',
                clusters: [],
                positions: [
                  { id: 'pos-1', name: 'P1', type: 'R', vlak: 'Oud Vlak' },
                  { id: 'pos-2', name: 'P2', type: 'R' },
                ],
              },
            ],
          },
        ],
        products: [],
      };

      const updated = assignVlakToPositionInOrder(order, 'pos-1', 'Wand Voorgevel');
      expect(updated.etages[0].rooms[0].positions[0].vlak).toBe('Wand Voorgevel');
      expect(updated.etages[0].rooms[0].positions[1].vlak).toBeUndefined();
    });
  });

  describe('TC-OVR-08: dissolveClusterInOrder', () => {
    it('verwijdert het opgegeven cluster uit de ruimte zonder posities te wissen', () => {
      const order: MatrixOrder = {
        id: 'V1',
        klant: 'Jaspers',
        plaats: 'M',
        offerte: 'O1',
        orderdatum: '01 jan',
        status: 'Def',
        fsmPhase: '5',
        fsmStep: 5,
        verkoper: 'C',
        filiaal: 'G',
        totaalbedragCents: 0,
        etages: [
          {
            id: 'et-1',
            name: 'BG',
            rooms: [
              {
                id: 'room-1',
                name: 'Woonkamer',
                clusters: [
                  { id: 'cl-1', name: 'Erker', positionIds: ['pos-1'] },
                  { id: 'cl-2', name: 'Schuifpui', positionIds: ['pos-2'] },
                ],
                positions: [
                  { id: 'pos-1', name: 'P1', type: 'R' },
                  { id: 'pos-2', name: 'P2', type: 'R' },
                ],
              },
            ],
          },
        ],
        products: [],
      };

      const updated = dissolveClusterInOrder(order, 'room-1', 'cl-1');
      const room = updated.etages[0].rooms[0];
      expect(room.clusters.length).toBe(1);
      expect(room.clusters[0].id).toBe('cl-2');
      expect(room.positions.length).toBe(2);
    });
  });

  describe('TC-OVR-09: findCellKeyByOrderLine', () => {
    it('vindt de cel-sleutel en productId behorende bij een ERP regelnummer', () => {
      const order: MatrixOrder = {
        id: 'V1',
        klant: 'Jaspers',
        plaats: 'M',
        offerte: 'O1',
        orderdatum: '01 jan',
        status: 'Def',
        fsmPhase: '5',
        fsmStep: 5,
        verkoper: 'C',
        filiaal: 'G',
        totaalbedragCents: 0,
        etages: [],
        products: [
          {
            id: 'prod-duette',
            code: 'P01',
            name: 'Duette',
            category: 'R',
            unit: 'st',
            posPrices: {
              'pos-1': { quantity: 1, unitPriceCents: 1000, totalPriceCents: 1000, line: 20 },
              'pos-2__a': { quantity: 1, unitPriceCents: 2000, totalPriceCents: 2000, line: 30 },
            },
          },
        ],
      };

      const found = findCellKeyByOrderLine(order, 30);
      expect(found).toEqual({
        productId: 'prod-duette',
        cellKey: 'pos-2__a',
      });

      const notFound = findCellKeyByOrderLine(order, 999);
      expect(notFound).toBeNull();

      // Test TC-OVR-10: findOrderLineByCompoundKey
      expect(findOrderLineByCompoundKey(order, 'prod-duette-pos-2__a')).toBe(30);
      expect(findOrderLineByCompoundKey(order, 'prod-duette-pos-1')).toBe(20);
      expect(findOrderLineByCompoundKey(order, 'prod-unknown-pos-1')).toBeNull();
      expect(findOrderLineByCompoundKey(order, null)).toBeNull();
    });
  });
});
