/**
 * 1-on-1 port of getTypicalWallThickness from google_maps_picker.html.
 * Calculates standard Dutch exterior wall thickness based on construction year.
 */
export function getTypicalWallThickness(bouwjaar: number | string | null | undefined): number {
  if (!bouwjaar) return 0.28;
  const y = typeof bouwjaar === 'number' ? bouwjaar : parseInt(bouwjaar, 10);
  if (!y || isNaN(y)) return 0.28;
  if (y < 1975) return 0.28; // Vóór 1975: smalle/ongeïsoleerde spouw (28 cm)
  if (y < 1991) return 0.30; // 1975-1990: eerste isolatienormen (30 cm)
  if (y < 2006) return 0.32; // 1991-2005 (32 cm)
  if (y < 2015) return 0.35; // 2006-2014 (35 cm)
  return 0.40; // 2015+ (40 cm)
}
