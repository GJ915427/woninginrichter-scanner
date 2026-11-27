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
  // Samengestelde & specifieke vormen eerst
  // 'enkele_plooi' (2.0):
  'enkele retour plooi': 'enkele_plooi',
  'enkele-retourplooi': 'enkele_plooi',
  'enkele-retour-plooi': 'enkele_plooi',
  'enkele retourplooi': 'enkele_plooi',
  'enkeleretourplooi': 'enkele_plooi',
  'enkel retour plooi': 'enkele_plooi',
  'enkel-retourplooi': 'enkele_plooi',
  'enkel-retour-plooi': 'enkele_plooi',
  'enkel retourplooi': 'enkele_plooi',
  'enkel plooi retour': 'enkele_plooi',
  'enkele plooi retour': 'enkele_plooi',
  'enkele retour': 'enkele_plooi',
  'enkele-retour': 'enkele_plooi',
  'enkeleretour': 'enkele_plooi',
  'enkel retour': 'enkele_plooi',
  'enkel-retour': 'enkele_plooi',
  'enkele plooien': 'enkele_plooi',
  'enkel plooien': 'enkele_plooi',
  'enkele plooi': 'enkele_plooi',
  'enkel plooi': 'enkele_plooi',
  'enkeleplooi': 'enkele_plooi',
  'enkelplooi': 'enkele_plooi',
  'platte plooi': 'enkele_plooi',
  'platteplooi': 'enkele_plooi',
  'platte-plooi': 'enkele_plooi',
  '(enkel)': 'enkele_plooi',

  // 'dubbele_plooi' (2.5):
  'dubbele retour plooi': 'dubbele_plooi',
  'dubbele-retourplooi': 'dubbele_plooi',
  'dubbele-retour-plooi': 'dubbele_plooi',
  'dubbele retourplooi': 'dubbele_plooi',
  'dubbel retour plooi': 'dubbele_plooi',
  'dubbel-retourplooi': 'dubbele_plooi',
  'dubbel-retour-plooi': 'dubbele_plooi',
  'dubbel retourplooi': 'dubbele_plooi',
  'dubbel plooi retour': 'dubbele_plooi',
  'dubbele plooi retour': 'dubbele_plooi',
  'dubbele retour': 'dubbele_plooi',
  'dubbele-retour': 'dubbele_plooi',
  'dubbel retour': 'dubbele_plooi',
  'dubbel-retour': 'dubbele_plooi',
  'dubbele plooien': 'dubbele_plooi',
  'dubbel plooien': 'dubbele_plooi',
  'dubbele plooi': 'dubbele_plooi',
  'dubbel plooi': 'dubbele_plooi',
  'dubbeleplooi': 'dubbele_plooi',
  'dubbelplooi': 'dubbele_plooi',

  // 'vlinder_plooi' (2.5):
  'vlinder retour plooi': 'vlinder_plooi',
  'vlinder-retourplooi': 'vlinder_plooi',
  'vlinder-retour-plooi': 'vlinder_plooi',
  'vlinder retourplooi': 'vlinder_plooi',
  'vlinder plooi retour': 'vlinder_plooi',
  'vlinder retour': 'vlinder_plooi',
  'vlinder-retour': 'vlinder_plooi',
  'vlinder-plooien': 'vlinder_plooi',
  'vlinder plooien': 'vlinder_plooi',
  'vlinderplooien': 'vlinder_plooi',
  'vlinder-plooi': 'vlinder_plooi',
  'vlinder plooi': 'vlinder_plooi',
  'vlinderplooi': 'vlinder_plooi',
  '(vlinder)': 'vlinder_plooi',
  'vlinder': 'vlinder_plooi',

  // 'tri_plooi' (3.0):
  'drievoudige plooi': 'tri_plooi',
  'drievoudig plooi': 'tri_plooi',
  'tri-plooien': 'tri_plooi',
  'tri plooien': 'tri_plooi',
  'triplooien': 'tri_plooi',
  'tri-plooi': 'tri_plooi',
  'tri plooi': 'tri_plooi',
  'triplooi': 'tri_plooi',
  '(triplooi)': 'tri_plooi',

  // 'wave' (2.2):
  'wave-plooien': 'wave',
  'wave plooien': 'wave',
  'waveplooien': 'wave',
  'wave-plooi': 'wave',
  'wave plooi': 'wave',
  'waveplooi': 'wave',
  'wavegordijn': 'wave',
  'wave': 'wave',
  '(wave)': 'wave',

  // Containertermen:
  'retour plooi': 'retour_plooi',
  'retourplooi': 'retour_plooi',
  'retour-plooi': 'retour_plooi',
  'plooigordijn': 'standaard_plooi',
};

