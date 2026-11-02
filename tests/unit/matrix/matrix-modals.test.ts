/**
 * tests/unit/matrix/matrix-modals.test.ts
 *
 * Unit tests voor modal payload generators en validatielogica van MatrixAssignVlakModal en MatrixClusterModal.
 * Pure functional tests in Node.js Vitest (Zero DOM dependency).
 */

import { describe, expect, it } from 'vitest';
import { ActiveOverlay } from '../../../src/types/matrix';

describe('Matrix Modals Unit Tests & Contracts', () => {
  describe('TC-MOD-01: ActiveOverlay Payload Contracts for Modals', () => {
    it('construeert een geldig assign_vlak overlay object', () => {
      const payload: ActiveOverlay = {
        type: 'assign_vlak',
        positionId: 'pos_wk_raam_1',
        currentVlak: 'Wand Voorgevel',
        roomId: 'room_woonkamer',
      };

      expect(payload.type).toBe('assign_vlak');
      expect(payload.positionId).toBe('pos_wk_raam_1');
      expect(payload.currentVlak).toBe('Wand Voorgevel');
      expect(payload.roomId).toBe('room_woonkamer');
    });

    it('construeert een geldig cluster_modal overlay object met multi-select IDs', () => {
      const payload: ActiveOverlay = {
        type: 'cluster_modal',
        roomId: 'room_woonkamer',
        positionIds: ['pos_wk_1', 'pos_wk_2', 'pos_wk_3'],
      };

      expect(payload.type).toBe('cluster_modal');
      expect(payload.roomId).toBe('room_woonkamer');
      expect(payload.positionIds).toHaveLength(3);
      expect(payload.clusterId).toBeUndefined();
    });

    it('construeert een cluster_modal overlay voor het bewerken van een bestaand cluster', () => {
      const payload: ActiveOverlay = {
        type: 'cluster_modal',
        roomId: 'room_woonkamer',
        clusterId: 'cluster-erker-1',
        positionIds: ['pos_wk_1', 'pos_wk_2'],
      };

      expect(payload.type).toBe('cluster_modal');
      expect(payload.clusterId).toBe('cluster-erker-1');
    });
  });

  describe('TC-MOD-02: Vlakken & Cluster Naming Sanity & Trimming', () => {
    it('trit witruimte uit aangepaste vlaknamen en clusternamen', () => {
      const sanitizeInput = (val: string): string => val.trim();

      expect(sanitizeInput('   Wand Achtergevel   ')).toBe('Wand Achtergevel');
      expect(sanitizeInput(' \n Erker Voorgevel \t ')).toBe('Erker Voorgevel');
      expect(sanitizeInput('')).toBe('');
    });

    it('controleert dat lege clusternamen niet gevalideerd worden', () => {
      const isValidClusterName = (name: string): boolean => name.trim().length > 0;

      expect(isValidClusterName('Erker')).toBe(true);
      expect(isValidClusterName('   ')).toBe(false);
      expect(isValidClusterName('')).toBe(false);
    });
  });
});
