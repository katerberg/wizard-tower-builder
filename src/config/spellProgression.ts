/** Leyline band rows that unlock successive school spells. */
export const LEYLINE_BAND_ROWS = [25, 50, 75] as const;
export type LeylineBandRow = (typeof LEYLINE_BAND_ROWS)[number];

/** Mage cap for a Leyline Research room. */
export const LEYLINE_RESEARCH_STAFF_CAP = 1;

export type LeylineTier = 2 | 3 | 4;

export function bandRowForTier(tier: LeylineTier): LeylineBandRow {
  if (tier === 2) return 25;
  if (tier === 3) return 50;
  return 75;
}

export function tierForBandRow(row: number): LeylineTier | null {
  if (row === 25) return 2;
  if (row === 50) return 3;
  if (row === 75) return 4;
  return null;
}

export function isLeylineBandRow(row: number): row is LeylineBandRow {
  return row === 25 || row === 50 || row === 75;
}
