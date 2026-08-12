import { CELL_SIZE } from '@/config/constants';
import { STAFF_GLYPHS, colors } from '@/view/theme';
import type { Snapshot } from '@/store/store';
import { cellCenter } from '../camera';

export function drawStaff(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const byCell = new Map<string, typeof snapshot.game.staff>();
  for (const unit of snapshot.game.staff) {
    // Invisible mine: do not draw laborers underground.
    if (unit.pos.row < 0) continue;
    const key = `${unit.pos.col},${unit.pos.row}`;
    const group = byCell.get(key);
    if (group) group.push(unit);
    else byCell.set(key, [unit]);
  }
  const fontSize = Math.max(10, CELL_SIZE * 0.28); const spacing = CELL_SIZE * 0.22; const perRow = 3;
  for (const group of byCell.values()) for (let i = 0; i < group.length; i++) {
    const unit = group[i]; const { x: cx, y: cy } = cellCenter(unit.pos.col, unit.pos.row, scrollY, viewportHeight);
    if (cy + fontSize < 0 || cy - fontSize > viewportHeight) continue;
    const row = Math.floor(i / perRow); const col = i % perRow; const rowCount = Math.min(perRow, group.length - row * perRow);
    const x = cx + (col - (rowCount - 1) / 2) * spacing; const y = cy + (row - (Math.ceil(group.length / perRow) - 1) / 2) * spacing;
    const fill = unit.kind === 'mage' ? colors.mage : unit.kind === 'laborer' ? colors.laborer : colors.soldier;
    ctx.fillStyle = unit.status === 'stationed' || unit.status === 'working' ? fill : `${fill}aa`;
    ctx.font = `bold ${fontSize}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(STAFF_GLYPHS[unit.kind], x, y);
  }
}
