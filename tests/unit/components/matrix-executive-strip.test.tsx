import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatrixOrderMetaCard } from '@/components/matrix/MatrixOrderMetaCard';
import { MatrixTopNav } from '@/components/matrix/MatrixTopNav';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';

describe('Stitch Executive SaaS Triad - Sub-Fase 3A: TopNav & Executive Strip', () => {
  const sampleOrder = MATRIX_ORDERS_MOCK_DATA[2]; // Jaspers (V26001376)

  it('renders MatrixOrderMetaCard with semantic h1 and data-testid for Playwright compatibility', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderMetaCard selectedOrder={sampleOrder} />
    );

    // E2E test contract: TC-SLIDE-01, TC-PAR-08, TC-V5-03
    expect(html).toContain('id="meta-order-number"');
    expect(html).toContain('data-testid="order-title"');
    expect(html).toContain(sampleOrder.id);
  });

  it('renders client, quote and executive order total amount', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderMetaCard selectedOrder={sampleOrder} />
    );

    expect(html).toContain('id="meta-quote-number"');
    expect(html).toContain('id="meta-customer-name"');
    expect(html).toContain(sampleOrder.klant);
    expect(html).toContain('id="meta-total-amount"');
  });

  it('renders Bijlagen chip with item count and min-h-[44px] touch target', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderMetaCard selectedOrder={sampleOrder} />
    );

    expect(html).toContain('id="btn-meta-media-drawer"');
    expect(html).toContain('Bijlagen');
    expect(html).toContain('min-h-[44px]');
  });

  it('does NOT render any naive standalone Inmeten primary action button', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderMetaCard selectedOrder={sampleOrder} />
    );

    // Falsification check: Inmeten is position-level, not global order-level
    expect(html).not.toContain('>Inmeten</button>');
    expect(html).not.toContain('id="btn-primary-inmeten"');
  });

  it('renders MatrixTopNav with EasyM2M branding, breadcrumbs and order switcher', () => {
    const html = renderToStaticMarkup(
      <MatrixTopNav
        currentOrderIndex={2}
        totalOrders={3}
        onPreviousOrder={() => {}}
        onNextOrder={() => {}}
      />
    );

    expect(html).toContain('Easy');
    expect(html).toContain('M2M');
    expect(html).toContain('aria-label="Vorige order"');
    expect(html).toContain('aria-label="Volgende order"');
    expect(html).toContain('3 / 3');
  });
});
