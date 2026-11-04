import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatrixProductDetailDrawer } from '@/components/matrix/MatrixProductDetailDrawer';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';

describe('Stitch Executive SaaS Triad - Sub-Fase 3B: MatrixProductDetailDrawer', () => {
  const sampleOrder = MATRIX_ORDERS_MOCK_DATA[2]; // Jaspers
  const sampleProduct = sampleOrder.products[0]; // GIW Duette®

  it('renders product catalog specifications and attributes', () => {
    const html = renderToStaticMarkup(
      <MatrixProductDetailDrawer
        isOpen={true}
        product={sampleProduct}
        positions={sampleOrder.etages.flatMap((e) => e.rooms.flatMap((r) => r.positions))}
        onClose={() => {}}
      />
    );

    expect(html).toContain(sampleProduct.name);
    expect(html).toContain(sampleProduct.code);
    expect(html).toContain(sampleProduct.category);
    expect(html).toContain('id="product-detail-drawer"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('renders spatial order footprint with configured positions', () => {
    const html = renderToStaticMarkup(
      <MatrixProductDetailDrawer
        isOpen={true}
        product={sampleProduct}
        positions={sampleOrder.etages.flatMap((e) => e.rooms.flatMap((r) => r.positions))}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Ruimtelijke Order Footprint');
    expect(html).toContain('posities geconfigureerd');
  });

  it('handles null product gracefully without crashing', () => {
    const html = renderToStaticMarkup(
      <MatrixProductDetailDrawer
        isOpen={true}
        product={null}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Geen product geselecteerd');
  });

  it('renders accessible close button with min-h-[44px]', () => {
    const html = renderToStaticMarkup(
      <MatrixProductDetailDrawer
        isOpen={true}
        product={sampleProduct}
        onClose={() => {}}
      />
    );

    expect(html).toContain('aria-label="Sluiten"');
    expect(html).toContain('min-h-[44px]');
  });
});
