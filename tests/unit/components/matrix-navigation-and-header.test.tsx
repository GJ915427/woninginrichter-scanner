// [SPEC-CHANGE-AUTHORIZED: Element-specifieke asserties voor afwezigheid pseudo-hitbox op #meta-status en #meta-product-status en toren-cel rowSpan]
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatrixOrderMetaCard } from '@/components/matrix/MatrixOrderMetaCard';
import { MatrixHeader } from '@/components/matrix/MatrixHeader';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';

describe('Hoofdscherm 4 Navigatie, Badges en Toren-Header Suite', () => {
  const sampleOrder = MATRIX_ORDERS_MOCK_DATA[2]; // Jaspers (V26001376)

  it('toetst dat interactieve knoppen wel een Fitts touch-hitbox (before:min-h-[44px]) hebben, maar statische statusbadges niet', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderMetaCard
        selectedOrder={sampleOrder}
        orders={MATRIX_ORDERS_MOCK_DATA}
        currentOrderIndex={2}
      />
    );

    // 1. Verifieer dat interactieve controls wel de Fitts touch target bezitten
    const orderBtnMatch = html.match(/<button[^>]*id="meta-order-number"[^>]*>([\s\S]*?)<\/button>/);
    expect(orderBtnMatch).not.toBeNull();
    expect(orderBtnMatch![0]).toContain('before:min-h-[44px]');
    expect(orderBtnMatch![0]).toContain('h-[30px]');

    const mediaBtnMatch = html.match(/<button[^>]*id="btn-meta-media-drawer"[^>]*>([\s\S]*?)<\/button>/);
    expect(mediaBtnMatch).not.toBeNull();
    expect(mediaBtnMatch![0]).toContain('before:min-h-[44px]');

    // 2. Verifieer dat statische non-interactieve spans GEEN fantoom hitbox bezitten
    const statusMatch = html.match(/<span[^>]*id="meta-status"[^>]*>([\s\S]*?)<\/span>/);
    expect(statusMatch).not.toBeNull();
    expect(statusMatch![0]).not.toContain('before:min-h-[44px]');
    expect(statusMatch![0]).not.toContain('min-h-[44px]');
    expect(statusMatch![0]).toContain('h-[30px]');
    expect(statusMatch![0]).toContain('rounded-control');

    const productStatusMatch = html.match(/<span[^>]*id="meta-product-status"[^>]*>([\s\S]*?)<\/span>/);
    expect(productStatusMatch).not.toBeNull();
    expect(productStatusMatch![0]).not.toContain('before:min-h-[44px]');
    expect(productStatusMatch![0]).not.toContain('min-h-[44px]');
    expect(productStatusMatch![0]).toContain('h-[30px]');
    expect(productStatusMatch![0]).toContain('rounded-control');
  });

  it('toetst dat MatrixHeader de Kolom 1 toren-cel declaratief rendert met rowSpan=4 bij alle niveaus actief', () => {
    const defaultLevels = { etage: true, ruimte: true, cluster: true, positie: true };
    const html = renderToStaticMarkup(
      <table>
        <MatrixHeader
          etages={sampleOrder.etages}
          visibleLevels={defaultLevels}
          selectedColumnIds={new Set()}
          onToggleColumnSelection={() => {}}
        />
      </table>
    );

    expect(html).toContain('data-testid="header-tower-col1"');
    const towerCellMatch = html.match(/<th[^>]*data-testid="header-tower-col1"[^>]*>/i) || html.match(/<th[^>]*rowspan="4"[^>]*>/i);
    expect(towerCellMatch).not.toBeNull();
    expect(html).toMatch(/rowspan="4"/i);
    expect(html).toContain('Algemeen');
    expect(html).toContain('Projectscope Diensten');
  });

  it('toetst dat MatrixHeader de toren-cel declaratief aanpast naar rowSpan=2 wanneer etage en ruimte zijn uitgeschakeld', () => {
    const compactLevels = { etage: false, ruimte: false, cluster: true, positie: true };
    const html = renderToStaticMarkup(
      <table>
        <MatrixHeader
          etages={sampleOrder.etages}
          visibleLevels={compactLevels}
          selectedColumnIds={new Set()}
          onToggleColumnSelection={() => {}}
        />
      </table>
    );

    expect(html).toContain('data-testid="header-tower-col1"');
    expect(html).toMatch(/rowspan="2"/i);
  });
});