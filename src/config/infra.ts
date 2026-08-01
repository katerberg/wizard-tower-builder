// Pipes / boilers / steam (docs/PIPES.md).
export const BOILER_MANA_PER_SEC = 0.25;
export const MANA_SPRING_PER_SEC = 0.5;
export const STEAM_TURRET_CHARGE_SEC = 3;
export const STEAM_TURRET_DAMAGE = 10;
/** Exterior blast depth (cells outward); perpendicular width is 3. */
export const STEAM_TURRET_BLAST_DEPTH = 3;
/** Throughput units by boilerExpansion level (0 = base, 1–2 = upgrades). */
export const BOILER_THROUGHPUT = [3, 4, 5] as const;
