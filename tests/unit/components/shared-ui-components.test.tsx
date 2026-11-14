import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CustomerContextBlock } from '@/components/domain/CustomerContextBlock';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';

describe('Shared UI Primitives & Domain Organisms Suite (Phase 2 TDD Red)', () => {
  const sampleOrder = MATRIX_ORDERS_MOCK_DATA[2]; // Jaspers (V26001376)

  it('renders MicroLabel with uppercase tracking-wider styling and optional value', () => {
    const html = renderToStaticMarkup(
      <MicroLabel label="Ordernummer" value="V26001376" />
    );
    expect(html).toContain('ORDERNUMMER');
    expect(html).toContain('V26001376');
    expect(html).toContain('tracking-wider');
    expect(html).toContain('text-slate-500');
  });

  it('renders ActionButton with physical layout bounding box (min-h-[44px]) and no pseudo-element hack', () => {
    const html = renderToStaticMarkup(
      <ActionButton variant="primary">Opslaan</ActionButton>
    );
    expect(html).toContain('Opslaan');
    expect(html).toContain('min-h-[44px]');
    expect(html).not.toContain('before:min-h-[44px]');
    expect(html).not.toContain('before:-inset');
  });

  it('renders StatusBadge with rounded-control and 800-shade text contrast', () => {
    const html = renderToStaticMarkup(
      <StatusBadge label="In behandeling" tone="warning" dot={true} />
    );
    expect(html).toContain('In behandeling');
    expect(html).toContain('rounded-control');
    expect(html).toContain('text-amber-800');
  });

  it('renders CustomerContextBlock with customer, address and popover trigger in pure Node SSR', () => {
    const html = renderToStaticMarkup(
      <CustomerContextBlock
        customerName="Jaspers (Maastricht)"
        orderNumber="V26001376"
        address="Sint Pieterstraat 12, Maastricht"
        orders={MATRIX_ORDERS_MOCK_DATA}
        selectedOrder={sampleOrder}
      />
    );
    expect(html).toContain('Jaspers (Maastricht)');
    expect(html).toContain('V26001376');
    expect(html).toContain('Sint Pieterstraat 12, Maastricht');
    expect(html).toContain('lucide-chevron-down');
    expect(html).not.toContain('before:min-h-[44px]');
  });
});
