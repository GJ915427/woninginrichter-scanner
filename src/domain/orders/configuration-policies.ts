/**
 * src/domain/orders/configuration-policies.ts
 *
 * SSOT Configuratie-Policies en attribuut-extractie:
 * - Beleidsdictionaries (montage, bediening, plooitypen, zijden)
 * - Discipline-gating (gordijnen vs raamdecoratie vs horren)
 * - Lamelbreedte matching (10..150 mm)
 */

export function cleanConfigText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\s*\((?:EUR|€)\s*[\d.,]+\)/gi, '')
    .replace(/[®™]/g, '')
    .trim();
}

export function matchPolicyWithWordBoundaries(
  text: string,
  sortedEntries: [string, string][]
): string | undefined {
  for (const [key, val] of sortedEntries) {
    if (text === key) return val;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,:/()\\-])${escaped}(?:$|[\\s,:/()\\-])`, 'i');
    if (regex.test(text)) return val;
  }
  return undefined;
}

export const CONFIG_PLEAT_TYPES: Record<string, string> = {
  'enkele plooi': 'enkele_plooi',
  'enkel plooi': 'enkele_plooi',
  'dubbele plooi': 'dubbele_plooi',
  'dubbel plooi': 'dubbele_plooi',
  'vlinder plooi': 'vlinder_plooi',
  'vlinderplooi': 'vlinder_plooi',
  'tri plooi': 'tri_plooi',
  'triplooi': 'tri_plooi',
  'drievoudige plooi': 'tri_plooi',
  'drievoudig plooi': 'tri_plooi',
  'wave plooi': 'wave',
  'waveplooi': 'wave',
  'wave': 'wave',
  'wavegordijn': 'wave',
  'retour plooi': 'retour_plooi',
  'retourplooi': 'retour_plooi',
  'plooigordijn': 'standaard_plooi',
};

export const CONFIG_OPERATIONS: Record<string, string> = {
  'trekstang bediening': 'trekstang',
  'trekstang': 'trekstang',
  'smartcord': 'smartcord',
  'powerview': 'powerview',
  'ketting': 'ketting',
  'kettingbediening': 'ketting',
  'koord': 'koord',
  'koordbediening': 'koord',
  'trekkoord': 'koord',
  'handgreep': 'handgreep',
  'motor': 'motor',
  'elektrisch': 'elektrisch',
  'slinger': 'slinger',
};

export const CONFIG_MOUNTINGS: Record<string, string> = {
  'in de dag': 'in_de_dag',
  'op de dag': 'op_de_dag',
  'r1 - plafondsteun': 'plafond',
  'plafond kliksteun': 'plafond',
  'plafondsteun': 'plafond',
  'plafond': 'plafond',
  'wand kliksteun': 'wand',
  'wandsteun': 'wand',
  'wand': 'wand',
  'zijwand': 'zijwand',
  'vrijhangend': 'vrijhangend',
  'ingespannen': 'ingespannen',
};

export const CONFIG_SIDES: Record<string, string> = {
  'links': 'links',
  'rechts': 'rechts',
  'middensluitend': 'midden',
  'middensluiting': 'midden',
};

export const CONFIG_ANCHOR_OR_ATTR_LABEL_REGEX =
  /^(?:blijvende\s*maat|dagmaat|bestelmaat|productmaat|afmeting(?:en)?|breedte|hoogte|lengte|maat|bediening|kleur|stof|gaas|lamel(?:breedte)?|type|model|montage|plaatsing|uitvoering|plooi(?:soort)?|pakket)\b/i;

export function extractConfigAttributesFromTexts(
  texts: string[],
  productGroupCode?: string,
  description?: string
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  const sortedMountings = Object.entries(CONFIG_MOUNTINGS).sort((a, b) => b[0].length - a[0].length);
  const sortedPleats = Object.entries(CONFIG_PLEAT_TYPES).sort((a, b) => b[0].length - a[0].length);
  const sortedOperations = Object.entries(CONFIG_OPERATIONS).sort((a, b) => b[0].length - a[0].length);
  const sortedSides = Object.entries(CONFIG_SIDES).sort((a, b) => b[0].length - a[0].length);

  const isSlatDiscipline = Boolean(productGroupCode && (productGroupCode === '2.2' || productGroupCode === '2.3'));
  const hasJaloezieContext = /\bjaloezie(?:[eë]n)?\b/i.test(description || '');

  for (const rawText of texts) {
    const text = cleanConfigText(rawText);
    if (!text) continue;

    const kvMatch = text.match(/^([^:=]+)\s*[:=]\s*(.+)$/i);
    const keyLabel = kvMatch ? kvMatch[1].trim().toLowerCase() : '';
    const valText = kvMatch ? kvMatch[2].trim() : text;
    const lowerVal = valText.toLowerCase();

    // 1. Plooitypen (discipline-gated tegen valse matches bij steunen/bedieningen)
    const isCurtainDiscipline =
      !productGroupCode || productGroupCode.startsWith('1.') || /gordijn|plooi/i.test(keyLabel);
    if (isCurtainDiscipline) {
      const pleatHit = matchPolicyWithWordBoundaries(lowerVal, sortedPleats);
      if (pleatHit && (!attributes['pleat_type'] || attributes['pleat_type'] === 'standaard_plooi')) {
        attributes['pleat_type'] = pleatHit;
      }
    }

    // 2. Montage, 3. Bediening, 4. Zijde
    const mountHit = matchPolicyWithWordBoundaries(lowerVal, sortedMountings);
    if (mountHit && !attributes['mounting']) attributes['mounting'] = mountHit;

    const opHit = matchPolicyWithWordBoundaries(lowerVal, sortedOperations);
    if (opHit && !attributes['operation']) attributes['operation'] = opHit;

    const sideHit = matchPolicyWithWordBoundaries(lowerVal, sortedSides);
    if (sideHit && !attributes['side']) attributes['side'] = sideHit;

    // 5. Lamelbreedte (2.2/2.3, expliciete lamel/slat-key, of 'jaloezie' in item/description; omvat 16..127 mm incl. verticale jaloezieën)
    if (!attributes['slat_width_mm']) {
      if (keyLabel && (keyLabel.includes('lamel') || keyLabel.includes('slat'))) {
        const numMatch = lowerVal.match(/(?:^|\b)(\d{1,3})(?:\s*mm)?(?:\b|$)/);
        if (numMatch) {
          const slatMm = parseInt(numMatch[1], 10);
          if (slatMm >= 10 && slatMm <= 150) attributes['slat_width_mm'] = slatMm;
        }
      } else if (isSlatDiscipline || hasJaloezieContext || /\bjaloezie(?:[eë]n)?\b/i.test(text)) {
        const slatMatch = lowerVal.match(/(?:^|\b)(\d{1,3})\s*mm\b/);
        if (slatMatch) {
          const slatMm = parseInt(slatMatch[1], 10);
          if (slatMm >= 10 && slatMm <= 150) attributes['slat_width_mm'] = slatMm;
        }
      }
    }

    // 6. Gelabelde eigenschappen (kleur/stof/type/gaas)
    if (keyLabel) {
      if (keyLabel === 'kleur' || keyLabel === 'color') attributes['color'] = valText;
      else if (keyLabel === 'stof' || keyLabel === 'fabric') attributes['fabric'] = valText;
      else if (keyLabel === 'type' || keyLabel === 'model') {
        attributes['model_type'] = valText;
        attributes['type'] = valText;
      } else if (keyLabel === 'gaas' || keyLabel === 'mesh') attributes['gaas'] = valText;
    }
  }

  // Fallback voor lamelbreedte rechtstreeks uit jaloezie-omschrijving indien niet in items aanwezig
  if (!attributes['slat_width_mm'] && (isSlatDiscipline || hasJaloezieContext) && description) {
    const cleanDesc = cleanConfigText(description).toLowerCase();
    const descSlatMatch = cleanDesc.match(/(?:^|\b)(\d{1,3})\s*mm\b/);
    if (descSlatMatch) {
      const slatMm = parseInt(descSlatMatch[1], 10);
      if (slatMm >= 10 && slatMm <= 150) attributes['slat_width_mm'] = slatMm;
    }
  }

  return attributes;
}
