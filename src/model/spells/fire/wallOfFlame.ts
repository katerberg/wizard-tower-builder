import { loseGame } from '@/model/phases';
import { addMessage } from '@/model/messages';
import { roomAt, getWizardPosition } from '@/model/tower';
import {
  WALL_ENTER_DAMAGE,
  WALL_OF_FLAME_DURATION,
  WALL_OF_FLAME_MAX_CELLS,
  WALL_TICK_DAMAGE,
  WALL_TICK_INTERVAL,
} from './constants';
import { applyFireDamage } from './kindled';
import type { Cell, GameState, Tower, WallOfFlameSegment } from '@/model/types';

const ORTHO: Cell[] = [
  { col: 0, row: 1 },
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: -1, row: 0 },
];

export type TowerFaceTag = 'left' | 'right' | 'top' | 'ground';

/** Which tower face a trap/endpoint cell hugs (for same-face rule). */
export function towerFaceAtCell(tower: Tower, cell: Cell): TowerFaceTag | null {
  if (roomAt(tower, cell.col, cell.row)) return null;

  let face: TowerFaceTag | null = null;
  for (const d of ORTHO) {
    const nc = cell.col + d.col;
    const nr = cell.row + d.row;
    if (!roomAt(tower, nc, nr)) continue;

    let f: TowerFaceTag;
    if (d.col === 1) f = 'left';
    else if (d.col === -1) f = 'right';
    else if (d.row === 1) f = 'top';
    else f = 'ground';

    if (face && face !== f) return null;
    face = f;
  }
  return face;
}

export function isWallEndpointCell(tower: Tower, cell: Cell): boolean {
  return towerFaceAtCell(tower, cell) != null;
}

/** Bresenham line on grid; returns null if longer than maxCells. */
export function gridLineCells(a: Cell, b: Cell, maxCells: number): Cell[] | null {
  const cells: Cell[] = [];
  let x0 = a.col;
  let y0 = a.row;
  const x1 = b.col;
  const y1 = b.row;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    cells.push({ col: x0, row: y0 });
    if (cells.length > maxCells) return null;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return cells;
}

export function validateWallSegment(tower: Tower, a: Cell, b: Cell): { ok: true; cells: Cell[] } | { ok: false } {
  const faceA = towerFaceAtCell(tower, a);
  const faceB = towerFaceAtCell(tower, b);
  if (!faceA || !faceB || faceA !== faceB) return { ok: false };
  const cells = gridLineCells(a, b, WALL_OF_FLAME_MAX_CELLS);
  if (!cells) return { ok: false };
  return { ok: true, cells };
}

export function addWallSegment(state: GameState, cells: Cell[]): void {
  const segment: WallOfFlameSegment = {
    cells,
    expiresAt: state.waveTimer + WALL_OF_FLAME_DURATION,
    tickAccumulator: 0,
    entered: {},
  };
  state.wallOfFlameSegments.push(segment);
}

function cellKey(c: Cell): string {
  return `${c.col},${c.row}`;
}

function enemyInSegmentCells(enemy: { pos: { col: number; row: number } }, cells: Cell[]): boolean {
  return cells.some((c) => c.col === enemy.pos.col && c.row === enemy.pos.row);
}

export function tickWallOfFlame(state: GameState, dt: number): void {
  const wizardPos = getWizardPosition(state.tower);
  const active: WallOfFlameSegment[] = [];

  for (const seg of state.wallOfFlameSegments) {
    if (state.waveTimer >= seg.expiresAt) continue;
    active.push(seg);

    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      if (!enemyInSegmentCells(enemy, seg.cells)) continue;

      const enterKey = `${enemy.id}:${cellKey({ col: enemy.pos.col, row: enemy.pos.row })}`;
      if (!seg.entered[enterKey]) {
        seg.entered[enterKey] = true;
        applyFireDamage(state, enemy, WALL_ENTER_DAMAGE, 'Wall of Flame');
      }
    }

    seg.tickAccumulator += dt;
    if (seg.tickAccumulator >= WALL_TICK_INTERVAL) {
      seg.tickAccumulator -= WALL_TICK_INTERVAL;
      for (const enemy of state.enemies) {
        if (enemy.currentHp <= 0) continue;
        if (!enemyInSegmentCells(enemy, seg.cells)) continue;
        applyFireDamage(state, enemy, WALL_TICK_DAMAGE, 'Wall of Flame');
      }

      if (seg.cells.some((c) => c.col === wizardPos.col && c.row === wizardPos.row)) {
        const wizard = state.player.wizard;
        wizard.hp = Math.max(0, wizard.hp - WALL_TICK_DAMAGE);
        addMessage(state, `Wall of Flame scorches the wizard for ${WALL_TICK_DAMAGE}!`, 'combat');
        if (wizard.hp <= 0) {
          loseGame(state);
        }
      }
    }
  }

  state.wallOfFlameSegments = active;
}
