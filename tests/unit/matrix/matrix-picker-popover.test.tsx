/**
 * tests/unit/matrix/matrix-picker-popover.test.tsx
 *
 * Dedicated testsuite voor MatrixOrderPickerPopover via pure Node SSR (renderToStaticMarkup).
 * Toetst popover rendering, benchmark pinning (DrHaack V26001761 en DA.AN V26001797),
 * stepper buttons, segmented buttons [Alles | Orders | Offertes] en lege zoekresultaat toestand.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatrixOrderPickerPopover } from '@/components/matrix/MatrixOrderPickerPopover';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';
import * as liveOrderModule from '@/hooks/useLiveOrderList';
import type { MatrixOrder } from '@/types/matrix';

describe('MatrixOrderPickerPopover Suite', () => {
  const sampleOrder: MatrixOrder = MATRIX_ORDERS_MOCK_DATA[0]; // V26001376 Jaspers

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rendert niets wanneer isOpen false is', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderPickerPopover
        isOpen={false}
        onClose={vi.fn()}
        selectedOrder={sampleOrder}
        orders={[]}
        currentOrderIndex={0}
      />
    );
    expect(html).toBe('');
  });

  it('rendert popover met listbox rol, stepper buttons, zoekbalk en type chips wanneer isOpen true is', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderPickerPopover
        isOpen={true}
        onClose={vi.fn()}
        selectedOrder={sampleOrder}
        orders={[]}
        currentOrderIndex={0}
      />
    );

    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-label="Order selectielijst"');
    expect(html).toContain('aria-label="Vorige order"');
    expect(html).toContain('aria-label="Volgende order"');
    expect(html).toContain('placeholder="Zoek op ordernr, klant of plaats..."');
    expect(html).toContain('Alles');
    expect(html).toContain('Orders');
    expect(html).toContain('Offertes');
  });

  it('pint benchmark orders (DrHaack V26001761 en DA.AN V26001797) bovenaan bij afwezigheid van zoekterm', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderPickerPopover
        isOpen={true}
        onClose={vi.fn()}
        selectedOrder={sampleOrder}
        orders={[]}
        currentOrderIndex={0}
      />
    );

    // E2E test determinisme voor TC-PAR-08 en TC-NAV-01
    expect(html).toContain('V26001761');
    expect(html).toContain('DrHaack');
    expect(html).toContain('V26001797');
    expect(html).toContain('DA.AN');
  });

  it('toont disabled state op vorige order knop wanneer de eerste order in de lijst is geselecteerd', () => {
    // DrHaack is index 0 in benchmark pinning
    const drHaackOrder: MatrixOrder = {
      ...sampleOrder,
      id: 'V26001761',
      klant: 'DrHaack holding b.v.',
    };

    const html = renderToStaticMarkup(
      <MatrixOrderPickerPopover
        isOpen={true}
        onClose={vi.fn()}
        selectedOrder={drHaackOrder}
        orders={[]}
        currentOrderIndex={0}
      />
    );

    expect(html).toContain('aria-label="Vorige order" disabled=""');
    expect(html).toContain('1 / 7');
  });

  it('toont disabled state op volgende order knop wanneer de laatste order in de lijst is geselecteerd', () => {
    // Cobben is de 7e order (index 6) in benchmark pinning
    const cobbenOrder: MatrixOrder = {
      ...sampleOrder,
      id: 'V26001479',
      klant: 'Cobben',
    };

    const html = renderToStaticMarkup(
      <MatrixOrderPickerPopover
        isOpen={true}
        onClose={vi.fn()}
        selectedOrder={cobbenOrder}
        orders={[]}
        currentOrderIndex={6}
      />
    );

    expect(html).toContain('aria-label="Volgende order" disabled=""');
    expect(html).toContain('7 / 7');
  });

  it('markeert de geselecteerde order met aria-selected="true" en actieve stijl', () => {
    const html = renderToStaticMarkup(
      <MatrixOrderPickerPopover
        isOpen={true}
        onClose={vi.fn()}
        selectedOrder={sampleOrder}
        orders={[]}
        currentOrderIndex={2}
      />
    );

    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('bg-sky-50 text-sky-900 font-semibold border border-sky-200');
  });

  it('toont correcte lege toestand wanneer noch benchmarks noch live orders aanwezig zijn', () => {
    vi.spyOn(liveOrderModule, 'getMockOrderSummaries').mockReturnValue([]);

    const html = renderToStaticMarkup(
      <MatrixOrderPickerPopover
        isOpen={true}
        onClose={vi.fn()}
        selectedOrder={sampleOrder}
        orders={[]}
        currentOrderIndex={0}
      />
    );

    expect(html).toContain('Geen orders of offertes gevonden');
    expect(html).toContain('0 / 0');
  });

  it('dedupliceert orders wanneer een benchmark order ook in de live orders prop voorkomt', () => {
    const liveOrdersWithDuplicate = [
      { id: 'V26001761', klant: 'DrHaack Live', status: 'Definitief', totaalbedragCents: 500000 },
      { id: 'V26999999', klant: 'Unieke Nieuwe Klant', status: 'Definitief', totaalbedragCents: 100000 },
    ];

    const html = renderToStaticMarkup(
      <MatrixOrderPickerPopover
        isOpen={true}
        onClose={vi.fn()}
        selectedOrder={sampleOrder}
        orders={liveOrdersWithDuplicate}
        currentOrderIndex={0}
      />
    );

    // V26001761 moet exact 1 keer voorkomen als option button (geen dubbele entries)
    const occurrences = (html.match(/V26001761/g) || []).length;
    expect(occurrences).toBe(1);
    // Unieke nieuwe klant moet ook gerenderd worden
    expect(html).toContain('V26999999');
    expect(html).toContain('Unieke Nieuwe Klant');
    // Totaal count in catalogus header moet 8 zijn (7 benchmarks + 1 unieke live)
    expect(html).toContain('Catalogus (8)');
  });
});
