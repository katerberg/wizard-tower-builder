import type { Cell, GameState, TornadoSegment } from '../../types';
import type { SpellDef } from '../types';
import { TORNADO_DURATION, TORNADO_MAX_CELLS } from './constants';
import { addTornadoSegment } from './tick';

export function tornadoGridLine(from: Cell, to: Cell): Cell[] | null {
  const dist = Math.abs(from.col - to.col) + Math.abs(from.row - to.row);
  if (dist === 0) return [from];
  if (dist > TORNADO_MAX_CELLS) return null;

  const cells: Cell[] = [];
  for (let i = 0; i <= dist; i++) {
    const t = i / dist;
    cells.push({
      col: Math.round(from.col + (to.col - from.col) * t),
      row: Math.round(from.row + (to.row - from.row) * t),
    });
  }

  const deduped: Cell[] = [];
  for (const cell of cells) {
    const prev = deduped[deduped.length - 1];
    if (prev?.col !== cell.col || prev?.row !== cell.row) {
      deduped.push(cell);
    }
  }
  return deduped;
}

export function tornadoVolumeCells(segment: TornadoSegment): Cell[] {
  const out: Cell[] = [];
  for (const base of segment.macroCells) {
    out.push(base);
    out.push({ col: base.col, row: base.row + 1 });
  }
  return out;
}

export function isInTornadoVolume(state: GameState, macroCol: number, macroRow: number): boolean {
  for (const seg of state.tornadoSegments) {
    if (seg.expiresAt <= state.waveTimer) continue;
    for (const base of seg.macroCells) {
      if (base.col === macroCol && (base.row === macroRow || base.row + 1 === macroRow)) {
        return true;
      }
    }
  }
  return false;
}

export function ensureAirState(state: GameState): void {
  if (!state.tornadoSegments) state.tornadoSegments = [];
  if (!state.blizzardZones) state.blizzardZones = [];
}

export const tornado: SpellDef = {
  id: 'tornado',
  name: 'Tornado',
  glyph: 'T',
  description: 'Draw a 2-high blocking wind lane in the air. Ejects intruders — wizard included.',
  manaCost: 5,
  cooldown: 4,
  targeting: 'airSegment',
  range: 8,
  damage: 0,
  cast(ctx, target) {
    if (target.kind !== 'segment') return;
    const cells = tornadoGridLine(target.from, target.to);
    if (!cells) return;
    addTornadoSegment(ctx.state, {
      macroCells: cells,
      expiresAt: ctx.state.waveTimer + TORNADO_DURATION,
    });
    ctx.log(`Tornado spins up (${cells.length} columns).`, 'combat');
  },
};
