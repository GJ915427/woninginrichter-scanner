import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Isometric3DViewer } from '@/components/3d/Isometric3DViewer';

describe('Isometric3DViewer Component Unit Tests', () => {
  it('should render 3D viewer container with controls and attributes', () => {
    const mockBuildingData = {
      lod22Available: true,
      roofSurfacesCount: 4,
      wallSurfacesCount: 4,
      groundSurfacesCount: 1,
      minHeightNAP: 45.2,
      maxHeightNAP: 54.8,
      roofType: 'Zadeldak',
    };

    const html = renderToStaticMarkup(
      <Isometric3DViewer
        pandId="0953100000003503"
        buildingData={mockBuildingData}
      />
    );

    expect(html).toContain('data-testid="isometric-3d-viewer"');
    expect(html).toContain('3D BAG LoD 2.2 Volumemodel');
    expect(html).toContain('0953100000003503');
    expect(html).toContain('Zadeldak');
  });
});
