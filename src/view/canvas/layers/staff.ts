import { CELL_SIZE } from '@/config/constants';
import { colors } from '@/view/theme';
import type { Cell, StaffUnit } from '@/model/types';
import type { Snapshot } from '@/store/store';
import { cellCenter } from '../camera';

/** ~1/5 of the prior large glyph marker — small dots so several fit in one cell. */
const STAFF_RADIUS = CELL_SIZE * 0.044;
const MAX_PER_CELL = 4;
const PER_ROW = 2;
const SPACING = CELL_SIZE * 0.18;

function staffFill(unit: StaffUnit): string {
  if (unit.kind === 'mage') return colors.mage;
  if (unit.kind === 'laborer') return colors.laborer;
  return colors.soldier;
}

function interpolatedStaffPos(unit: StaffUnit, snapshot: Snapshot): Cell {
  const prev = snapshot.previousStaffPositions.get(unit.id);
  if (!prev || snapshot.renderAlpha >= 1) return unit.pos;
  const alpha = snapshot.renderAlpha;
  return {
    col: prev.col + (unit.pos.col - prev.col) * alpha,
    row: prev.row + (unit.pos.row - prev.row) * alpha,
  };
}

function drawStaffDot(
  ctx: CanvasRenderingContext2D,
  unit: StaffUnit,
  x: number,
  y: number,
): void {
  const fill = staffFill(unit);
  const active = unit.status === 'stationed' || unit.status === 'working';
  ctx.beginPath();
  ctx.arc(x, y, STAFF_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = active ? fill : `${fill}cc`;
  ctx.fill();
  ctx.strokeStyle = '#1a202c';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawStaff(
  ctx: CanvasRenderingContext2D,
  snapshot: Snapshot,
  scrollY: number,
  viewportHeight: number,
): void {
  const byCell = new Map<string, StaffUnit[]>();
  for (const unit of snapshot.game.staff) {
    // Invisible mine: do not draw laborers underground.
    if (unit.pos.row < 0) continue;
    const key = `${unit.pos.col},${unit.pos.row}`;
    const group = byCell.get(key);
    if (group) group.push(unit);
    else byCell.set(key, [unit]);
  }

  for (const group of byCell.values()) {
    const visible = group.slice(0, MAX_PER_CELL);
    for (let i = 0; i < visible.length; i++) {
      const unit = visible[i];
      const pos = interpolatedStaffPos(unit, snapshot);
      const { x: cx, y: cy } = cellCenter(pos.col, pos.row, scrollY, viewportHeight);
      if (cy + STAFF_RADIUS < 0 || cy - STAFF_RADIUS > viewportHeight) continue;

      const row = Math.floor(i / PER_ROW);
      const col = i % PER_ROW;
      const rowCount = Math.min(PER_ROW, visible.length - row * PER_ROW);
      const rowCountTotal = Math.ceil(visible.length / PER_ROW);
      const x = cx + (col - (rowCount - 1) / 2) * SPACING;
      const y = cy + (row - (rowCountTotal - 1) / 2) * SPACING;
      drawStaffDot(ctx, unit, x, y);
    }
  }
}
