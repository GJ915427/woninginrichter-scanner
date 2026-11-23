import { describe, it, expect } from 'vitest';
import { SpatialExtractionEngine } from '@/domain/orders/spatial-extraction-engine';
import type { RawOrderLineInput, OrderSpatialContext } from '@/types/order-intake';

describe('SpatialExtractionEngine', () => {
  const engine = new SpatialExtractionEngine();

  describe('extractSpatialFromNotes', () => {
    it('extraheert kamer, raampositie en leidt begane grond af uit "- Keuken raam links"', () => {
      const result = engine.extractSpatialFromNotes('- Keuken raam links');
      expect(result.room_name).toBe('Keuken');
      expect(result.room_source).toBe('EXPLICIT');
      expect(result.window_name).toBe('Raam links');
      expect(result.pos_source).toBe('EXPLICIT');
      expect(result.etage_name).toBe('Begane grond');
      expect(result.etage_source).toBe('INFERRED');
    });

    it('extraheert verdieping expliciet wanneer enkel een etage wordt genoemd', () => {
      const result = engine.extractSpatialFromNotes('- 1e verdieping');
      expect(result.etage_name).toBe('1e verdieping');
      expect(result.etage_source).toBe('EXPLICIT');
      expect(result.room_name).toBeNull();
    });

    it('extraheert kamer en leidt verdieping en canonieke positie af', () => {
      const result = engine.extractSpatialFromNotes('- Woonkamer');
      expect(result.room_name).toBe('Woonkamer');
      expect(result.room_source).toBe('EXPLICIT');
      expect(result.etage_name).toBe('Begane grond');
      expect(result.etage_source).toBe('INFERRED');
    });

    it('herkent erkercluster en positie uit "- Woonkamer Erker raam 1"', () => {
      const result = engine.extractSpatialFromNotes('- Woonkamer Erker raam 1');
      expect(result.room_name).toBe('Woonkamer');
      expect(result.cluster_name).toBe('Erkercluster');
      expect(result.cluster_source).toBe('EXPLICIT');
      expect(result.window_name).toBe('Raam 1');
      expect(result.pos_source).toBe('EXPLICIT');
    });

    it('geeft null velden terug bij lege of ontbrekende notes', () => {
      const result = engine.extractSpatialFromNotes('');
      expect(result.etage_name).toBeNull();
      expect(result.room_name).toBeNull();
      expect(result.window_name).toBeNull();
      expect(result.cluster_name).toBeNull();
    });
  });

  describe('inferFloorForRoom', () => {
    it('leidt Begane grond af voor woonkamer, keuken en hal', () => {
      expect(engine.inferFloorForRoom('Woonkamer').etage_name).toBe('Begane grond');
      expect(engine.inferFloorForRoom('Keuken').etage_name).toBe('Begane grond');
      expect(engine.inferFloorForRoom('Hal').etage_name).toBe('Begane grond');
    });

    it('leidt 1e verdieping af voor slaapkamers en badkamer', () => {
      expect(engine.inferFloorForRoom('Slaapkamer 1').etage_name).toBe('1e verdieping');
      expect(engine.inferFloorForRoom('Badkamer').etage_name).toBe('1e verdieping');
    });

    it('leidt Zolder af voor zolder of vliering', () => {
      expect(engine.inferFloorForRoom('Zolder').etage_name).toBe('Zolder');
    });

    it('geeft precedence aan een expliciet in de order aanwezige verdieping voor een onbekende kamer', () => {
      const orderFloors = new Set(['2e verdieping']);
      const result = engine.inferFloorForRoom('Hobbyruimte', orderFloors);
      expect(result.etage_name).toBe('2e verdieping');
      expect(result.etage_source).toBe('INFERRED');
    });
  });

  describe('inferPositionForRoom', () => {
    it('genereert de eerste canonieke positie als er nog geen posities zijn', () => {
      const pos = engine.inferPositionForRoom('Woonkamer', '1.1', []);
      expect(pos.position_id).toBe('pos_woonkamer_01');
      expect(pos.window_name).toBe('Pos. 01 (N.t.b.)');
      expect(pos.pos_source).toBe('INFERRED');
    });

    it('genereert de volgende beschikbare positie-index om botsingen te voorkomen', () => {
      const pos = engine.inferPositionForRoom('Woonkamer', '1.1', ['pos_woonkamer_01']);
      expect(pos.position_id).toBe('pos_woonkamer_02');
      expect(pos.window_name).toBe('Pos. 02 (N.t.b.)');
      expect(pos.pos_source).toBe('INFERRED');
    });
  });

  describe('extractSpatialMetadata', () => {
    it('wijst een discrete unieke bufferpositie toe voor materiaal zonder ruimtelijke annotatie (anti-clobbering)', () => {
      const line: RawOrderLineInput = {
        line_number: 10,
        sub_line: 0,
        product_code: 'DUETTE',
        description: 'Duette shades',
        notes: null,
      };
      const result = engine.extractSpatialMetadata(line, '1.1');
      expect(result.etage_name).toBeNull();
      expect(result.room_name).toBeNull();
      expect(result.position_id).toBe('pos_onbekend_10');
      expect(result.window_name).toBe('Pos. N.t.b.');
      expect(result.pos_source).toBe('INFERRED');
    });

    it('gebruikt orderbrede context om out-of-order regel te koppelen aan unieke orderkamer', () => {
      const line: RawOrderLineInput = {
        line_number: 10,
        sub_line: 0,
        product_code: 'DUETTE',
        description: 'Duette shades',
        notes: '- Raam voorzijde',
      };
      const context: OrderSpatialContext = {
        orderFloors: new Set(['Begane grond']),
        orderRooms: new Set(['Woonkamer']),
        existingPositionsByRoom: new Map(),
      };
      const result = engine.extractSpatialMetadata(line, '1.1', context);
      expect(result.room_name).toBe('Woonkamer');
      expect(result.room_source).toBe('INFERRED');
      expect(result.window_name).toBe('Raam voorzijde');
      expect(result.pos_source).toBe('EXPLICIT');
      expect(result.etage_name).toBe('Begane grond');
    });
  });
});
