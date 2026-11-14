'use client';

import React, { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [data] = useState(MOCK_PRODUCT_DETAIL_DATA);
  const [checklists, setChecklists] = useState(data.checklists);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleToggleChecklist = useCallback((id: string) => {
    setChecklists((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  }, []);

  const triggerFeedback = useCallback((msg: string) => {
    setFeedback(msg);
  }, []);

  const handleSelectOrderId = useCallback((orderId: string) => {
    router.push(`/matrix-orders?orderId=${orderId}`);
  }, [router]);

  return (
    <div data-hydrated={hydrated ? 'true' : undefined} className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased w-full max-w-full overflow-x-clip">
      {/* 1. Sticky Header Cluster: Nav + Meta + Stage Bar pinned together */}
      <div className="sticky top-0 z-30 bg-white shadow-2xs w-full max-w-full">
        <header className="w-full overflow-x-auto no-scrollbar border-b border-slate-200 bg-white">
          <div className="min-w-[612px] sm:min-w-full">
            <MatrixTopNav activeTab="Product" />
          </div>
        </header>

        {/* 2. Context Meta Header */}
        <ProductDetailMetaHeader
          customerName={data.customerName}
          customerLocation={data.customerLocation}
          orderNumber={data.orderNumber}
          roomName={data.roomName}
          positionDescription={data.positionDescription}
          status={data.status}
          attachmentsCount={data.attachmentsCount}
          onAttachmentsClick={() => triggerFeedback(`Bijlagen geopend: ${data.attachmentsCount} documenten`)}
          onSelectOrderId={handleSelectOrderId}
        />

        {/* 3. FSM Workflow Stage Bar */}
        <ProductDetailStageBar
          currentStage={data.fsmStage}
          onStartInmeten={() => triggerFeedback(`Inmeetproces gestart voor positie ${data.positionCode}`)}
          onStartMonteren={() => triggerFeedback(`Montageproces gestart voor positie ${data.positionCode}`)}
          onRegisterIssue={() => triggerFeedback('Issue registratieformulier geopend')}
        />

        {/* 4. Active Feedback Banner (Nielsen Norman Heuristic #1) */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className="w-full bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center justify-between text-xs text-blue-900 font-medium"
          >
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-blue-700 hover:text-blue-900 font-bold ml-4 cursor-pointer"
              aria-label="Sluit melding"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* 5. Product Title & KPI Banner */}
      <ProductDetailTitleBanner
        productName={data.productName}
        category={data.productCategory}
        roomName={data.roomName}
        positionCode={data.positionCode}
        productionWidthMm={data.measurements.width.finalProductionMm}
        productionHeightMm={data.measurements.height.finalProductionMm}
        priceCents={data.priceCents}
      />

      {/* 6. 2-Column Responsive Full-Width Content Raster matching Matrix Orders */}
      <main className="w-full px-6 py-5 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Specifications & Media/Notes Feed */}
          <div className="flex flex-col gap-6">
            <ProductSpecificationsCard
              specifications={data.specifications}
              onEdit={() => triggerFeedback('Specificaties bewerkingsmodus geactiveerd')}
            />
            <ProductMediaNotesCard
              feedItems={data.feedItems}
              onAddPhoto={() => triggerFeedback('Foto-upload dialoogvenster geopend')}
              onAddNote={() => triggerFeedback('Notitie-invoer dialoogvenster geopend')}
              onItemAction={(id) => triggerFeedback(`Actie uitgevoerd voor item ${id}`)}
            />
          </div>

          {/* Right Column: Measurement Canvas & Checklist / Bracket Safety */}
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
              onEditSpecs={() => triggerFeedback('Specificaties bewerkingsmodus geopend')}
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
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Laden van productdetails...</div>}>
      <ProductDetailContent />
    </Suspense>
  );
}
