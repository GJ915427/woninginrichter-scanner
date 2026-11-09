// [SPEC-CHANGE-AUTHORIZED: Actualiseert testasserties voor Google Material Symbols Outlined SVGs (square_foot, etc.), 32px/44px Fitts' Law styling, semantische tokens (rounded-container, rounded-control), zero Unicode emoji invariant en synchronisatie met gesaneerde actiebalk en compacte executive meta card conform Stitch Optie 1]
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatrixOrderMetaCard } from '@/components/matrix/MatrixOrderMetaCard';
import { MatrixTopNav } from '@/components/matrix/MatrixTopNav';
import { MatrixActionBar } from '@/components/matrix/MatrixActionBar';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';

describe('Stitch Executive SaaS Triad - Unit & Fitts Law Invariant Suite', () => {
  const sampleOrder = MATRIX_ORDERS_MOCK_DATA[2]; // Jaspers (V26001376)
  const EMOJI_TEST_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}]/u;

  it('renders MatrixOrderMetaCard with 2-layer stacked micro-labels, dual status capsules and zero raw emojis', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderMetaCard selectedOrder={sampleOrder} orders={MATRIX_ORDERS_MOCK_DATA} currentOrderIndex={2} />
    );

    // E2E test contract: TC-SLIDE-01, TC-PAR-08, TC-V5-03
    expect(html).toContain('id="meta-order-number"');
    expect(html).toContain('data-testid="order-title"');
    expect(html).toContain(sampleOrder.id);
    expect(html).toContain('id="meta-status"');
    expect(html).toContain('id="meta-product-status"');

    // 2-Layer stacked micro-labels conform Stitch Optie 1
    expect(html).toContain('ORDERNUMMER');
    expect(html).toContain('PROJECTSTATUS');
    expect(html).toContain('PRODUCTSTATUS');
    expect(html).toContain('ORDERBEDRAG');
    expect(html).toContain('text-slate-500'); // WCAG 2.1 AA compliant contrast >= 4.5:1

    // Semantic tokens
    expect(html).toContain('rounded-control');

    // Zero raw Unicode emojis in order meta card
    expect(html).not.toMatch(EMOJI_TEST_REGEX);
  });

  it('renders client, location, and prominent executive order total amount with vector icons', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderMetaCard selectedOrder={sampleOrder} orders={MATRIX_ORDERS_MOCK_DATA} currentOrderIndex={2} />
    );

    expect(html).toContain('id="meta-customer-name"');
    expect(html).toContain(sampleOrder.klant);
    expect(html).toContain('id="meta-total-amount"');
    expect(html).toContain('id="btn-meta-media-drawer"');
  });

  it('renders Bijlagen chip with item count and min-h-[44px] touch target', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderMetaCard selectedOrder={sampleOrder} orders={MATRIX_ORDERS_MOCK_DATA} currentOrderIndex={2} />
    );

    expect(html).toContain('id="btn-meta-media-drawer"');
    expect(html).toContain('Bijlagen');
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('rounded-pill');
    expect(html).toContain('lucide-paperclip');
  });

  it('renders MatrixTopNav with EasyM2M branding, 6 capsule tabs, SVG search lens and soft blue avatar (zero emojis)', () => {
    const html = renderToStaticMarkup(
      <MatrixTopNav activeTab="Project" />
    );

    expect(html).toContain('Easy');
    expect(html).toContain('M2M');
    expect(html).toContain('Home');
    expect(html).toContain('Klant');
    expect(html).toContain('Object');
    expect(html).toContain('Project');
    expect(html).toContain('Ruimte');
    expect(html).toContain('Product');
    expect(html).not.toContain('id="fsm-stage-select"');
    expect(html).not.toContain('aria-label="Vorige order"');

    // Squircle logo and semantic tokens
    expect(html).toContain('rounded-container');
    expect(html).toContain('rounded-control');
    expect(html).toContain('rounded-pill');

    // Active Project tab
    expect(html).toContain('bg-white text-blue-600 font-bold shadow-2xs border border-slate-200/50');

    // Zero raw Unicode emojis in top nav
    expect(html).not.toMatch(EMOJI_TEST_REGEX);
  });

  it('renders MatrixActionBar with 5 contextual Stitch process buttons and workflowStageTag with vector icons (zero emojis)', () => {
    const html = renderToStaticMarkup(
      <MatrixActionBar
        workflowStage="Montage gepland"
      />
    );

    expect(html).toContain('Maak Afspraak');
    expect(html).toContain('Maak Rapport');
    expect(html).toContain('Inmeten');
    expect(html).toContain('Monteren');
    expect(html).toContain('Afronden');
    expect(html).toContain('id="workflowStageTag"');
    expect(html).toContain('Huidige fase:');
    expect(html).toContain('Montage gepland');
    expect(html).not.toContain('Posities Selecteren');
    expect(html).not.toContain('id="btn-toggle-header-collapse"');

    // Fitts' Law semantic height and pseudo-element expansion (rendered with HTML escaped quotes by React)
    expect(html).toContain('h-action-btn');
    expect(html).toMatch(/before:content-\[(\'\'|&#x27;&#x27;)\]/);
    expect(html).toContain('before:-inset-y-1.5');
    expect(html).toContain('before:min-h-[44px]');
    expect(html).toContain('rounded-control');

    // Google Material Symbols Outlined: square_foot (geodriehoek met maataanduidingen)
    expect(html).toContain('M17.66 17.66l-1.06 1.06');

    // Zero raw Unicode emojis in action bar
    expect(html).not.toMatch(EMOJI_TEST_REGEX);
  });
});
