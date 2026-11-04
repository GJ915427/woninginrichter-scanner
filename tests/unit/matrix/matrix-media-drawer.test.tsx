import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatrixMediaDrawer } from '@/components/matrix/MatrixMediaDrawer';
import { MatrixMediaCard } from '@/components/matrix/MatrixMediaCard';
import { MatrixMediaInlineForm } from '@/components/matrix/MatrixMediaInlineForm';
import { MediaItem } from '@/types/matrix';

describe('Stitch Executive SaaS Triad - Sub-Fase 3C: Media & Notitie Drawer Decompositie', () => {
  const sampleNote: MediaItem = {
    id: 'med_test_01',
    entityType: 'position',
    entityId: 'pos_wk_pui',
    type: 'note',
    title: 'Nisdiepte Controle',
    description: 'Nisdiepte 140mm nauwkeurig nameten voor rail.',
    date: '08 aug 2026',
    author: 'Inmeter Jan',
  };

  const samplePhoto: MediaItem = {
    id: 'med_test_02',
    entityType: 'order',
    entityId: 'V26001376',
    type: 'photo',
    title: 'Voorgevel Villa',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
    date: '07 aug 2026',
    author: 'Carlo Heinemans',
  };

  it('renders MatrixMediaCard with entityType, date, title and description', () => {
    const html = renderToStaticMarkup(<MatrixMediaCard item={sampleNote} />);

    expect(html).toContain('position: pos_wk_pui');
    expect(html).toContain('08 aug 2026');
    expect(html).toContain('Nisdiepte Controle');
    expect(html).toContain('Nisdiepte 140mm nauwkeurig nameten');
  });

  it('renders MatrixMediaCard with image element when photo url is provided', () => {
    const html = renderToStaticMarkup(<MatrixMediaCard item={samplePhoto} />);

    expect(html).toContain('<img');
    expect(html).toContain(samplePhoto.url);
    expect(html).toContain('alt="Voorgevel Villa"');
  });

  it('renders MatrixMediaInlineForm with min-h-[44px] accessible submit button', () => {
    const html = renderToStaticMarkup(
      <MatrixMediaInlineForm onSubmit={() => {}} />
    );

    expect(html).toContain('aria-label="Notitie toevoegen"');
    expect(html).toContain('min-h-[44px]');
  });

  it('renders MatrixMediaDrawer with decomposed cards and forms', () => {
    const html = renderToStaticMarkup(
      <MatrixMediaDrawer
        isOpen={true}
        activeTab="opmerking"
        onClose={() => {}}
        onTabChange={() => {}}
        items={[sampleNote]}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Nisdiepte Controle');
    expect(html).toContain('aria-label="Notitie toevoegen"');
  });
});