export const HARD_WINDOW_TEXT_REGEX =
  /(?:rol[\s-]*gordijn|duo[\s-]*rol[\s-]*gordijn|vouw[\s-]*gordijn|lamel[\s-]*gordijn|verticale\s+lamellen|pliss[eé]|duette|jaloezie|shutter(?:s)?|knikarmscherm(?:en)?|uitvalscherm(?:en)?|terrasscherm(?:en)?|markie(?:s|zen)|pergola|inzethor|voorzethor|inklemhor|rolhor|pliss[eé]hor|hordeur|\bhor(?:ren)?\b|insectenwering|screen|rolluik|zonwering)/i;

export const CURTAIN_TEXT_REGEX =
  /(?<!\b(?:rol|duo[\s-]*rol|vouw|lamel)[\s-]+)(?:\b(?:over|wave|plooi|paneel|ring|glas)?gordijn(?:en)?\b|\bvitrage(?:s)?\b|\binbetween(?:s)?\b|\bconfectie\b)/i;

export const PLINT_OR_PROFILE_REGEX =
  /\b(?:[a-z\-]*plint(?:en)?|[a-z\-]*profiel(?:en)?(?!\s*:)|[a-z\-]*afwerkstrip(?:pen)?|trapneus|trapneuzen)\b/i;

export const RAIL_SUBCOMPONENT_PREFIX_REGEX =
  /(?:\b(?:wandsteun(?:en)?|plafondsteun(?:en)?|afstandssteun(?:en)?|embrassesteun(?:en)?|zijsteun(?:en)?|steun(?:en)?|glijder(?:s)?|waveglijder(?:s)?|runner(?:s)?|waverunner(?:s)?|wave-runner(?:s)?|ring(?:en)?|zeilring(?:en)?|lamel(?:len|breedte)?|rond|vierkant|diameter|buisdiameter|doorsnede)[ \t]*[:=-]?[ \t]*)$/i;

export const RAIL_SUBCOMPONENT_SUFFIX_REGEX =
  /^\.?[ \t]*(?:lamel(?:len)?|steun(?:en)?|wandsteun(?:en)?|glijder(?:s)?|runner(?:s)?|ring(?:en)?|kabel(?:s)?|snoer|oplader|dik\b)/i;

export const RAIL_ACCESSORY_REGEX =
  /(?:\b(?:wandsteun(?:en)?|plafondsteun(?:en)?|afstandssteun(?:en)?|embrassesteun(?:en)?|zijsteun(?:en)?|railsteun(?:en)?|steun(?:en)?|glijder(?:s)?|waveglijder(?:s)?|runner(?:s)?|waverunner(?:s)?|wave-runner(?:s)?|ring(?:en)?|zeilring(?:en)?|eindkap(?:pen)?|eindstop(?:pen)?|trekbeugel(?:s)?|loodveter(?:s)?)\b)/i;

export function isRailAccessory(text: string): boolean {
  if (!text) return false;
  const trimmed = text.replace(/^\s*(?:[-•]\s*)+/, '').trim();
  if (!trimmed) return false;

  // 1. Leidend accessoire (inclusief optionele aantallen / voorvoegsels zoals '4x', 'Dubbele', 'Enkele', 'Wand', etc.)
  const leadingAccessoryPattern =
    /^(?:(?:\d+\s*x\s*|dubbel(?:e)?\s+|enkel(?:e)?\s+|losse\s+)?(?:(?:wand|plafond|afstands|embrasse|rail|roede)[-\s]*)?(?:steun(?:en)?|glijder(?:s)?|runner(?:s)?|ring(?:en)?|zeilring(?:en)?|kap(?:pen)?|stop(?:pen)?|eindstop(?:pen)?|eindkap(?:pen)?|trekbeugel(?:s)?|loodveter(?:s)?)\b)/i;
  if (leadingAccessoryPattern.test(trimmed)) {
    return true;
  }

  // 2. Verwijder ondergeschikte toevoegingen ('met ringen', 'incl. zeilringen', 'met loodveter', etc.)
  const withoutAdditions = trimmed
    .replace(
      /\b(?:met|incl\.?|inclusief|voorzien\s+van)\s+[a-z0-9\s\-]+(?:\b|$)/gi,
      ' '
    )
    .trim();

  // Als de resterende basistekst een echt gordijn/vitrage/inbetween betreft: geen los accessoire
  if (CURTAIN_TEXT_REGEX.test(withoutAdditions)) {
    return false;
  }

  // 3. Overige posities: accessoire vóór doelclausule (bijv. 'Dubbele steun voor rail')
  return RAIL_ACCESSORY_REGEX.test(withoutAdditions);
}

