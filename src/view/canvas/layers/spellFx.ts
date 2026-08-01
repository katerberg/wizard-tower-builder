import { CELL_SIZE } from '@/config/constants';
import { colors } from '@/view/theme';
import { blizzardZoneCells } from '@/model/spells';
import { selectWizardPosition } from '@/store/selectors';
import type { Snapshot } from '@/store/store';
import { cellTopLeft, exteriorNodeDrawCenter } from '../camera';

export function drawSpellFx(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const { game } = snapshot;
  for (const patch of game.kindlingPatches ?? []) {
    if (patch.expiresAt <= game.waveTimer) continue;
    const { x, y } = cellTopLeft(patch.col, patch.row, scrollY, viewportHeight);
    ctx.globalAlpha = 0.7; ctx.fillStyle = colors.kindlingPatch; ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8); ctx.strokeStyle = '#ecc94b'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8); ctx.globalAlpha = 1; ctx.fillStyle = '#ecc94b'; ctx.font = `${Math.floor(CELL_SIZE * 0.4)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('K', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
  }
  for (const segment of game.wallOfFlameSegments ?? []) {
    if (segment.expiresAt <= game.waveTimer) continue;
    ctx.globalAlpha = 0.55; ctx.fillStyle = colors.wallFlame;
    for (const cell of segment.cells) { const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight); ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4); }
    ctx.globalAlpha = 1;
  }
  for (const zone of game.blizzardZones ?? []) {
    if (zone.expiresAt <= game.waveTimer) continue;
    ctx.globalAlpha = 0.4; ctx.fillStyle = colors.blizzardZone;
    for (const cell of blizzardZoneCells(zone.center, zone.radius)) { const { x, y } = cellTopLeft(cell.col, cell.row, scrollY, viewportHeight); ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4); }
    ctx.globalAlpha = 1;
  }
  for (const segment of game.tornadoSegments ?? []) {
    if (segment.expiresAt <= game.waveTimer) continue;
    ctx.globalAlpha = 0.55; ctx.fillStyle = colors.tornadoLane;
    for (const cell of segment.macroCells) for (const row of [cell.row, cell.row + 1]) { const { x, y } = cellTopLeft(cell.col, row, scrollY, viewportHeight); ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4); }
    ctx.globalAlpha = 1;
  }
  for (const patch of game.faultPatches ?? []) {
    if (patch.expiresAt <= game.waveTimer) continue;
    const { x, y } = cellTopLeft(patch.col, patch.row, scrollY, viewportHeight);
    ctx.globalAlpha = 0.75; ctx.fillStyle = colors.faultPatch; ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8); ctx.strokeStyle = '#718096'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8); ctx.globalAlpha = 1; ctx.fillStyle = '#2d3748'; ctx.font = `${Math.floor(CELL_SIZE * 0.4)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('F', x + CELL_SIZE / 2, y + CELL_SIZE / 2);
  }
  for (const boulder of game.pendingBoulders ?? []) {
    const { x, y } = cellTopLeft(boulder.col, boulder.row, scrollY, viewportHeight);
    ctx.globalAlpha = 0.9; ctx.fillStyle = colors.boulder; ctx.beginPath(); ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (game.fortified) {
    const { x, y } = exteriorNodeDrawCenter(selectWizardPosition(snapshot), scrollY, viewportHeight, CELL_SIZE * 0.36);
    ctx.strokeStyle = '#a0aec0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, CELL_SIZE * 0.48, 0, Math.PI * 2); ctx.stroke();
  }
  for (const wet of game.wetCells ?? []) {
    const { x, y } = cellTopLeft(wet.col, wet.row, scrollY, viewportHeight);
    ctx.globalAlpha = wet.kind === 'puddle' ? 0.7 : 0.45; ctx.fillStyle = wet.kind === 'puddle' ? colors.wetPuddle : colors.wetSheet;
    if (wet.kind === 'puddle') { ctx.beginPath(); ctx.ellipse(x + CELL_SIZE / 2, y + CELL_SIZE * 0.7, CELL_SIZE * 0.4, CELL_SIZE * 0.18, 0, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(x + CELL_SIZE * 0.35, y, CELL_SIZE * 0.3, CELL_SIZE);
    ctx.globalAlpha = 1;
  }
}
