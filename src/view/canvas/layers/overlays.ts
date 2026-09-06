import { CELL_SIZE, GRID_COLS, SUB_CELL_SIZE, SUB_CELLS_PER_MACRO } from '@/config/constants';
import { LEYLINE_BAND_ROWS } from '@/config/spellProgression';
import { colors } from '@/view/theme';
import { getBlueprint } from '@/model/blueprints';
import { LEYLINE_RESEARCH_BLUEPRINT_ID } from '@/model/spells/progression';
import { orderFootprintCells } from '@/model/construction';
import { previewPipeFluidAt } from '@/model/pipes';
import { getSolarCollectorPosition } from '@/model/wizard';
import { selectCastPreview, selectConstructionOrders, selectGhostPlacement, selectWizardPosition } from '@/store/selectors';
import type { Snapshot } from '@/store/store';
import { BOARD_WIDTH, cellCenter, cellTopLeft, exteriorNodeDrawCenter, GROUND_LINE_INSET, visibleRowRange } from '../camera';
import { drawElevatorShaft, drawPipeCell, drawStairLine } from './tower';
import { pipeFluidColor } from './shared';

/** Subtle tint on leyline band rows once the blueprint is unlocked. */
export function drawLeylineBands(
  ctx: CanvasRenderingContext2D,
  snapshot: Snapshot,
  scrollY: number,
  viewportHeight: number,
): void {
  const unlocked = snapshot.game.player.unlockedBlueprints.includes(LEYLINE_RESEARCH_BLUEPRINT_ID);
  if (!unlocked) return;
  ctx.fillStyle = colors.leylineBand;
  for (const row of LEYLINE_BAND_ROWS) {
    const { y } = cellTopLeft(0, row, scrollY, viewportHeight);
    if (y < -CELL_SIZE || y > viewportHeight + CELL_SIZE) continue;
    ctx.fillRect(0, y, BOARD_WIDTH, CELL_SIZE);
  }
}
export function drawGrid(ctx: CanvasRenderingContext2D, scrollY: number, viewportHeight: number): void {
  const { minRow, maxRow } = visibleRowRange(scrollY, viewportHeight); const minSubRow = minRow * SUB_CELLS_PER_MACRO; const maxSubRow = (maxRow + 1) * SUB_CELLS_PER_MACRO;
  ctx.strokeStyle = colors.grid; ctx.lineWidth = 1; ctx.globalAlpha = 0.35;
  for (let sc = 0; sc <= GRID_COLS * SUB_CELLS_PER_MACRO; sc++) { ctx.beginPath(); ctx.moveTo(sc * SUB_CELL_SIZE, 0); ctx.lineTo(sc * SUB_CELL_SIZE, viewportHeight); ctx.stroke(); }
  for (let sr = minSubRow; sr <= maxSubRow; sr++) { const y = viewportHeight - (sr + 1) * SUB_CELL_SIZE + scrollY; if (y < -SUB_CELL_SIZE || y > viewportHeight + SUB_CELL_SIZE) continue; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BOARD_WIDTH, y); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.strokeStyle = colors.grid;
  for (let c = 0; c <= GRID_COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL_SIZE, 0); ctx.lineTo(c * CELL_SIZE, viewportHeight); ctx.stroke(); }
  for (let row = minRow; row <= maxRow; row++) { const y = cellTopLeft(0, row, scrollY, viewportHeight).y; if (y < -CELL_SIZE || y > viewportHeight + CELL_SIZE) continue; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BOARD_WIDTH, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, y + CELL_SIZE); ctx.lineTo(BOARD_WIDTH, y + CELL_SIZE); ctx.stroke(); }
}

export function drawGround(ctx: CanvasRenderingContext2D, scrollY: number, viewportHeight: number): void {
  const groundTop = viewportHeight + scrollY - SUB_CELL_SIZE;
  if (groundTop > viewportHeight || groundTop + SUB_CELL_SIZE < 0) return;
  ctx.fillStyle = colors.ground; ctx.fillRect(0, groundTop, BOARD_WIDTH, GROUND_LINE_INSET);
}

export function drawGhost(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const ghost = selectGhostPlacement(snapshot); if (!ghost) return;
  const stroke = ghost.valid ? colors.ghostValid : colors.ghostInvalid;
  if (ghost.infraKind) {
    if (ghost.needsStem || !ghost.valid) { ctx.globalAlpha = 0.35; ctx.fillStyle = stroke; for (const cell of ghost.cells) { const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight); ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4); } ctx.globalAlpha = 1; }
    for (const cell of ghost.cells) {
      const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight);
      if (ghost.infraKind === 'pipe') drawPipeCell(ctx, snapshot.game.tower, cell.col, cell.row, x, y, 0.75, ghost.valid ? pipeFluidColor(previewPipeFluidAt(snapshot.game.tower, cell)) : stroke, new Set(ghost.cells.map((c) => `${c.col},${c.row}`)));
      else if (ghost.infraKind === 'elevator') drawElevatorShaft(ctx, x, y, 0.75, ghost.valid ? undefined : stroke);
      else drawStairLine(ctx, x, y, 0.75, ghost.valid ? undefined : stroke);
    }
    return;
  }
  ctx.globalAlpha = 0.45; ctx.fillStyle = stroke; for (const cell of ghost.cells) { const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight); ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4); } ctx.globalAlpha = 1;
}

