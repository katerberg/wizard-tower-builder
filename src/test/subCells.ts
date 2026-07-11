import { exteriorSubAt, macroCenterSubCell } from '@/calculations/subGrid';
import type { Enemy, ExteriorFace, ExteriorNode } from '@/model/types';

/** Map macro grid coords to sub-cell center (legacy spell-range checks). */
export function subAt(macroCol: number, macroRow: number): ExteriorNode {
  return macroCenterSubCell(macroCol, macroRow);
}

/** Exterior sub-cell on a tower wall beside a macro tile. */
export function wallSubAt(macroCol: number, macroRow: number, face: ExteriorFace = 'left'): ExteriorNode {
  return exteriorSubAt(macroCol, macroRow, face);
}

export function makeTestEnemy(
  macroCol: number,
  macroRow: number,
  opts: { templateId?: string; hp?: number; name?: string; face?: ExteriorFace } = {},
): Enemy {
  const pos = wallSubAt(macroCol, macroRow, opts.face ?? 'top');
  return {
    id: `e-${macroCol}-${macroRow}`,
    templateId: opts.templateId ?? 'elite',
    name: opts.name ?? 'Test',
    pos: { ...pos, face: 'left' },
    path: [],
    pathIndex: 0,
    currentHp: opts.hp ?? 28,
    moveCooldown: 0,
    attackCooldown: 0,
  };
}
