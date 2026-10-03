import { computeFloorGeometry } from './floor-geometry-calculator';
import { SectionRenderOptions } from './types';

/**
 * 1-on-1 port of renderFloorplanSection from google_maps_picker.html.
 */
export function generateLegacySectionSvg(options: SectionRenderOptions): string {
  const {
    basePoints: basePts,
    frontWallIdx = 0,
    totalWoonoppervlakte = 0,
    nokhoogte: customNok,
    goothoogte: customGoot,
    bouwlagen = 3,
    goothoogteAanbouw = 3.7,
  } = options;

  if (!basePts || basePts.length < 3) {
    return `<svg viewBox="0 0 100 100" class="w-full h-full"><text x="50" y="50" text-anchor="middle" fill="#64748b">Geen doorsnede beschikbaar</text></svg>`;
  }

  const nokH = customNok && customNok > 5 ? customNok : 8.2;
  const gootH =
    bouwlagen >= 3
      ? Math.max(5.6, customGoot && customGoot >= 5.0 ? customGoot : 5.8)
      : customGoot && customGoot > 3
        ? customGoot
        : 5.6;
  const verdH = 2.8;
  const platH = goothoogteAanbouw || 3.7;

  // Diepte van hoofdvolume en aanbouw
  const f1 = computeFloorGeometry(basePts, frontWallIdx, 1, totalWoonoppervlakte);
  let depthMain = 6.0;
  if (f1 && f1.length === 4) {
    // In our polygon order [pA, pB, pB+inN*d, pA+inN*d], depth is distance between f1[3] and f1[0] or f1[2] and f1[1]
    const d1 = Math.hypot(f1[3].x - f1[0].x, f1[3].y - f1[0].y);
    const d2 = Math.hypot(f1[1].x - f1[0].x, f1[1].y - f1[0].y);
    depthMain = Math.max(5.0, Math.min(8.0, d1 >= 4.5 && d1 <= 8.5 ? d1 : d2));
  }
  depthMain = Math.max(5.0, Math.min(8.0, depthMain));

  // Bepaal totale diepte van het pand langs de voorgevelnormaal
  const baseN = basePts.length;
  let depthExt = 7.0;
  if (baseN > 4) {
    let maxD = 0;
    const pA = basePts[frontWallIdx];
    const pB = basePts[(frontWallIdx + 1) % baseN];
    const fvx = pB.x - pA.x,
      fvy = pB.y - pA.y;
    const flen = Math.hypot(fvx, fvy);
    const fnx = fvy / flen,
      fny = -fvx / flen;
    for (let i = 0; i < baseN; i++) {
      const d = Math.abs((basePts[i].x - pA.x) * fnx + (basePts[i].y - pA.y) * fny);
      if (d > maxD) maxD = d;
    }
    if (maxD > depthMain + 1.5) {
      depthExt = +(maxD - depthMain).toFixed(1);
    }
  } else {
    depthExt = 0;
  }

  const totalDepth = depthMain + depthExt;
  const yMaaiveld = 10.0;
  const yNok = yMaaiveld - nokH;
  const yGoot = yMaaiveld - gootH;
  const yVerd = yMaaiveld - verdH;
  const yPlat = yMaaiveld - platH;
  const yStahoogte = yGoot - 1.5;

  // Schuinte dak en NEN 2580 snede (bij 1.50m stahoogte)
  const slope = (nokH - gootH) / (depthMain / 2.0);
  const dxSta = Math.max(0.6, Math.min(depthMain / 2.2, slope > 0 ? 1.5 / slope : 1.2));
  const xSta1 = dxSta;
  const xSta2 = depthMain - dxSta;
  const usableAtticWidth = +(xSta2 - xSta1).toFixed(2);

  const hasExt = depthExt > 1.0;
  const xExtEnd = depthMain + depthExt;
  const secVbWidth = Math.max(22.0, (hasExt ? xExtEnd + 4.5 : depthMain + 5.5) + 4.2);

  return `
    <svg viewBox="-4.2 0.0 ${secVbWidth.toFixed(1)} 12.2" class="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="secGroundHatch" width="0.6" height="0.6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="0.6" stroke="#cbd5e1" stroke-width="0.08" />
        </pattern>
        <pattern id="secRoofHatch" width="0.3" height="0.3" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="0.3" stroke="#e2e8f0" stroke-width="0.06" />
        </pattern>
        <pattern id="secGrid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#f1f5f9" stroke-width="0.03" />
        </pattern>
        <marker id="secDotBlue" markerWidth="4" markerHeight="4" refX="2" refY="2">
          <circle cx="2" cy="2" r="1.3" fill="#0284c7" />
        </marker>
      </defs>

      <!-- 1. Achtergrond raster -->
      <rect x="-4.2" y="0.0" width="${secVbWidth.toFixed(1)}" height="12.2" fill="url(#secGrid)" />

      <!-- Grond / Maaiveld onder peil -->
      <rect x="-3.8" y="${yMaaiveld.toFixed(2)}" width="${(secVbWidth - 0.8).toFixed(1)}" height="1.8" fill="url(#secGroundHatch)" opacity="0.45" />
      <line x1="-3.8" y1="${yMaaiveld.toFixed(2)}" x2="${(secVbWidth - 0.8).toFixed(1)}" y2="${yMaaiveld.toFixed(2)}" stroke="#475569" stroke-width="0.08" />

      <!-- Straat- en tuinlabels -->
      <text x="-1.8" y="10.55" fill="#64748b" font-size="0.36" font-family="sans-serif" font-weight="bold" text-anchor="middle">◀ STRAAT (VOORGEVEL)</text>
      <text x="${(xExtEnd + 1.8).toFixed(2)}" y="10.55" fill="#64748b" font-size="0.36" font-family="sans-serif" font-weight="bold" text-anchor="middle">ACHTERTUIN ▶</text>

      <!-- 2. HOOFDVOLUME (DOORSNEDE) -->
      <!-- Zadeldak binnenruimte -->
      <polygon points="0,${yGoot.toFixed(2)} ${(depthMain / 2).toFixed(2)},${yNok.toFixed(2)} ${depthMain.toFixed(2)},${yGoot.toFixed(2)}" fill="#f8fafc" stroke="#0f172a" stroke-width="0.08" stroke-linejoin="round" />

      <!-- Buitenste dakpannenlaag -->
      <polyline points="-0.25,${(yGoot + 0.15).toFixed(2)} ${(depthMain / 2).toFixed(2)},${(yNok - 0.15).toFixed(2)} ${(depthMain + 0.25).toFixed(2)},${(yGoot + 0.15).toFixed(2)}" fill="none" stroke="#b45309" stroke-width="0.16" stroke-linecap="round" stroke-linejoin="round" />

      <!-- 1.50m Stahoogtelijn onder kap (NEN 2580 Woonoppervlak) -->
      <rect x="${xSta1.toFixed(2)}" y="${yStahoogte.toFixed(2)}" width="${usableAtticWidth.toFixed(2)}" height="1.50" fill="#eff6ff" opacity="0.85" />
      <line x1="${xSta1.toFixed(2)}" y1="${yStahoogte.toFixed(2)}" x2="${xSta2.toFixed(2)}" y2="${yStahoogte.toFixed(2)}" stroke="#0284c7" stroke-width="0.05" stroke-dasharray="0.15,0.1" />
      <line x1="${xSta1.toFixed(2)}" y1="${yStahoogte.toFixed(2)}" x2="${xSta1.toFixed(2)}" y2="${yGoot.toFixed(2)}" stroke="#0284c7" stroke-width="0.03" stroke-dasharray="0.1,0.1" opacity="0.6" />
      <line x1="${xSta2.toFixed(2)}" y1="${yStahoogte.toFixed(2)}" x2="${xSta2.toFixed(2)}" y2="${yGoot.toFixed(2)}" stroke="#0284c7" stroke-width="0.03" stroke-dasharray="0.1,0.1" opacity="0.6" />

      <!-- Knieschot arceringen (< 1.50m) -->
      <polygon points="0.28,${yGoot.toFixed(2)} ${xSta1.toFixed(2)},${yStahoogte.toFixed(2)} ${xSta1.toFixed(2)},${yGoot.toFixed(2)}" fill="url(#secRoofHatch)" opacity="0.6" />
      <polygon points="${(depthMain - 0.28).toFixed(2)},${yGoot.toFixed(2)} ${xSta2.toFixed(2)},${yStahoogte.toFixed(2)} ${xSta2.toFixed(2)},${yGoot.toFixed(2)}" fill="url(#secRoofHatch)" opacity="0.6" />

      <!-- Zolderruimte teksten -->
      <text x="${(depthMain / 2).toFixed(2)}" y="${(yGoot - 0.7).toFixed(2)}" fill="#0369a1" font-size="0.34" font-family="sans-serif" font-weight="bold" text-anchor="middle">Zolder (h &ge; 1.50m &bull; Woonoppervlak)</text>
      <text x="${(depthMain / 2).toFixed(2)}" y="${(yStahoogte - 0.22).toFixed(2)}" fill="#0284c7" font-size="0.26" font-family="sans-serif" font-weight="bold" text-anchor="middle">1.50m Stahoogtelijn (NEN 2580)</text>
      <text x="${(xSta1 * 0.55).toFixed(2)}" y="${(yGoot - 0.2).toFixed(2)}" fill="#94a3b8" font-size="0.22" font-family="sans-serif" text-anchor="middle">Knieschot</text>
      <text x="${(depthMain - xSta1 * 0.55).toFixed(2)}" y="${(yGoot - 0.2).toFixed(2)}" fill="#94a3b8" font-size="0.22" font-family="sans-serif" text-anchor="middle">Knieschot</text>

      <!-- 3. AANBOUW MET PLAT DAK (indien aanwezig) -->
      ${
        hasExt
          ? `
        <rect x="${depthMain.toFixed(2)}" y="${yPlat.toFixed(2)}" width="${depthExt.toFixed(2)}" height="${platH.toFixed(2)}" fill="#ffffff" stroke="none" />
        <rect x="${depthMain.toFixed(2)}" y="${(yPlat - 0.22).toFixed(2)}" width="${depthExt.toFixed(2)}" height="0.25" fill="#475569" stroke="#0f172a" stroke-width="0.04" />
        <rect x="${(xExtEnd - 0.15).toFixed(2)}" y="${(yPlat - 0.35).toFixed(2)}" width="0.30" height="0.38" fill="#334155" stroke="#0f172a" stroke-width="0.03" />
        <text x="${(depthMain + depthExt / 2).toFixed(2)}" y="${(yPlat - 0.5).toFixed(2)}" fill="#475569" font-size="0.32" font-family="sans-serif" font-weight="bold" text-anchor="middle">1-Laags Plat Dak Aanbouw (BG)</text>
      `
          : ''
      }

      <!-- 4. VLOEREN (DOORSNEDE) -->
      <!-- BG vloer -->
      <rect x="0.28" y="9.82" width="${(totalDepth - 0.56).toFixed(2)}" height="0.18" fill="#cbd5e1" />
      <!-- 1e Verdiepingsvloer hoofdhuis -->
      <rect x="0.28" y="${(yVerd - 0.18).toFixed(2)}" width="${(depthMain - 0.56).toFixed(2)}" height="0.18" fill="#94a3b8" stroke="#64748b" stroke-width="0.02" />
      <!-- Zoldervloer hoofdhuis -->
      <rect x="0.28" y="${(yGoot - 0.16).toFixed(2)}" width="${(depthMain - 0.56).toFixed(2)}" height="0.16" fill="#94a3b8" stroke="#64748b" stroke-width="0.02" />

      <!-- 5. MASSIEVE GEVELMUREN (DOORSNEDE) -->
      <rect x="0" y="${yGoot.toFixed(2)}" width="0.28" height="${gootH.toFixed(2)}" fill="#334155" stroke="#0f172a" stroke-width="0.04" />
      <rect x="${(depthMain - 0.28).toFixed(2)}" y="${yGoot.toFixed(2)}" width="0.28" height="${gootH.toFixed(2)}" fill="#334155" stroke="#0f172a" stroke-width="0.04" />
      ${
        hasExt
          ? `
        <rect x="${(xExtEnd - 0.28).toFixed(2)}" y="${yPlat.toFixed(2)}" width="0.28" height="${platH.toFixed(2)}" fill="#334155" stroke="#0f172a" stroke-width="0.04" />
      `
          : ''
      }

      <!-- Ramen indicaties in gevel -->
      <rect x="-0.04" y="${(yVerd - 1.6).toFixed(2)}" width="0.1" height="1.1" fill="#38bdf8" stroke="#0284c7" stroke-width="0.02" />
      <rect x="-0.04" y="8.0" width="0.1" height="1.3" fill="#38bdf8" stroke="#0284c7" stroke-width="0.02" />
      <rect x="${(xExtEnd - 0.06).toFixed(2)}" y="8.0" width="0.1" height="1.3" fill="#38bdf8" stroke="#0284c7" stroke-width="0.02" />

      <!-- 6. RUIMTELABELS BINNENWERKS -->
      <text x="${(depthMain / 2).toFixed(2)}" y="${((yVerd + yGoot) / 2 - 0.25).toFixed(2)}" fill="#334155" font-size="0.38" font-family="sans-serif" font-weight="bold" text-anchor="middle">1e Verdieping</text>
      <text x="${(depthMain / 2).toFixed(2)}" y="${((yVerd + yGoot) / 2 + 0.25).toFixed(2)}" fill="#64748b" font-size="0.26" font-family="sans-serif" text-anchor="middle">Slaapkamers / Wonen</text>

      <text x="${(depthMain / 2).toFixed(2)}" y="8.6" fill="#334155" font-size="0.38" font-family="sans-serif" font-weight="bold" text-anchor="middle">Begane Grond</text>
      <text x="${(depthMain / 2).toFixed(2)}" y="9.0" fill="#64748b" font-size="0.26" font-family="sans-serif" text-anchor="middle">Woonkamer Hoofdvolume</text>

      ${
        hasExt
          ? `
        <text x="${(depthMain + depthExt / 2).toFixed(2)}" y="8.6" fill="#334155" font-size="0.38" font-family="sans-serif" font-weight="bold" text-anchor="middle">Begane Grond Aanbouw</text>
        <text x="${(depthMain + depthExt / 2).toFixed(2)}" y="9.0" fill="#64748b" font-size="0.26" font-family="sans-serif" text-anchor="middle">Keuken / Tuinkamer / Bijkeuken</text>
      `
          : ''
      }

      <!-- 7. VERTICALE PEILKETTING LINKS -->
      <line x1="-1.6" y1="${yNok.toFixed(2)}" x2="${(depthMain / 2).toFixed(2)}" y2="${yNok.toFixed(2)}" stroke="#0284c7" stroke-width="0.03" stroke-dasharray="0.1,0.1" opacity="0.4" />
      <polygon points="-1.6,${yNok.toFixed(2)} -1.9,${(yNok - 0.15).toFixed(2)} -1.9,${(yNok + 0.15).toFixed(2)}" fill="#0284c7" />
      <text x="-2.1" y="${(yNok + 0.12).toFixed(2)}" fill="#0369a1" font-size="0.34" font-family="monospace" font-weight="bold" text-anchor="end">+${nokH.toFixed(2)}m Nok</text>

      <line x1="-1.6" y1="${yGoot.toFixed(2)}" x2="-0.1" y2="${yGoot.toFixed(2)}" stroke="#0284c7" stroke-width="0.03" stroke-dasharray="0.1,0.1" opacity="0.4" />
      <polygon points="-1.6,${yGoot.toFixed(2)} -1.9,${(yGoot - 0.15).toFixed(2)} -1.9,${(yGoot + 0.15).toFixed(2)}" fill="#0284c7" />
      <text x="-2.1" y="${(yGoot + 0.12).toFixed(2)}" fill="#0369a1" font-size="0.34" font-family="monospace" font-weight="bold" text-anchor="end">+${gootH.toFixed(2)}m Goot / Zolder</text>

      <line x1="-1.6" y1="${yVerd.toFixed(2)}" x2="-0.1" y2="${yVerd.toFixed(2)}" stroke="#0284c7" stroke-width="0.03" stroke-dasharray="0.1,0.1" opacity="0.4" />
      <polygon points="-1.6,${yVerd.toFixed(2)} -1.9,${(yVerd - 0.15).toFixed(2)} -1.9,${(yVerd + 0.15).toFixed(2)}" fill="#0284c7" />
      <text x="-2.1" y="${(yVerd + 0.12).toFixed(2)}" fill="#0369a1" font-size="0.34" font-family="monospace" font-weight="bold" text-anchor="end">+${verdH.toFixed(2)}m 1e Verd.</text>

      <polygon points="-1.6,10.0 -1.9,9.85 -1.9,10.15" fill="#0f172a" />
      <text x="-2.1" y="10.12" fill="#0f172a" font-size="0.34" font-family="monospace" font-weight="bold" text-anchor="end">0.00m Peil (Maaiveld)</text>

      ${
        hasExt
          ? `
        <line x1="${xExtEnd.toFixed(2)}" y1="${yPlat.toFixed(2)}" x2="${(xExtEnd + 1.4).toFixed(2)}" y2="${yPlat.toFixed(2)}" stroke="#0284c7" stroke-width="0.03" stroke-dasharray="0.1,0.1" opacity="0.4" />
        <polygon points="${(xExtEnd + 1.4).toFixed(2)},${yPlat.toFixed(2)} ${(xExtEnd + 1.7).toFixed(2)},${(yPlat - 0.15).toFixed(2)} ${(xExtEnd + 1.7).toFixed(2)},${(yPlat + 0.15).toFixed(2)}" fill="#0284c7" />
        <text x="${(xExtEnd + 1.9).toFixed(2)}" y="${(yPlat + 0.12).toFixed(2)}" fill="#0369a1" font-size="0.34" font-family="monospace" font-weight="bold" text-anchor="start">+${platH.toFixed(2)}m Plat dak</text>
      `
          : ''
      }

      <!-- 8. HORIZONTALE MAATVOERING ONDER (DIEPTEMATEN) -->
      <line x1="0" y1="10.8" x2="${depthMain.toFixed(2)}" y2="10.8" stroke="#0284c7" stroke-width="0.04" marker-start="url(#secDotBlue)" marker-end="url(#secDotBlue)" />
      <line x1="0" y1="10.1" x2="0" y2="11.0" stroke="#0284c7" stroke-width="0.02" opacity="0.5" />
      <line x1="${depthMain.toFixed(2)}" y1="10.1" x2="${depthMain.toFixed(2)}" y2="11.0" stroke="#0284c7" stroke-width="0.02" opacity="0.5" />
      <rect x="${(depthMain / 2 - 1.0).toFixed(2)}" y="10.55" width="2.0" height="0.5" rx="0.15" fill="#f0f9ff" stroke="#0284c7" stroke-width="0.03" />
      <text x="${(depthMain / 2).toFixed(2)}" y="10.92" fill="#0369a1" font-size="0.34" font-family="monospace" font-weight="bold" text-anchor="middle">${depthMain.toFixed(2)}m</text>

      ${
        hasExt
          ? `
        <line x1="${depthMain.toFixed(2)}" y1="10.8" x2="${xExtEnd.toFixed(2)}" y2="10.8" stroke="#0284c7" stroke-width="0.04" marker-start="url(#secDotBlue)" marker-end="url(#secDotBlue)" />
        <line x1="${xExtEnd.toFixed(2)}" y1="10.1" x2="${xExtEnd.toFixed(2)}" y2="11.0" stroke="#0284c7" stroke-width="0.02" opacity="0.5" />
        <rect x="${(depthMain + depthExt / 2 - 1.0).toFixed(2)}" y="10.55" width="2.0" height="0.5" rx="0.15" fill="#f0f9ff" stroke="#0284c7" stroke-width="0.03" />
        <text x="${(depthMain + depthExt / 2).toFixed(2)}" y="10.92" fill="#0369a1" font-size="0.34" font-family="monospace" font-weight="bold" text-anchor="middle">${depthExt.toFixed(2)}m</text>

        <line x1="0" y1="11.55" x2="${xExtEnd.toFixed(2)}" y2="11.55" stroke="#475569" stroke-width="0.04" marker-start="url(#secDotBlue)" marker-end="url(#secDotBlue)" />
        <line x1="0" y1="10.9" x2="0" y2="11.75" stroke="#475569" stroke-width="0.02" opacity="0.5" />
        <line x1="${xExtEnd.toFixed(2)}" y1="10.9" x2="${xExtEnd.toFixed(2)}" y2="11.75" stroke="#475569" stroke-width="0.02" opacity="0.5" />
        <rect x="${(totalDepth / 2 - 1.3).toFixed(2)}" y="11.3" width="2.6" height="0.5" rx="0.15" fill="#f8fafc" stroke="#475569" stroke-width="0.03" />
        <text x="${(totalDepth / 2).toFixed(2)}" y="11.67" fill="#334155" font-size="0.34" font-family="monospace" font-weight="bold" text-anchor="middle">${totalDepth.toFixed(2)}m Totaal</text>
      `
          : ''
      }
    </svg>
  `;
}
