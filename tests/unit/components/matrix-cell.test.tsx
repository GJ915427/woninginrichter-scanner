// [SPEC-CHANGE-AUTHORIZED: Nieuwe unit-testsuite voor Stitch Optie 1 MatrixCell cardificatie, CSS table height context, ml-auto regelnummer verankering, WCAG AA contrast en SSOT monetaire weergave]
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatrixCell } from '@/components/matrix/MatrixCell';
import { CellPriceData } from '@/types/matrix';

describe('MatrixCell Cardification Suite', () => {
  const mockClick = vi.fn();
  const mockContextMenu = vi.fn();

  const standardCellData: CellPriceData = {
    line: 20,
    subPos: 'a',
    quantity: 1,
    unit: 'st',
    unitPriceCents: 89522,
    totalPriceCents: 89522,
    isInbegrepen: false,
    dim: '1100x2240',
    note: 'Standaard maatvoering',
  };

  it('renders standard cell with Stitch Optie 1 card container, centered bold dimensions and emerald price', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <MatrixCell
              productId="prod-1"
              positionId="pos-1"
              cellData={standardCellData}
              hasMultipleSubPositions={true}
              onCellClick={mockClick}
              onCellContextMenu={mockContextMenu}
            />
          </tr>
        </tbody>
      </table>
    );

    // <td> draagt CSS table percentage context h-full en group/cell
    expect(html).toContain('group/cell');
    expect(html).toContain('h-full');
    expect(html).toContain('w-[160px]');
    expect(html).toContain('p-1.5');
    expect(html).toContain('align-top');

    // Innerlijke Stitch productcard
    expect(html).toContain('rounded-control');
    expect(html).toContain('shadow-2xs');
    expect(html).toContain('border-slate-200/80');
    expect(html).toContain('group-hover/cell:border-blue-300');

    // Header met subpositie en regelnummer
    expect(html).toContain('[a]');
    expect(html).toContain('#20');
    expect(html).toContain('ml-auto');

    // Midden: gecentreerde bold afmeting met maatteken × en WCAG AA notitie
    expect(html).toContain('1100×2240');
    expect(html).toContain('font-bold');
    expect(html).toContain('text-slate-900');
    expect(html).toContain('Standaard maatvoering');
    expect(html).toContain('text-slate-500');

    // Footer: aantal en prijs in emerald
    expect(html).toContain('1 st');
    expect(html).toContain('text-emerald-700');
    expect(html).toContain('€ 895,22');
  });

  it('anchors #line to the top-right via ml-auto when subPos is absent or single', () => {
    const singleSubPosData: CellPriceData = {
      ...standardCellData,
      line: 42,
      subPos: 'a',
    };

    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <MatrixCell
              productId="prod-2"
              positionId="pos-2"
              cellData={singleSubPosData}
              hasMultipleSubPositions={false}
              onCellClick={mockClick}
              onCellContextMenu={mockContextMenu}
            />
          </tr>
        </tbody>
      </table>
    );

    // [a] mag NIET renderen bij hasMultipleSubPositions=false
    expect(html).not.toContain('[a]');
    // #42 moet met ml-auto strak rechtsboven staan
    expect(html).toContain('#42');
    expect(html).toContain('ml-auto');
  });

  it('renders Inbegrepen badge without zero euro display for included line items', () => {
    const includedCellData: CellPriceData = {
      line: 30,
      quantity: 2,
      unit: 'st',
      unitPriceCents: 0,
      totalPriceCents: 0,
      isInbegrepen: true,
      dim: '800x1200',
    };

    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <MatrixCell
              productId="prod-3"
              positionId="pos-3"
              cellData={includedCellData}
              onCellClick={mockClick}
              onCellContextMenu={mockContextMenu}
            />
          </tr>
        </tbody>
      </table>
    );

    expect(html).toContain('Inbegrepen');
    expect(html).toContain('text-amber-800');
    expect(html).toContain('bg-amber-50');
    // Geen dubbele 0-euro weergave
    expect(html).not.toContain('€ 0,00');
  });

  it('renders clean placeholder (—) for empty cells without card styling', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <MatrixCell
              productId="prod-empty"
              positionId="pos-empty"
              cellData={undefined}
              onCellClick={mockClick}
              onCellContextMenu={mockContextMenu}
            />
          </tr>
        </tbody>
      </table>
    );

    expect(html).toContain('—');
    expect(html).toContain('text-slate-300');
    expect(html).not.toContain('rounded-control');
    expect(html).not.toContain('shadow-2xs');
  });

  it('applies warm amber background for Algemeen column positions', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <MatrixCell
              productId="prod-gen"
              positionId="pos_project_algemeen"
              cellData={standardCellData}
              onCellClick={mockClick}
              onCellContextMenu={mockContextMenu}
            />
          </tr>
        </tbody>
      </table>
    );

    expect(html).toContain('bg-amber-50/30');
  });
});
