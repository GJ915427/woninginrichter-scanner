import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InteractiveMapPicker } from '@/components/map/InteractiveMapPicker';

describe('InteractiveMapPicker Component Unit Tests', () => {
  it('should render map container with action buttons', () => {
    const onSelect = vi.fn();
    const html = renderToStaticMarkup(
      <InteractiveMapPicker
        selectedAddress="Rijksweg 153b, Gronsveld"
        onSelectPand={onSelect}
      />
    );

    expect(html).toContain('data-testid="interactive-map-container"');
    expect(html).toContain('Rijksweg 153b, Gronsveld');
    expect(html).toContain('Kadastrale &amp; Satelliet Pandviewer');
  });
});
