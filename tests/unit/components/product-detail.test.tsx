// [SPEC-CHANGE-AUTHORIZED: Nieuwe unit testsuite voor Product Detail componenten]
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductDetailMetaHeader } from '@/components/product-detail/ProductDetailMetaHeader';
import { ProductDetailStageBar } from '@/components/product-detail/ProductDetailStageBar';
import { ProductDetailTitleBanner } from '@/components/product-detail/ProductDetailTitleBanner';
import { ProductSpecificationsCard } from '@/components/product-detail/ProductSpecificationsCard';
import { ProductMediaNotesCard } from '@/components/product-detail/ProductMediaNotesCard';
import { ProductMeasurementCanvasCard } from '@/components/product-detail/ProductMeasurementCanvasCard';
import { ProductChecklistSafetyCard } from '@/components/product-detail/ProductChecklistSafetyCard';
import { MOCK_PRODUCT_DETAIL_DATA } from '@/fixtures/product-detail-fixtures';

describe('Product Detail SSR & Component Suite', () => {
  it('renders ProductDetailMetaHeader with context labels and attachments trigger', () => {
    const html = renderToStaticMarkup(
      <ProductDetailMetaHeader
        customerName={MOCK_PRODUCT_DETAIL_DATA.customerName}
        customerLocation={MOCK_PRODUCT_DETAIL_DATA.customerLocation}
        roomName={MOCK_PRODUCT_DETAIL_DATA.roomName}
        positionDescription={MOCK_PRODUCT_DETAIL_DATA.positionDescription}
        status={MOCK_PRODUCT_DETAIL_DATA.status}
        attachmentsCount={MOCK_PRODUCT_DETAIL_DATA.attachmentsCount}
      />
    );

    expect(html).toContain('Fam. Jaspers (Villa Maastricht)');
    expect(html).toContain('Sint Pieterstraat 12, Maastricht');
    expect(html).toContain('Hal');
    expect(html).toContain('01a (Raam Rechts)');
    expect(html).toContain('Definitief');
    expect(html).toContain('Bijlagen 7');
    expect(html).toContain('min-h-[44px]');
  });

  it('renders ProductDetailStageBar with FSM action buttons and stage badge', () => {
    const html = renderToStaticMarkup(
      <ProductDetailStageBar currentStage={MOCK_PRODUCT_DETAIL_DATA.fsmStage} />
    );

    expect(html).toContain('Start Inmeten');
    expect(html).toContain('Start Monteren');
    expect(html).toContain('Issue Registreren');
    expect(html).toContain('Montage gepland');
    expect(html).toContain('min-h-[44px]');
  });

  it('renders ProductDetailTitleBanner with correct titles, tags and formatted euro pricing', () => {
    const html = renderToStaticMarkup(
      <ProductDetailTitleBanner
        productName={MOCK_PRODUCT_DETAIL_DATA.productName}
        category={MOCK_PRODUCT_DETAIL_DATA.productCategory}
        roomName={MOCK_PRODUCT_DETAIL_DATA.roomName}
        positionCode={MOCK_PRODUCT_DETAIL_DATA.positionCode}
        productionWidthMm={MOCK_PRODUCT_DETAIL_DATA.measurements.width.finalProductionMm}
        productionHeightMm={MOCK_PRODUCT_DETAIL_DATA.measurements.height.finalProductionMm}
        priceCents={MOCK_PRODUCT_DETAIL_DATA.priceCents}
      />
    );

    expect(html).toContain('GIW Duette® 32mm SmartCord');
    expect(html).toContain('Binnenzonwering');
    expect(html).toContain('1093');
    expect(html).toContain('2238');
    // Format 89522 cents -> € 895,22
    expect(html).toContain('895,22');
    expect(html).toContain('incl. BTW');
  });

  it('renders ProductSpecificationsCard with all 5 specification rows', () => {
    const html = renderToStaticMarkup(
      <ProductSpecificationsCard specifications={MOCK_PRODUCT_DETAIL_DATA.specifications} />
    );

    expect(html).toContain('Champagne F85807 (Lichtdoorlatend)');
    expect(html).toContain('Warm Champagne / Wit RAL 9010');
    expect(html).toContain('SmartCord Top-Down / Bottom-Up');
    expect(html).toContain('In de dag (25mm beugel)');
    expect(html).toContain('ca. 145 mm');
    expect(html).toContain('Wijzigen');
    expect(html).toContain('min-h-[44px]');
  });

  it('renders ProductMediaNotesCard with feed items and action triggers', () => {
    const html = renderToStaticMarkup(
      <ProductMediaNotesCard feedItems={MOCK_PRODUCT_DETAIL_DATA.feedItems} />
    );

    expect(html).toContain('+ Foto');
    expect(html).toContain('+ Notitie');
    expect(html).toContain('Karel Bakker');
    expect(html).toContain('Inmeter');
    expect(html).toContain('Lichte kras op bovenprofiel');
    expect(html).toContain('#IS-2026-04');
    expect(html).toContain('Bovendorpel detail');
    expect(html).toContain('Montageplanning');
    expect(html).toContain('min-h-[44px]');
  });

  it('renders ProductMeasurementCanvasCard with 3-point laser metrics and formulas', () => {
    const html = renderToStaticMarkup(
      <ProductMeasurementCanvasCard
        width={MOCK_PRODUCT_DETAIL_DATA.measurements.width}
        height={MOCK_PRODUCT_DETAIL_DATA.measurements.height}
        installationHeightMm={MOCK_PRODUCT_DETAIL_DATA.measurements.installationHeightMm}
        isInstallationHeightFixed={MOCK_PRODUCT_DETAIL_DATA.measurements.isInstallationHeightFixed}
      />
    );

    expect(html).toContain('B1:1100 · B2:1098 · B3:1102');
    expect(html).toContain('MIN 1098 mm');
    expect(html).toContain('1093 mm');
    expect(html).toContain('H1:2240 · H2:2242 · H3:2238');
    expect(html).toContain('MIN 2238 mm');
    expect(html).toContain('2238 mm');
    expect(html).toContain('MONTAGEHOOGTE (MH)');
    expect(html).toContain('VAST');
    expect(html).toContain('2650');
  });

  it('renders ProductChecklistSafetyCard with checklist items and bracket locations', () => {
    const html = renderToStaticMarkup(
      <ProductChecklistSafetyCard
        checklists={MOCK_PRODUCT_DETAIL_DATA.checklists}
        bracketInfo={MOCK_PRODUCT_DETAIL_DATA.bracketInfo}
      />
    );

    expect(html).toContain('Glaslatdiepte ≥ 19mm gecontroleerd');
    expect(html).toContain('EN 13120 kindveiligheid aanwezig');
    expect(html).toContain('Doorgangscontrole raam &amp; klink');
    expect(html).toContain('Specificaties Bewerken');
    expect(html).toContain('RAL 9010 Wit Gecoat');
    expect(html).toContain('50mm van kant');
    expect(html).toContain('N.v.t. (&lt;1600mm)');
    expect(html).toContain('min-h-[44px]');
  });
});
