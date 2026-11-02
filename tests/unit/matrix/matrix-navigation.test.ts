/**
 * tests/unit/matrix/matrix-navigation.test.ts
 *
 * Unit tests voor ordernavigatie bounds, breadcrumb datastructuren en cluster-selectie guards.
 * Pure functional tests in Node.js Vitest (Zero DOM dependency).
 */

import { describe, expect, it } from 'vitest';
import { MatrixOrder } from '../../../src/types/matrix';

describe('Matrix TopNav & Cluster Floating Bar Logic (Unit Tests)', () => {
  describe('TC-NAV-01: Order Index Boundary Clamping', () => {
    it('clampet vorige orderindex op 0 en kan niet onder 0 gaan', () => {
      const getPreviousIndex = (current: number): number => Math.max(0, current - 1);

      expect(getPreviousIndex(0)).toBe(0);
      expect(getPreviousIndex(1)).toBe(0);
      expect(getPreviousIndex(5)).toBe(4);
    });

    it('clampet volgende orderindex op max (total - 1)', () => {
      const totalOrders = 7;
      const getNextIndex = (current: number): number => Math.min(totalOrders - 1, current + 1);

      expect(getNextIndex(6)).toBe(6);
      expect(getNextIndex(5)).toBe(6);
      expect(getNextIndex(0)).toBe(1);
    });
  });

  describe('TC-NAV-02: Single-Room Cluster Selection Guard', () => {
    const mockOrder: MatrixOrder = {
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
      totaalbedragCents: 0,
      etages: [
        {
          id: 'et-1',
          name: 'BG',
          rooms: [
            {
              id: 'room-woonkamer',
              name: 'Woonkamer',
              clusters: [],
              positions: [
                { id: 'pos-wk-1', name: 'Woonkamer Voor', type: 'Raam' },
                { id: 'pos-wk-2', name: 'Woonkamer Zij', type: 'Raam' },
              ],
            },
            {
              id: 'room-hal',
              name: 'Hal',
              clusters: [],
              positions: [{ id: 'pos-hal-1', name: 'Voordeur', type: 'Raam' }],
            },
          ],
        },
      ],
      products: [],
    };

    function evaluateClusterSelection(
      order: MatrixOrder,
      selectedPosIds: string[]
    ): { isSingleRoom: boolean; roomId?: string; roomName?: string } {
      if (selectedPosIds.length === 0) return { isSingleRoom: true };

      const foundRooms = new Map<string, string>(); // roomId -> roomName

      for (const etage of order.etages) {
        for (const room of etage.rooms) {
          for (const pos of room.positions) {
            if (selectedPosIds.includes(pos.id)) {
              foundRooms.set(room.id, room.name);
            }
          }
        }
      }

      if (foundRooms.size === 1) {
        const [roomId, roomName] = Array.from(foundRooms.entries())[0];
        return { isSingleRoom: true, roomId, roomName };
      }

      return { isSingleRoom: false };
    }

    it('detecteert single-room selectie wanneer alle kolommen in dezelfde ruimte liggen', () => {
      const result = evaluateClusterSelection(mockOrder, ['pos-wk-1', 'pos-wk-2']);
      expect(result.isSingleRoom).toBe(true);
      expect(result.roomId).toBe('room-woonkamer');
      expect(result.roomName).toBe('Woonkamer');
    });

    it('detecteert cross-room selectie wanneer kolommen verspreid zijn over meerdere kamers', () => {
      const result = evaluateClusterSelection(mockOrder, ['pos-wk-1', 'pos-hal-1']);
      expect(result.isSingleRoom).toBe(false);
      expect(result.roomId).toBeUndefined();
    });
  });
});