/** Painted construction orders (queued sites) during day. */
export function drawConstructionOrders(
  ctx: CanvasRenderingContext2D,
  snapshot: Snapshot,
  scrollY: number,
  viewportHeight: number,
): void {
  const { game } = snapshot;
  if (game.scene !== 'run' || game.phase !== 'day') return;

  for (const order of selectConstructionOrders(snapshot)) {
    if (order.kind !== 'build') continue;
    const bp = getBlueprint(order.blueprintId);
    const cells = orderFootprintCells(order);
    const stroke = colors.ghostValid;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = bp?.color ?? colors.room;
    for (const cell of cells) {
      const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight);
      ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const cell of cells) {
      const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight);
      ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
    ctx.setLineDash([]);

    if (order.status === 'building' || order.status === 'scaffold') {
      const progress = Math.max(0, Math.min(1, order.buildProgress));
      const anchor = cells[0];
      if (!anchor) continue;
      const { x, y } = cellTopLeft(anchor.col, anchor.row, scrollY, viewportHeight);
      const w = (bp?.size.w ?? 1) * CELL_SIZE - 8;
      ctx.fillStyle = colors.hpBarBg;
      ctx.fillRect(x + 4, y + 4, w, 4);
      ctx.fillStyle = colors.hpBar;
      ctx.fillRect(x + 4, y + 4, w * progress, 4);
    }
  }
}

export function drawCastPreview(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const preview = selectCastPreview(snapshot); if (!preview) return;
  ctx.globalAlpha = 0.5; ctx.fillStyle = preview.valid ? colors.spellValid : colors.spellInvalid;
  for (const cell of preview.cells) { const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight); ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4); } ctx.globalAlpha = 1;
}

export function drawPaths(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  ctx.strokeStyle = colors.pathDebug; ctx.lineWidth = 1;
  for (const enemy of snapshot.game.enemies) { if (enemy.path.length < 2) continue; ctx.beginPath(); for (let i = enemy.pathIndex; i < enemy.path.length; i++) { const { x, y } = exteriorNodeDrawCenter(enemy.path[i], scrollY, viewportHeight, 4); if (i === enemy.pathIndex) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  const avatar = snapshot.game.wizardAvatar;
  if (avatar?.path && avatar.path.length >= 2) {
    ctx.strokeStyle = colors.wizard;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = avatar.pathIndex; i < avatar.path.length; i++) {
      const { x, y } = exteriorNodeDrawCenter(avatar.path[i], scrollY, viewportHeight, 4);
      if (i === avatar.pathIndex) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawSolarCollector(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  if (snapshot.game.scene === 'menu') return;
  const pos = getSolarCollectorPosition(snapshot.game);
  const { x, y } = exteriorNodeDrawCenter(pos, scrollY, viewportHeight, CELL_SIZE * 0.32);
  if (y + CELL_SIZE * 0.32 < 0 || y - CELL_SIZE * 0.32 > viewportHeight) return;
  const collector = snapshot.game.solarCollector;
  if (collector.hp <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, CELL_SIZE * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#f6e05e';
  ctx.fill();
  ctx.fillStyle = '#1a202c';
  ctx.font = `${Math.floor(CELL_SIZE * 0.45)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(collector.glyph, x, y);
  const ratio = Math.max(0, Math.min(1, collector.hp / collector.maxHp));
  ctx.fillStyle = colors.hpBarBg;
  ctx.fillRect(x - CELL_SIZE * 0.4, y - CELL_SIZE * 0.5, CELL_SIZE * 0.8, 4);
  ctx.fillStyle = colors.hpBar;
  ctx.fillRect(x - CELL_SIZE * 0.4, y - CELL_SIZE * 0.5, CELL_SIZE * 0.8 * ratio, 4);
}

export function drawWizard(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  if (snapshot.game.scene === 'menu') return;
  const { x, y } = exteriorNodeDrawCenter(selectWizardPosition(snapshot), scrollY, viewportHeight, CELL_SIZE * 0.36);
  const wizard = snapshot.game.player.wizard;
  if (y + CELL_SIZE * 0.36 < 0 || y - CELL_SIZE * 0.36 > viewportHeight) return;
  ctx.beginPath();
  ctx.arc(x, y, CELL_SIZE * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = colors.wizard;
  ctx.fill();
  ctx.fillStyle = '#1a202c';
  ctx.font = `${Math.floor(CELL_SIZE * 0.5)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(wizard.glyph, x, y);
}

export function drawCastAimLine(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const preview = selectCastPreview(snapshot); const target = snapshot.view.hoveredCell; if (!preview || !target) return;
  const from = exteriorNodeDrawCenter(selectWizardPosition(snapshot), scrollY, viewportHeight, CELL_SIZE * 0.36); const to = cellCenter(target.col, target.row, scrollY, viewportHeight);
  ctx.save(); ctx.strokeStyle = preview.valid ? colors.spellAim : colors.spellAimOut; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.restore();
}
