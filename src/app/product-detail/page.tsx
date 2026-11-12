'use client';

import React, { Suspense, useState, useCallback } from 'react';
import { MatrixTopNav } from '../../components/matrix/MatrixTopNav';
import { ProductDetailMetaHeader } from '../../components/product-detail/ProductDetailMetaHeader';
import { ProductDetailStageBar } from '../../components/product-detail/ProductDetailStageBar';
import { ProductDetailTitleBanner } from '../../components/product-detail/ProductDetailTitleBanner';
import { ProductSpecificationsCard } from '../../components/product-detail/ProductSpecificationsCard';
import { ProductMediaNotesCard } from '../../components/product-detail/ProductMediaNotesCard';
import { ProductMeasurementCanvasCard } from '../../components/product-detail/ProductMeasurementCanvasCard';
import { ProductChecklistSafetyCard } from '../../components/product-detail/ProductChecklistSafetyCard';
import { MOCK_PRODUCT_DETAIL_DATA } from '../../fixtures/product-detail-fixtures';

function ProductDetailContent() {
  const [data] = useState(MOCK_PRODUCT_DETAIL_DATA);
  const [checklists, setChecklists] = useState(data.checklists);

  const handleToggleChecklist = useCallback((id: string) => {
    setChecklists((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased">
      {/* 1. Viewport-Isolated Top Navigation Header (INV-UX-01 mobile isolation) */}
      <header className="w-full overflow-x-auto no-scrollbar border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
        <div className="min-w-[612px] sm:min-w-full">
          <MatrixTopNav activeTab="Product" />
        </div>
      </header>

      {/* 2. Context Meta Header */}
      <ProductDetailMetaHeader
        customerName={data.customerName}
        customerLocation={data.customerLocation}
        roomName={data.roomName}
        positionDescription={data.positionDescription}
        status={data.status}
        attachmentsCount={data.attachmentsCount}
      />

      {/* 3. FSM Workflow Stage Bar */}
      <ProductDetailStageBar
        currentStage={data.fsmStage}
      />

      {/* 4. Product Title & KPI Banner */}
      <ProductDetailTitleBanner
        productName={data.productName}
        category={data.productCategory}
        roomName={data.roomName}
        positionCode={data.positionCode}
        productionWidthMm={data.measurements.width.finalProductionMm}
        productionHeightMm={data.measurements.height.finalProductionMm}
        priceCents={data.priceCents}
      />

      {/* 5. 2-Column Responsive Content Raster */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Specifications & Media/Notes Feed */}
          <div className="flex flex-col gap-6">
            <ProductSpecificationsCard
              specifications={data.specifications}
            />
            <ProductMediaNotesCard
              feedItems={data.feedItems}
            />
          </div>

          {/* Right Column: Measurement Canvas & Checklist Safety */}
          <div className="flex flex-col gap-6">
            <ProductMeasurementCanvasCard
              width={data.measurements.width}
              height={data.measurements.height}
              installationHeightMm={data.measurements.installationHeightMm}
              isInstallationHeightFixed={data.measurements.isInstallationHeightFixed}
            />
            <ProductChecklistSafetyCard
              checklists={checklists}
              bracketInfo={data.bracketInfo}
              onToggleChecklist={handleToggleChecklist}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Laden van productdetails...</div>}>
      <ProductDetailContent />
    </Suspense>
  );
}
