import React from 'react';
import {
  Compass,
  Layers,
  Mountain,
  Ruler,
  Box,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { BenchmarkTypology, analyzeTypology } from '@/fixtures/benchmark-typologies';

export interface InspectionChipProps {
  typology: BenchmarkTypology;
  analysis?: ReturnType<typeof analyzeTypology>;
  activeFilter?: string | null;
  onFilterToggle?: (filter: string) => void;
  className?: string;
}

export interface ChipConfig {
  id: string;
  label: string;
  value: string;
  badge?: string;
  icon: React.ReactNode;
  variant: 'brand' | 'success' | 'warning' | 'neutral' | 'accent';
  tooltip?: string;
}

export function InspectionChips({
  typology,
  analysis,
  activeFilter,
  onFilterToggle,
  className = '',
}: InspectionChipProps) {
  const currentAnalysis = analysis ?? analyzeTypology(typology);
  const { frontFacade, mandeligStats, floors } = currentAnalysis;

  // Convert orientation angle to cardinal direction
  const angleDeg = Math.round((frontFacade.orientationAngleRad * 180) / Math.PI);
  const normalizedDeg = ((angleDeg % 360) + 360) % 360;
  const getCardinal = (deg: number) => {
    if (deg >= 337.5 || deg < 22.5) return 'Noord';
    if (deg >= 22.5 && deg < 67.5) return 'Noord-Oost';
    if (deg >= 67.5 && deg < 112.5) return 'Oost';
    if (deg >= 112.5 && deg < 157.5) return 'Zuid-Oost';
    if (deg >= 157.5 && deg < 202.5) return 'Zuid';
    if (deg >= 202.5 && deg < 247.5) return 'Zuid-West';
    if (deg >= 247.5 && deg < 292.5) return 'West';
    return 'Noord-West';
  };
  const cardinal = getCardinal(normalizedDeg);

  // Mandelig label
  const mandeligPctFormatted = mandeligStats.mandeligPercentage.toFixed(1) + '%';
  const mandeligDescription =
    mandeligStats.mandeligPercentage === 0
      ? '0% (Vrijstaand)'
      : mandeligStats.partialCount > 0
      ? `${mandeligPctFormatted} (Deels mandelig)`
      : `${mandeligPctFormatted} (Mandelig)`;

  // NEN 2580 stahoogtelijnen status
  const atticFloor = floors.find((f) => f.isAttic) ?? floors[floors.length - 1];
  const nenStatus = atticFloor
    ? `GO ≥ 1.50m | VG ≥ 2.60m`
    : `Bouwbesluit conform`;

  const chips: ChipConfig[] = [
    {
      id: 'voorgevel',
      label: 'Voorgevel',
      value: `${normalizedDeg}° ${cardinal}`,
      badge: `${Math.round(frontFacade.confidence * 100)}% conf`,
      icon: <Compass className="w-3.5 h-3.5 text-sky-600" />,
      variant: 'accent',
      tooltip: `Voorgevel gedetecteerd op zijde ${frontFacade.frontEdgeIndex}. Normaal: (${frontFacade.outwardNormal.x.toFixed(2)}, ${frontFacade.outwardNormal.y.toFixed(2)})`,
    },
    {
      id: 'mandelig',
      label: 'Mandelige muur',
      value: mandeligDescription,
      badge: `${mandeligStats.fullCount} vol / ${mandeligStats.partialCount} deel`,
      icon: <Layers className="w-3.5 h-3.5 text-rose-600" />,
      variant: mandeligStats.mandeligPercentage > 0 ? 'warning' : 'success',
      tooltip: `${mandeligStats.sharedLength.toFixed(1)}m van ${mandeligStats.totalPerimeter.toFixed(1)}m omtrek is mandelig`,
    },
    {
      id: 'ahn5',
      label: 'AHN5 Maaiveld',
      value: `${typology.heightAttributes.groundLevelNAP >= 0 ? '+' : ''}${typology.heightAttributes.groundLevelNAP.toFixed(2)}m NAP`,
      badge: 'RDNAP',
      icon: <Mountain className="w-3.5 h-3.5 text-indigo-600" />,
      variant: 'brand',
      tooltip: `AHN5 hoogtedatum met drempelpeil op +${(typology.heightAttributes.groundLevelNAP + 0.15).toFixed(2)}m NAP`,
    },
    {
      id: 'nen2580',
      label: 'NEN 2580',
      value: nenStatus,
      badge: 'Conform',
      icon: <Ruler className="w-3.5 h-3.5 text-amber-600" />,
      variant: 'neutral',
      tooltip: `Clearance levels: 1.50m (Gebruiksoppervlakte wonen) en 2.60m (Verblijfsgebied)`,
    },
    {
      id: 'lod',
      label: '3D BAG',
      value: typology.lod,
      badge: typology.heightAttributes.roofType ?? 'zadeldak',
      icon: <Box className="w-3.5 h-3.5 text-blue-600" />,
      variant: 'brand',
      tooltip: `Bouwjaar: ${typology.yearBuilt} | BAG ID: ${typology.bagPandId}`,
    },
  ];

  const getVariantClasses = (variant: ChipConfig['variant'], isActive: boolean) => {
    if (isActive) {
      return 'bg-brand text-white border-brand ring-2 ring-brand/30 shadow-sm';
    }
    switch (variant) {
      case 'brand':
        return 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100/80';
      case 'accent':
        return 'bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100/80';
      case 'success':
        return 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/80';
      case 'warning':
        return 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100/80';
      case 'neutral':
      default:
        return 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100/80';
    }
  };

  return (
    <div
      role="region"
      aria-label="Bouwkundige inspectie badges"
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      {chips.map((chip) => {
        const isActive = activeFilter === chip.id;
        const variantClass = getVariantClasses(chip.variant, isActive);

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onFilterToggle?.(chip.id)}
            title={chip.tooltip}
            aria-pressed={isActive}
            className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-all duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand ${variantClass}`}
          >
            <span className="flex-shrink-0">{chip.icon}</span>
            <span className="font-semibold text-slate-700 group-hover:text-slate-900">
              {chip.label}:
            </span>
            <span className="font-normal">{chip.value}</span>
            {chip.badge && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-black/5 text-slate-600'
                }`}
              >
                {chip.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default InspectionChips;
