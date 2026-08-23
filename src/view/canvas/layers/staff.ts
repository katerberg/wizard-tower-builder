import { CELL_SIZE } from '@/config/constants';
import { STAFF_GLYPHS, colors } from '@/view/theme';
import type { Cell, StaffUnit } from '@/model/types';
import type { Snapshot } from '@/store/store';
import { cellCenter } from '../camera';

const STAFF_RADIUS = CELL_SIZE * 0.22;

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

function drawStaffUnit(
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
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const fontSize = Math.max(11, STAFF_RADIUS * 1.35);
  ctx.fillStyle = '#1a202c';
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(STAFF_GLYPHS[unit.kind], x, y);
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

  const spacing = CELL_SIZE * 0.24;
  const perRow = 3;

  for (const group of byCell.values()) {
    for (let i = 0; i < group.length; i++) {
      const unit = group[i];
      const pos = interpolatedStaffPos(unit, snapshot);
      const { x: cx, y: cy } = cellCenter(pos.col, pos.row, scrollY, viewportHeight);
      if (cy + STAFF_RADIUS < 0 || cy - STAFF_RADIUS > viewportHeight) continue;

      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, group.length - row * perRow);
      const x = cx + (col - (rowCount - 1) / 2) * spacing;
      const y = cy + (row - (Math.ceil(group.length / perRow) - 1) / 2) * spacing;
      drawStaffUnit(ctx, unit, x, y);
    }
  }
}
