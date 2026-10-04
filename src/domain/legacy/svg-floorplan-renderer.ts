import { Point2D, simplifyCollinearPoints } from './collinear-simplifier';
import { computeFloorGeometry } from './floor-geometry-calculator';
import { FloorplanRenderOptions } from './types';

/**
 * 1-on-1 port of renderFloorplan SVG generator from google_maps_picker.html.
 */
export function generateLegacyFloorplanSvg(options: FloorplanRenderOptions): string {
  const {
    basePoints: inputBasePoints,
    wallThickness: d = 0.28,
    showInnerDimensions = true,
    showOuterDimensions = true,
    etageIndex = 0,
    totalWoonoppervlakte = 0,
    isMandelig: explicitMandelig,
    mandeligWallIdx: explicitMandeligWallIdx,
    roofType = 'auto',
    orientation = 'north',
    oppDakPlat = 0,
    oppDakSchuin = 0,
    bag3d,
    streetViewHeading = 92.4,
  } = options;

  if (!inputBasePoints || inputBasePoints.length < 3) {
    return `<svg viewBox="0 0 100 100" class="w-full h-full"><text x="50" y="50" text-anchor="middle" fill="#64748b">Geen pandcontour beschikbaar</text></svg>`;
  }

  // 1. Collineaire vereenvoudiging van Begane Grond
  const basePts = simplifyCollinearPoints(inputBasePoints, 4.0);
  const baseN = basePts.length;

  // 2. Detecteer voorgevel (straatgevel) op Begane Grond indien niet opgegeven
  const rad = (streetViewHeading * Math.PI) / 180;
  const toStreetX = -Math.sin(rad);
  const toStreetY = Math.cos(rad);

  let baseArea = 0;
  for (let j = 0; j < baseN; j++) {
    baseArea += basePts[j].x * basePts[(j + 1) % baseN].y - basePts[(j + 1) % baseN].x * basePts[j].y;
  }
  const baseSign = baseArea < 0 ? -1 : 1;

  let frontWallIdx = options.frontWallIdx ?? -1;
  if (frontWallIdx < 0 || frontWallIdx >= baseN) {
    let bestScore = -Infinity;
    for (let i = 0; i < baseN; i++) {
      const p1 = basePts[i];
      const p2 = basePts[(i + 1) % baseN];
      const vx = p2.x - p1.x;
      const vy = p2.y - p1.y;
      const len = Math.hypot(vx, vy);
      const outNx = (vy / len) * baseSign;
      const outNy = (-vx / len) * baseSign;
      const dot = outNx * toStreetX + outNy * toStreetY;
      const score = dot * Math.sqrt(len);
      if (score > bestScore) {
        bestScore = score;
        frontWallIdx = i;
      }
    }
  }

  // 3. Verkrijg geometrie van geselecteerde verdieping
  const numericEtage = typeof etageIndex === 'number' ? etageIndex : 0;
  let pts = computeFloorGeometry(basePts, frontWallIdx, numericEtage, totalWoonoppervlakte, d, bag3d);
  const n = pts.length;
  if (n < 3) return '';

  // 4. Oriëntatie & Rotatie: 'north' vs 'front_left'
  let rotAngle = 0;
  if (orientation === 'front_left' && frontWallIdx >= 0) {
    const fp1 = basePts[frontWallIdx];
    const fp2 = basePts[(frontWallIdx + 1) % baseN];
    const fvx = fp2.x - fp1.x;
    const fvy = fp2.y - fp1.y;
    const flen = Math.hypot(fvx, fvy);
    const fnx = (fvy / flen) * baseSign;
    const fny = (-fvx / flen) * baseSign;
    const normAngle = Math.atan2(fny, fnx);
    rotAngle = Math.PI - normAngle;
  }

  const baseCX = basePts.reduce((s, p) => s + p.x, 0) / baseN;
  const baseCY = basePts.reduce((s, p) => s + p.y, 0) / baseN;

  let rotBasePts = basePts;
  if (rotAngle !== 0) {
    const cosR = Math.cos(rotAngle);
    const sinR = Math.sin(rotAngle);
    rotBasePts = basePts.map((p) => ({
      x: baseCX + (p.x - baseCX) * cosR - (p.y - baseCY) * sinR,
      y: baseCY + (p.x - baseCX) * sinR + (p.y - baseCY) * cosR,
    }));
    pts = pts.map((p) => ({
      x: baseCX + (p.x - baseCX) * cosR - (p.y - baseCY) * sinR,
      y: baseCY + (p.x - baseCX) * sinR + (p.y - baseCY) * cosR,
    }));
  }

  // Bounding box voor schaling gebaseerd op totale grondvlak
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  rotBasePts.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const pad = 5.2;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const viewBoxX = minX - pad;
  const viewBoxY = minY - pad;

  let bgExtensionSvg = '';
  if (numericEtage > 0 && n < baseN) {
    const bgExtPath =
      rotBasePts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z';
    bgExtensionSvg = `
      <!-- Begane grond omtrek (uitbouw / plat dak) -->
      <path d="${bgExtPath}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.08" stroke-dasharray="0.3,0.15" stroke-linejoin="round" />
    `;
  }

  const cX = pts.reduce((s, p) => s + p.x, 0) / n;
  const cY = pts.reduce((s, p) => s + p.y, 0) / n;

  // Binnenwanden offset (inwaartse bissectrice)
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    signedArea += p1.x * p2.y - p2.x * p1.y;
  }
  signedArea *= 0.5;
  const sign = signedArea < 0 ? -1 : 1;

  const innerPts: Point2D[] = [];
  const isConcaveCorner: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const pPrev = pts[(i - 1 + n) % n];
    const pCurr = pts[i];
    const pNext = pts[(i + 1) % n];

    const v1x = pCurr.x - pPrev.x;
    const v1y = pCurr.y - pPrev.y;
    const l1 = Math.hypot(v1x, v1y);

    const v2x = pNext.x - pCurr.x;
    const v2y = pNext.y - pCurr.y;
    const l2 = Math.hypot(v2x, v2y);

    const n1x = (-v1y / l1) * sign;
    const n1y = (v1x / l1) * sign;
    const n2x = (-v2y / l2) * sign;
    const n2y = (v2x / l2) * sign;

    const bisectX = n1x + n2x;
    const bisectY = n1y + n2y;
    const lb = Math.hypot(bisectX, bisectY);

    const cross = (v1x * v2y - v1y * v2x) * sign;
    isConcaveCorner.push(cross < 0);

    if (lb < 1e-4) {
      innerPts.push({ x: pCurr.x + n1x * d, y: pCurr.y + n1y * d });
    } else {
      const dot = Math.max(-0.99, Math.min(0.99, n1x * n2x + n1y * n2y));
      let scale = d / Math.sqrt((1 + dot) / 2);
      scale = Math.min(scale, d * 2.5);
      innerPts.push({
        x: pCurr.x + (bisectX / lb) * scale,
        y: pCurr.y + (bisectY / lb) * scale,
      });
    }
  }

  const outerPath =
    pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z';
  const innerPath =
    innerPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z';

  // Vind de wand die het meest naar de straat wijst
  let floorFrontWallIdx = 0;
  let bestFrontDot = -Infinity;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const vx = p2.x - p1.x;
    const vy = p2.y - p1.y;
    const len = Math.hypot(vx, vy);
    if (len < 0.6) continue;
    const outNx = (vy / len) * sign;
    const outNy = (-vx / len) * sign;
    const dot = rotAngle !== 0 ? -outNx : outNx * toStreetX + outNy * toStreetY;
    const score = dot * Math.sqrt(len);
    if (score > bestFrontDot) {
      bestFrontDot = score;
      floorFrontWallIdx = i;
    }
  }

  const isCompositeOrFlat =
    (oppDakPlat && oppDakPlat > 15) ||
    (bag3d?.dakTypeLabel && bag3d.dakTypeLabel.toLowerCase().includes('samengesteld')) ||
    roofType === 'flat';
  const isSlanted =
    roofType === 'slanted' ||
    (roofType === 'auto' && !isCompositeOrFlat && Boolean(oppDakSchuin && oppDakSchuin > (oppDakPlat || 0) * 1.5));

  // SPECIFIEKE RENDERING VOOR ZOLDER / KAP (BIJ SCHUIN DAK)
  if (numericEtage === 2 && n === 4 && isSlanted) {
    const f = floorFrontWallIdx;
    const r = (f + 2) % 4;
    const pFA = pts[f],
      pFB = pts[(f + 1) % 4];
    const pRA = pts[r],
      pRB = pts[(r + 1) % 4];

    const fvx = pFB.x - pFA.x,
      fvy = pFB.y - pFA.y;
    const flen = Math.hypot(fvx, fvy);
    const fux = fvx / flen,
      fuy = fvy / flen;

    const midF = { x: (pFA.x + pFB.x) / 2, y: (pFA.y + pFB.y) / 2 };
    const midR = { x: (pRA.x + pRB.x) / 2, y: (pRA.y + pRB.y) / 2 };
    const vDx = midR.x - midF.x,
      vDy = midR.y - midF.y;
    const totalD = Math.hypot(vDx, vDy);
    const uDx = vDx / totalD,
      uDy = vDy / totalD;

    let avgSlopeAngle = 35;
    if (bag3d && bag3d.dakvlakken && bag3d.dakvlakken.length > 0) {
      const slopes = bag3d.dakvlakken.map((v: any) => v.helling).filter((h: number) => h > 15 && h < 75);
      if (slopes.length > 0) avgSlopeAngle = slopes.reduce((a: number, b: number) => a + b, 0) / slopes.length;
    }
    const radSlope = (avgSlopeAngle * Math.PI) / 180;
    const dxSta = Math.max(0.6, Math.min(totalD / 2.2, 1.5 / Math.tan(radSlope)));
    const usableAtticD = Math.max(1.0, totalD - dxSta * 2);

    const qF1 = { x: pFA.x + uDx * dxSta, y: pFA.y + uDy * dxSta };
    const qF2 = { x: pFB.x + uDx * dxSta, y: pFB.y + uDy * dxSta };
    const qR1 = { x: pFA.x + uDx * (totalD - dxSta), y: pFA.y + uDy * (totalD - dxSta) };
    const qR2 = { x: pFB.x + uDx * (totalD - dxSta), y: pFB.y + uDy * (totalD - dxSta) };

    const atticZonePath = `M ${qF1.x.toFixed(3)} ${qF1.y.toFixed(3)} L ${qF2.x.toFixed(3)} ${qF2.y.toFixed(3)} L ${qR2.x.toFixed(3)} ${qR2.y.toFixed(3)} L ${qR1.x.toFixed(3)} ${qR1.y.toFixed(3)} Z`;

    const fBadgeX = midF.x - uDx * 1.8;
    const fBadgeY = midF.y - uDy * 1.8;
    let angleGoot = (Math.atan2(fvy, fvx) * 180) / Math.PI;
    if (angleGoot > 90 || angleGoot < -90) angleGoot += 180;

    return `
      <svg viewBox="${viewBoxX.toFixed(2)} ${viewBoxY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}" class="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="archGrid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#f1f5f9" stroke-width="0.03" />
          </pattern>
          <pattern id="atticSlopeHatch" width="0.35" height="0.35" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="0.35" stroke="#e2e8f0" stroke-width="0.06" />
          </pattern>
          <marker id="dotBlue" markerWidth="4" markerHeight="4" refX="2" refY="2">
            <circle cx="2" cy="2" r="1.3" fill="#0284c7" />
          </marker>
          <marker id="dotAmber" markerWidth="4" markerHeight="4" refX="2" refY="2">
            <circle cx="2" cy="2" r="1.3" fill="#d97706" />
          </marker>
        </defs>

        <rect x="${viewBoxX.toFixed(2)}" y="${viewBoxY.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="url(#archGrid)" />
        ${bgExtensionSvg}
        <path d="${outerPath}" fill="#ffffff" stroke="#0f172a" stroke-width="0.08" />
        <path d="${outerPath}" fill="url(#atticSlopeHatch)" />
        <path d="${atticZonePath}" fill="#f0f9ff" stroke="#0284c7" stroke-width="0.06" stroke-dasharray="0.25,0.15" />

        <g transform="translate(${fBadgeX.toFixed(3)}, ${fBadgeY.toFixed(3)}) rotate(${angleGoot.toFixed(1)})">
          <rect x="-2.2" y="-0.38" width="4.4" height="0.76" rx="0.22" fill="#ffffff" stroke="#1a73e8" stroke-width="0.05" />
          <text y="0.13" fill="#1a73e8" font-size="0.36" font-family="sans-serif" font-weight="bold" text-anchor="middle">◀ VOORZIJDE (STRAAT)</text>
        </g>

        <g transform="translate(${cX.toFixed(2)}, ${cY.toFixed(2)})" text-anchor="middle" pointer-events="none">
          <rect x="-2.5" y="-0.5" width="5.0" height="1.0" rx="0.3" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.04" />
          <text y="0.2" fill="#475569" font-size="0.40" font-weight="bold" font-family="sans-serif">ZOLDER / KAP (CONCEPT)</text>
        </g>
      </svg>
    `;
  }

  // 7. Maten en Maatlijnen genereren
  let dimSvg = '';
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const q1 = innerPts[i];
    const q2 = innerPts[(i + 1) % n];

    const vx = p2.x - p1.x;
    const vy = p2.y - p1.y;
    const outLen = Math.hypot(vx, vy);
    if (outLen < 0.6) continue;

    const ux = vx / outLen;
    const uy = vy / outLen;
    const outNx = (vy / outLen) * sign;
    const outNy = (-vx / outLen) * sign;

    let angle = (Math.atan2(vy, vx) * 180) / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;

    const c1Concave = isConcaveCorner[i];
    const c2Concave = isConcaveCorner[(i + 1) % n];
    const hasConcaveCorner = c1Concave || c2Concave;
    const placeInnerOutside = !hasConcaveCorner;

    // Buitenmaten
    if (showOuterDimensions && outLen >= 0.8) {
      const outTrack1 = placeInnerOutside ? 0.7 : 0.82;
      let d1x = p1.x + outNx * outTrack1;
      let d1y = p1.y + outNy * outTrack1;
      let d2x = p2.x + outNx * outTrack1;
      let d2y = p2.y + outNy * outTrack1;

      if (c1Concave) {
        d1x += ux * 0.25;
        d1y += uy * 0.25;
      }
      if (c2Concave) {
        d2x -= ux * 0.25;
        d2y -= uy * 0.25;
      }

      let tShift = 0.5;
      if (outLen < 4.5) {
        if (c2Concave && !c1Concave) tShift = 0.32;
        else if (c1Concave && !c2Concave) tShift = 0.68;
      }
      const mid1x = d1x + (d2x - d1x) * tShift;
      const mid1y = d1y + (d2y - d1y) * tShift;

      let badgeW = 2.3;
      let badgeH = 0.64;
      let fontSz = 0.42;
      if (outLen < 2.8) {
        badgeW = Math.max(1.3, +(outLen * 0.75).toFixed(2));
        badgeH = +(0.64 * (badgeW / 2.3)).toFixed(2);
        fontSz = +(0.42 * (badgeW / 2.3)).toFixed(2);
      }

      dimSvg += `
        <!-- Buitenmaat ${i} -->
        <line x1="${p1.x.toFixed(3)}" y1="${p1.y.toFixed(3)}" x2="${(d1x + outNx * 0.12).toFixed(3)}" y2="${(d1y + outNy * 0.12).toFixed(3)}" stroke="#0284c7" stroke-width="0.025" opacity="0.45" />
        <line x1="${p2.x.toFixed(3)}" y1="${p2.y.toFixed(3)}" x2="${d2x.toFixed(3)}" y2="${d2y.toFixed(3)}" stroke="#0284c7" stroke-width="0.05" marker-start="url(#dotBlue)" marker-end="url(#dotBlue)" />
        <g transform="translate(${mid1x.toFixed(3)}, ${mid1y.toFixed(3)}) rotate(${angle.toFixed(1)})">
          <rect x="${(-badgeW / 2).toFixed(2)}" y="${(-badgeH / 2).toFixed(2)}" width="${badgeW.toFixed(2)}" height="${badgeH.toFixed(2)}" rx="0.18" fill="#f0f9ff" stroke="#0284c7" stroke-width="0.04" />
          <text y="${(fontSz * 0.33).toFixed(2)}" fill="#0369a1" font-size="${fontSz.toFixed(2)}" font-family="monospace" font-weight="bold" text-anchor="middle">${outLen.toFixed(2)}m</text>
        </g>
      `;
    }

    // Binnenmaten
    if (showInnerDimensions) {
      const t1 = (q1.x - p1.x) * ux + (q1.y - p1.y) * uy;
      const t2 = (q2.x - p1.x) * ux + (q2.y - p1.y) * uy;
      const projQ1x = p1.x + ux * t1;
      const projQ1y = p1.y + uy * t1;
      const projQ2x = p1.x + ux * t2;
      const projQ2y = p1.y + uy * t2;
      const inLen = Math.hypot(projQ2x - projQ1x, projQ2y - projQ1y);

      if (placeInnerOutside) {
        const outTrack2 = showOuterDimensions ? 1.55 : 0.85;
        const id1x = projQ1x + outNx * outTrack2;
        const id1y = projQ1y + outNy * outTrack2;
        const id2x = projQ2x + outNx * outTrack2;
        const id2y = projQ2y + outNy * outTrack2;
        const mid2x = (id1x + id2x) / 2;
        const mid2y = (id1y + id2y) / 2;

        dimSvg += `
          <!-- Binnenmaat ${i} (buitenwerks) -->
          <line x1="${q1.x.toFixed(3)}" y1="${q1.y.toFixed(3)}" x2="${(id1x + outNx * 0.12).toFixed(3)}" y2="${(id1y + outNy * 0.12).toFixed(3)}" stroke="#d97706" stroke-width="0.025" stroke-dasharray="0.12 0.12" opacity="0.65" />
          <line x1="${q2.x.toFixed(3)}" y1="${q2.y.toFixed(3)}" x2="${(id2x + outNx * 0.12).toFixed(3)}" y2="${(id2y + outNy * 0.12).toFixed(3)}" stroke="#d97706" stroke-width="0.025" stroke-dasharray="0.12 0.12" opacity="0.65" />
          <line x1="${id1x.toFixed(3)}" y1="${id1y.toFixed(3)}" x2="${id2x.toFixed(3)}" y2="${id2y.toFixed(3)}" stroke="#d97706" stroke-width="0.05" marker-start="url(#dotAmber)" marker-end="url(#dotAmber)" />
          <g transform="translate(${mid2x.toFixed(3)}, ${mid2y.toFixed(3)}) rotate(${angle.toFixed(1)})">
            <rect x="-1.15" y="-0.32" width="2.3" height="0.64" rx="0.18" fill="#fffbeb" stroke="#d97706" stroke-width="0.04" />
            <text y="0.14" fill="#b45309" font-size="0.42" font-family="monospace" font-weight="bold" text-anchor="middle">${inLen.toFixed(2)}m</text>
          </g>
        `;
      } else {
        const inDist = 0.55;
        const inNx = (-vy / outLen) * sign;
        const inNy = (vx / outLen) * sign;
        const id1x = q1.x + inNx * inDist;
        const id1y = q1.y + inNy * inDist;
        const id2x = q2.x + inNx * inDist;
        const id2y = q2.y + inNy * inDist;
        const mid2x = (id1x + id2x) / 2;
        const mid2y = (id1y + id2y) / 2;
        const ivx = q2.x - q1.x;
        const ivy = q2.y - q1.y;
        let angleIn = (Math.atan2(ivy, ivx) * 180) / Math.PI;
        if (angleIn > 90 || angleIn < -90) angleIn += 180;

        dimSvg += `
          <!-- Binnenmaat ${i} (inwendig) -->
          <line x1="${q1.x.toFixed(3)}" y1="${q1.y.toFixed(3)}" x2="${(id1x + inNx * 0.1).toFixed(3)}" y2="${(id1y + inNy * 0.1).toFixed(3)}" stroke="#d97706" stroke-width="0.02" opacity="0.45" />
          <line x1="${q2.x.toFixed(3)}" y1="${q2.y.toFixed(3)}" x2="${(id2x + inNx * 0.1).toFixed(3)}" y2="${(id2y + inNy * 0.1).toFixed(3)}" stroke="#d97706" stroke-width="0.02" opacity="0.45" />
          <line x1="${id1x.toFixed(3)}" y1="${id1y.toFixed(3)}" x2="${id2x.toFixed(3)}" y2="${id2y.toFixed(3)}" stroke="#d97706" stroke-width="0.05" marker-start="url(#dotAmber)" marker-end="url(#dotAmber)" />
          <g transform="translate(${mid2x.toFixed(3)}, ${mid2y.toFixed(3)}) rotate(${angleIn.toFixed(1)})">
            <rect x="-1.15" y="-0.32" width="2.3" height="0.64" rx="0.18" fill="#fffbeb" stroke="#d97706" stroke-width="0.04" />
            <text y="0.14" fill="#b45309" font-size="0.42" font-family="monospace" font-weight="bold" text-anchor="middle">${inLen.toFixed(2)}m</text>
          </g>
        `;
      }
    }

    // VOORZIJDE (STRAAT) BADGE
    if (i === floorFrontWallIdx) {
      const fDist = (showOuterDimensions && placeInnerOutside ? 1.55 : 0.85) + 0.95;
      const fX = (p1.x + p2.x) / 2 + outNx * fDist;
      const fY = (p1.y + p2.y) / 2 + outNy * fDist;

      dimSvg += `
        <g transform="translate(${fX.toFixed(3)}, ${fY.toFixed(3)}) rotate(${angle.toFixed(1)})">
          <rect x="-2.2" y="-0.38" width="4.4" height="0.76" rx="0.22" fill="#ffffff" stroke="#1a73e8" stroke-width="0.05" />
          <text y="0.13" fill="#1a73e8" font-size="0.36" font-family="sans-serif" font-weight="bold" text-anchor="middle">◀ VOORZIJDE (STRAAT)</text>
        </g>
      `;
    }
  }

  const floorName =
    numericEtage === 0
      ? 'BEGANE GROND'
      : numericEtage === 1
        ? '1e VERDIEPING (CONCEPT)'
        : isSlanted
          ? 'ZOLDER / KAP (CONCEPT)'
          : '2e VERDIEPING • OPBOUW (CONCEPT)';

  // Mandelige muur detectie
  let mandeliagWallIdx = explicitMandeligWallIdx ?? -1;
  const oppScheidingsmuur = bag3d?.oppScheidingsmuur || (explicitMandelig ? 20 : 0);
  if (mandeliagWallIdx < 0 && oppScheidingsmuur > 10) {
    let bestMandScore = -Infinity;
    const fp1 = pts[floorFrontWallIdx],
      fp2 = pts[(floorFrontWallIdx + 1) % n];
    const fvx = fp2.x - fp1.x,
      fvy = fp2.y - fp1.y;
    const flen = Math.hypot(fvx, fvy);
    const fnx = (fvy / flen) * sign,
      fny = (-fvx / flen) * sign;

    for (let wi = 0; wi < n; wi++) {
      if (wi === floorFrontWallIdx) continue;
      const wp1 = pts[wi],
        wp2 = pts[(wi + 1) % n];
      const wvx = wp2.x - wp1.x,
        wvy = wp2.y - wp1.y;
      const wlen = Math.hypot(wvx, wvy);
      if (wlen < 2.0) continue;
      const wnx = (wvy / wlen) * sign,
        wny = (-wvx / wlen) * sign;
      const dotFront = Math.abs(wnx * fnx + wny * fny);
      if (dotFront > 0.35) continue;
      const isNeighborSide = rotAngle !== 0 ? wny < 0 : wny < -0.5;
      const score = (1.0 - dotFront) * wlen * (isNeighborSide ? 2.5 : 1.0);
      if (score > bestMandScore) {
        bestMandScore = score;
        mandeliagWallIdx = wi;
      }
    }
  }

  let mandeliagSvg = '';
  if (mandeliagWallIdx >= 0 && mandeliagWallIdx < n) {
    const mw1 = pts[mandeliagWallIdx],
      mw2 = pts[(mandeliagWallIdx + 1) % n];
    const mi1 = innerPts[mandeliagWallIdx],
      mi2 = innerPts[(mandeliagWallIdx + 1) % n];
    mandeliagSvg = `
      <polygon points="${mw1.x.toFixed(3)},${mw1.y.toFixed(3)} ${mw2.x.toFixed(3)},${mw2.y.toFixed(3)} ${mi2.x.toFixed(3)},${mi2.y.toFixed(3)} ${mi1.x.toFixed(3)},${mi1.y.toFixed(3)}"
        fill="url(#mandeliagHatch)" stroke="#0f172a" stroke-width="0.04" />
    `;
  }

  return `
    <svg viewBox="${viewBoxX.toFixed(2)} ${viewBoxY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}" class="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="archGrid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#f1f5f9" stroke-width="0.03" />
        </pattern>
        <marker id="dotBlue" markerWidth="4" markerHeight="4" refX="2" refY="2">
          <circle cx="2" cy="2" r="1.3" fill="#0284c7" />
        </marker>
        <marker id="dotAmber" markerWidth="4" markerHeight="4" refX="2" refY="2">
          <circle cx="2" cy="2" r="1.3" fill="#d97706" />
        </marker>
        <pattern id="mandeliagHatch" width="0.4" height="0.4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="0.4" height="0.4" fill="#1e293b" />
          <line x1="0" y1="0" x2="0" y2="0.4" stroke="#f59e0b" stroke-width="0.10" />
        </pattern>
      </defs>

      <rect x="${viewBoxX.toFixed(2)}" y="${viewBoxY.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="url(#archGrid)" />
      ${bgExtensionSvg}
      <path d="${outerPath}" fill="#ffffff" />
      <path d="${outerPath} ${innerPath}" fill="#334155" fill-rule="evenodd" stroke="#0f172a" stroke-width="0.04" stroke-linejoin="round" />
      ${mandeliagSvg}
      ${dimSvg}

      <g transform="translate(${cX.toFixed(2)}, ${cY.toFixed(2)})" text-anchor="middle" pointer-events="none">
        <rect x="-2.2" y="-0.5" width="4.4" height="1.0" rx="0.3" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.04" />
        <text y="0.2" fill="#475569" font-size="0.42" font-weight="bold" font-family="sans-serif">${floorName}</text>
      </g>
    </svg>
  `;
}