export const CUMULATIVE_METERAGE_CONTEXT_REGEX =
  /\b(?:(?:gordijn|voering|inbetween|vitrage|meubel|bekledings|overgordijn|verduisterings|katoen|linnen)?stof(?:fen)?|benodigd(?:e)?|nodig|marmoleum|linoleum|vinyl|tapijt|pvc|laminaat|steiger|nisten|[a-z\-]*plint(?:en)?|afwerkstrip(?:pen)?|trapneus|trapneuzen)\b|\b\d+[ \t]*(?:lengtes|pakken|rollen)\b/i;

export const NON_RAIL_CURTAIN_CONTEXT_REGEX =
  /\b(?:stof|nisten|kamerhoogte|confectie|zoom)\b/i;

export function isFabricProduct(desc: string): boolean {
  if (!desc) return false;
  const isFabricMatch =
    /\b(?:(?:gordijn|voering|inbetween|vitrage|meubel|bekledings|overgordijn|verduisterings)stof(?:fen)?|(?:gordijn|vitrage|inbetween|voering)\s+stof(?:fen)?)\b/i.test(desc);
  if (!isFabricMatch) return false;
  const hasConfectionOrCurtain =
    /\b(?:(?:over|wave|plooi|paneel|ring|glas)gordijn(?:en)?|gordijn(?:en)?(?!\s+stof(?:fen)?\b)|vitrage(?:s)?(?!\s+stof(?:fen)?\b)|inbetween(?:s)?(?!\s+stof(?:fen)?\b)|confectie|plooi(?:en)?|retour|wave|haak|haken|zoom|geplooid|loodband)\b/i.test(desc);
  if (hasConfectionOrCurtain) return false;
  const hasAddedMaterial =
    /\b(?:met|incl\.?|inclusief|excl\.?|exclusief)\s+(?:[a-z\-]+\s+)?[a-z\-]*stof(?:fen)?\b/i.test(desc);
  if (hasAddedMaterial) return false;
  return true;
}

export function isConsumptionProduct(desc: string, unit?: string): boolean {
  if (!desc) return false;
  if (isTrueRailText(desc)) return false;
  if (HARD_WINDOW_TEXT_REGEX.test(desc)) return false;
  if (isFabricProduct(desc)) return true;
  if (CURTAIN_TEXT_REGEX.test(desc)) return false;
  if (unit === 'm2' || unit === 'm²') return true;
  return /\b(?:marmoleum|linoleum|vinyl|tapijt|pvc|laminaat|steiger|nisten|[a-z\-]*plint(?:en)?|afwerkstrip(?:pen)?|trapneus|trapneuzen|[a-z\-]*profiel(?:en)?(?!\s*:))\b/i.test(desc);
}

