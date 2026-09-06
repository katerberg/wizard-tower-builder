/** Solar collector raid-mode knobs (post-break retargeting). */

/** Absolute macro-row delta for last-hitter and economy-room raid goals. */
export const RAID_VERTICAL_BAND = 4;

/** Laborer mine harvest multiplier the night after a collector break (repair tax). */
export const HARVEST_REPAIR_TAX = 0.5;

/**
 * Economy rooms enemies prefer after the collector breaks (within {@link RAID_VERTICAL_BAND}).
 * Storage wipe remains the only lose condition.
 */
export const RAID_ECONOMY_BLUEPRINT_IDS = [
  'storageRoom',
  'manaSpringRoom',
  'boilerRoom',
  'forgeRoom',
  'pumpRoom',
] as const;

export type RaidEconomyBlueprintId = (typeof RAID_ECONOMY_BLUEPRINT_IDS)[number];

export function isRaidEconomyBlueprint(id: string): boolean {
  return (RAID_ECONOMY_BLUEPRINT_IDS as readonly string[]).includes(id);
}

/** Apply the post-break harvest tax (lives in config so harvest/staff stays free of raid↔spell cycles). */
export function applyHarvestRepairTax(
  stone: number,
  metal: number,
  gold: number,
  taxActive: boolean,
): { stone: number; metal: number; gold: number } {
  if (!taxActive) return { stone, metal, gold };
  return {
    stone: stone * HARVEST_REPAIR_TAX,
    metal: metal * HARVEST_REPAIR_TAX,
    gold: gold * HARVEST_REPAIR_TAX,
  };
}
