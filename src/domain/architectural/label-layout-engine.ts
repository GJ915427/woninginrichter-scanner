import polylabel from '@mapbox/polylabel';
import { Point2D, Segment2D } from '../geometry/types';
import { Polygon2D } from '../geometry/polygon';
import { Vector2D } from '../geometry/vector';
import { LabelStackItem, RoomLabelResult, DimensionChainItem } from './types';

export interface LabelStackInput {
  id: string;
  nominalY: number;
  text: string;
  side?: 'left' | 'right';
  x?: number;
}

export class LabelLayoutEngine {
  /**
   * Resolves 1D vertical label collisions (e.g. Peilketting elevation markers)
   * using 1D interval stacking with jogged leaders.
   */
  static resolveVerticalStack(
    items: LabelStackInput[],
    minGap: number = 0.45
  ): LabelStackItem[] {
    if (items.length === 0) return [];

    // Sort ascending by nominal height
    const sorted = [...items].sort((a, b) => a.nominalY - b.nominalY);

    const result: LabelStackItem[] = [];

    // First item starts at its nominal position
    const first = sorted[0];
    result.push({
      id: first.id,
      nominalY: first.nominalY,
      joggedY: Math.round(first.nominalY * 100) / 100,
      isJogged: false,
      text: first.text,
      side: first.side ?? 'right',
      x: first.x,
    });

    for (let i = 1; i < sorted.length; i++) {
      const prev = result[i - 1];
      const curr = sorted[i];

      const gap = curr.nominalY - prev.joggedY;
      let joggedY = curr.nominalY;
      let isJogged = false;

      if (gap < minGap) {
        joggedY = prev.joggedY + minGap;
        isJogged = true;
      }

      result.push({
        id: curr.id,
        nominalY: curr.nominalY,
        joggedY: Math.round(joggedY * 100) / 100,
        isJogged,
        text: curr.text,
        side: curr.side ?? 'right',
        x: curr.x,
      });
    }

    return result;
  }

  /**
   * Generates jogged leader line points connecting physical level (xAnchor, nominalY)
   * to displaced label text position (xText, joggedY).
   */
  static computeJoggedLeaderPoints(
    item: LabelStackItem,
    xAnchor: number,
    xDisplacement: number = 0.8
  ): Point2D[] {
    const isRight = item.side !== 'left';
    const xText = isRight ? xAnchor + xDisplacement : xAnchor - xDisplacement;

    if (!item.isJogged) {
      // Straight horizontal leader line
      return [
        { x: xAnchor, y: item.nominalY },
        { x: xText, y: item.nominalY },
      ];
    }

    // Architectural dog-leg leader:
    // [ (xAnchor, nominalY), (xMid, nominalY), (xMid + jogOffset, joggedY), (xText, joggedY) ]
    const midX = isRight ? xAnchor + 0.25 * xDisplacement : xAnchor - 0.25 * xDisplacement;
    const dogLegX = isRight ? xAnchor + 0.50 * xDisplacement : xAnchor - 0.50 * xDisplacement;

    return [
      { x: xAnchor, y: item.nominalY },
      { x: midX, y: item.nominalY },
      { x: dogLegX, y: item.joggedY },
      { x: xText, y: item.joggedY },
    ];
  }

  /**
   * Computes the 2D pole of inaccessibility (interior point furthest from boundaries)
   * for room labels using @mapbox/polylabel.
   */
  static computeRoomLabelPlacement(
    roomPolygon: Polygon2D,
    roomName: string,
    precision: number = 0.1
  ): RoomLabelResult {
    const closedCoords = roomPolygon.toClosedArray();
    const ringPolygon: [number, number][][] = [closedCoords];

    const pole = polylabel(ringPolygon, precision);
    const labelPosition: Point2D = {
      x: Math.round(pole[0] * 1000) / 1000,
      y: Math.round(pole[1] * 1000) / 1000,
    };

    const { distance } = roomPolygon.closestPointOnBoundary(labelPosition);
    const areaM2 = Math.round(roomPolygon.area() * 100) / 100;

    return {
      roomName,
      labelPosition,
      areaM2,
      distanceToBoundary: Math.round(distance * 1000) / 1000,
    };
  }

  /**
   * Generates a 3-tier architectural dimension chain hierarchy (NEN 3861 / DIN 1356).
   * Tier 1 (1.2m offset): Openings / piers
   * Tier 2 (2.0m offset): Volume offsets
   * Tier 3 (2.8m offset): Total building dimension
   */
  static createDimensionChain(
    buildingEdge: Segment2D,
    outwardNormal: Point2D,
    subDivisions?: Array<{ tStart: number; tEnd: number; label: string }>
  ): DimensionChainItem[] {
    const vEdge = Vector2D.fromPoints(buildingEdge.p1, buildingEdge.p2);
    const totalLen = vEdge.length();
    const uEdge = vEdge.scale(1 / totalLen);
    const n = Vector2D.fromPoint(outwardNormal).normalize();

    const items: DimensionChainItem[] = [];

    // Tier 3: Overall Total Dimension (Offset 2.8m)
    const tier3Offset = 2.8;
    const t3Start = Vector2D.fromPoint(buildingEdge.p1).add(n.scale(tier3Offset));
    const t3End = Vector2D.fromPoint(buildingEdge.p2).add(n.scale(tier3Offset));
    items.push({
      tier: 3,
      offsetMeters: tier3Offset,
      startPoint: { x: t3Start.x, y: t3Start.y },
      endPoint: { x: t3End.x, y: t3End.y },
      dimensionMeters: Math.round(totalLen * 100) / 100,
      label: `${(Math.round(totalLen * 100) / 100).toFixed(2)} m`,
    });

    // Tier 1: Sub-divisions (Openings/piers) if provided
    if (subDivisions && subDivisions.length > 0) {
      const tier1Offset = 1.2;
      for (const sub of subDivisions) {
        const pA = Vector2D.fromPoint(buildingEdge.p1)
          .add(vEdge.scale(sub.tStart))
          .add(n.scale(tier1Offset));
        const pB = Vector2D.fromPoint(buildingEdge.p1)
          .add(vEdge.scale(sub.tEnd))
          .add(n.scale(tier1Offset));
        const subLen = (sub.tEnd - sub.tStart) * totalLen;

        items.push({
          tier: 1,
          offsetMeters: tier1Offset,
          startPoint: { x: pA.x, y: pA.y },
          endPoint: { x: pB.x, y: pB.y },
          dimensionMeters: Math.round(subLen * 100) / 100,
          label: sub.label || `${(Math.round(subLen * 100) / 100).toFixed(2)} m`,
        });
      }
    }

    return items;
  }
}