export function isTrueRailText(text: string): boolean {
  if (!text) return false;
  if (/\btrap(?:pen|loper|renovatie|roede(?:s|n)?)?\b/i.test(text)) return false;
  if (/^\s*(?:montagekosten|de-?\s*en\s*montagekosten|service\s*\/\s*montage)\b/i.test(text)) return false;
  if (isFabricProduct(text)) return false;

  const trimmed = text.replace(/^\s*(?:[-•]\s*)+/, '').trim();
  if (!trimmed) return false;

  if (/^(?:op|met|incl\.?|exclusief|excl\.?|voor|bij|zonder|naast)\s+(?:bestaande\s+)?[a-z0-9\-]*(?:rail|roede|qurails)/i.test(trimmed)) {
    return false;
  }
  if (/\b(?:onder|boven|zij|geleide|vouwgordijn|schilderij)rail(?:s|en)?\b|\brailsystee[mn]\b/i.test(trimmed)) {
    return false;
  }

  // VÓÓR accessoire-stripping: Weer leidende montage-accessoires
  if (/^(?:\d+\s*x\s*)?(?:(?:wand|plafond|afstands|embrasse|rail|roede)[-\s]*)?(?:steun(?:en)?|glijder(?:s)?|runner(?:s)?|ring(?:en)?|kap(?:pen)?)\b/i.test(trimmed)) {
    return false;
  }

  // Verwijder daarna eventuele overige rail-/roede-accessoires en trim witruimte
  const cleanText = trimmed.replace(/\b(?:rail|roede)[-\s]*(?:steun(?:en)?|glijder(?:s)?|runner(?:s)?|ring(?:en)?|kap(?:pen)?)\b/gi, ' ').trim();
  if (!cleanText) return false;

  // Symmetrische vooraanstaande rail-/roede-toets op cleanText:
  const leadingRailPattern = /^(?:losse\s+(?:[a-z0-9\-]*rail|roede)|(?:[a-z0-9\-]*rail(?:roede)?|roede)(?:s|n|en)?|qurails|(?:gordijn|wave|paneel|trek|clip|design|mini|wepro|u-?|pijp|vion)[\s-]+(?:rail(?:s|en)?|roede(?:s|n)?))\b|^(?:paneel(?:gordijn)?|vitrage|inbetween|gordijn)\s+losse\s+(?:[a-z0-9\-]*rail(?:roede)?|roede)(?:s|n|en)?\b(?![^\r\n]*\d+(?:[.,]\d+)?\s*[x×]\s*\d+)/i;
  if (leadingRailPattern.test(cleanText)) {
    return true;
  }

  // Overige posities (merkonafhankelijke structurele analyse op cleanText):
  const normalized = cleanText.replace(/\b(gordijn|wave|paneel)\s+(rail(?:s|en)?|roede(?:s|n)?)\b/gi, '$1$2');
  const strippedSub = normalized.replace(/(?:\b(?:hangt\s+op|bevestigd\s+op|op|met|incl\.?|inclusief|exclusief|excl\.?|voor|bij|zonder|naast|t\.?b\.?v\.?)\s+(?:een\s+|de\s+)?(?:bestaande\s+)?(?:losse\s+)?[a-z0-9\-]*(?:rail(?:roede)?|roede|qurails)(?:s|n|en)?\b)/gi, ' ');
  if (!/(?:^|[\s(/\-])(?:[a-z0-9\-]*(?:rail(?:roede)?|roede)(?:s|n|en)?|qurails)\b/i.test(strippedSub)) {
    return false;
  }

  const strippedTarget = strippedSub.replace(/\bvoor\s+(?:een\s+|de\s+|het\s+)?(?:(?:rol|duo[\s-]*rol|vouw|lamel|over|wave|plooi|paneel|ring|glas)?gordijn(?:en)?|vitrage(?:s)?|inbetween(?:s)?|verticale\s+lamellen)\b/gi, ' ').trim();

  if (HARD_WINDOW_TEXT_REGEX.test(strippedTarget)) return false;
  if (CURTAIN_TEXT_REGEX.test(strippedTarget)) return false;
  if (isFabricProduct(strippedTarget)) return false;

  return true;
}

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
  const genericPleatValues = new Set(['standaard_plooi', 'retour_plooi']);
  const sortedPleats = Object.entries(CONFIG_PLEAT_TYPES).sort((a, b) => {
    const aIsGeneric = genericPleatValues.has(a[1]);
    const bIsGeneric = genericPleatValues.has(b[1]);
    if (aIsGeneric !== bIsGeneric) return aIsGeneric ? 1 : -1;
    return b[0].length - a[0].length;
  });
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

    // Lokale pleatText kopie voor stripping vóór kvMatch splitsing (behoudt keyLabel/valText voor latere stappen)
    const pleatText = text.replace(/\bwave[-\s]*(?:rail(?:s|en)?|glijder(?:s)?|runner(?:s)?)\b/gi, ' ');
    const pleatKvMatch = pleatText.match(/^([^:=]+)\s*[:=]\s*(.+)$/i);
    const pleatKeyLabel = pleatKvMatch ? pleatKvMatch[1].trim().toLowerCase() : '';
    const pleatValText = pleatKvMatch ? pleatKvMatch[2].trim() : pleatText;
    const lowerPleatVal = pleatValText.toLowerCase();

    // 1. Plooitypen (discipline-gated tegen valse matches bij steunen/bedieningen)
    const isCurtainDiscipline =
      !productGroupCode || productGroupCode.startsWith('1.') || /plooi|gordijn|wave/i.test(pleatKeyLabel);
    if (isCurtainDiscipline) {
      let pleatCandidate = lowerPleatVal;
      let allowPleat = true;
      if (pleatKvMatch) {
        const isNegative = /^(?:nee|geen|niet\b|n\.?v\.?t\.?|zonder|false|0)/i.test(pleatValText.trim());
        if (isNegative) {
          allowPleat = false;
        } else if (/plooi|gordijn|wave/i.test(pleatKeyLabel)) {
          pleatCandidate = `${pleatKeyLabel} ${lowerPleatVal}`;
        }
      }
      if (allowPleat) {
        const pleatHit =
          matchPolicyWithWordBoundaries(pleatCandidate, sortedPleats) ||
          matchPolicyWithWordBoundaries(lowerPleatVal, sortedPleats) ||
          matchPolicyWithWordBoundaries(pleatText.toLowerCase(), sortedPleats);
        if (pleatHit) {
          const currentPleat = attributes['pleat_type'] as string | undefined;
          if (!currentPleat || genericPleatValues.has(currentPleat)) {
            attributes['pleat_type'] = pleatHit;
          }
        }
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
