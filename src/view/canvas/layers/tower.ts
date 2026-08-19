import { CELL_SIZE } from '@/config/constants';
import { colors } from '@/view/theme';
import { computeRoomStats, computeStructureStats } from '@/calculations/combat';
import { parseKey, roomCells } from '@/calculations/grid';
import { getBlueprint } from '@/model/blueprints';
import { getFortificationBlueprint } from '@/model/fortificationBlueprints';
import { getModification } from '@/model/modifications';
import { resolvePipeFluids, pipeVisualLinks } from '@/model/pipes';
import { isOverhangUnlocked } from '@/model/research';
import { getUnstableStructureIds } from '@/model/tower';
import { selectRoomBuildAlerts, selectStructureBuildAlerts } from '@/store/selectors';
import type { Snapshot } from '@/store/store';
import { cellTopLeft, visibleRowRange } from '../camera';
import { drawHpBar, pipeFluidColor } from './shared';

export function drawTower(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  drawStructures(ctx, snapshot, scrollY, viewportHeight);
  drawRooms(ctx, snapshot, scrollY, viewportHeight);
  drawShellFortifications(ctx, snapshot, scrollY, viewportHeight);
}

export function drawInfra(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const { minRow, maxRow } = visibleRowRange(scrollY, viewportHeight);
  const phase = snapshot.game.phase === 'night' ? 'night' : 'day';
  const pipeFluids = resolvePipeFluids(snapshot.game.tower, phase);
  const tower = snapshot.game.tower;
  for (const [key, cell] of Object.entries(tower.infra)) {
    const { col, row } = parseKey(key);
    if (row < minRow || row > maxRow) continue;
    const { x, y } = cellTopLeft(col, row, scrollY, viewportHeight);
    if (cell.kind === 'pipe') drawPipeCell(ctx, tower, col, row, x, y, 1, pipeFluidColor(pipeFluids[key] ?? 'unassigned'));
    else if (cell.kind === 'elevator') drawElevatorShaft(ctx, x, y, 1, undefined, snapshot.game.elevators.some((car) => car.col === col && car.row === row));
    else drawStairLine(ctx, x, y, 1);
  }
}

export function drawTowerAlerts(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const hover = snapshot.view.hoveredCell;
  if (!hover) return;
  const structureAlerts = new Map(selectStructureBuildAlerts(snapshot).map((a) => [a.structureId, a.message] as const));
  for (const structure of snapshot.game.tower.structures ?? []) {
    const message = structureAlerts.get(structure.id);
    if (!message || !roomCells(structure.origin, structure.size).some((c) => c.col === hover.col && c.row === hover.row)) continue;
    if (snapshot.game.tower.rooms.some((room) => roomCells(room.origin, room.size).some((c) => c.col === hover.col && c.row === hover.row))) continue;
    const { x, y } = cellTopLeft(structure.origin.col, structure.origin.row + structure.size.h - 1, scrollY, viewportHeight);
    drawRoomAlert(ctx, message, x, y, structure.size.w * CELL_SIZE);
  }
  const roomAlerts = new Map(selectRoomBuildAlerts(snapshot).map((a) => [a.roomId, a.message] as const));
  for (const room of snapshot.game.tower.rooms) {
    const message = roomAlerts.get(room.id);
    if (!message || !roomCells(room.origin, room.size).some((c) => c.col === hover.col && c.row === hover.row)) continue;
    const { x, y } = cellTopLeft(room.origin.col, room.origin.row + room.size.h - 1, scrollY, viewportHeight);
    drawRoomAlert(ctx, message, x, y, room.size.w * CELL_SIZE);
  }
}

function drawStructures(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const { minRow, maxRow } = visibleRowRange(scrollY, viewportHeight);
  const unstable = getUnstableStructureIds(snapshot.game.tower, isOverhangUnlocked(snapshot.game));
  for (const structure of snapshot.game.tower.structures ?? []) {
    const maxStructureRow = structure.origin.row + structure.size.h - 1;
    if (maxStructureRow < minRow || structure.origin.row > maxRow) continue;
    if (roomCells(structure.origin, structure.size).every((c) => snapshot.game.tower.rooms.some((room) => roomCells(room.origin, room.size).some((rc) => rc.col === c.col && rc.row === c.row)))) continue;
    const blueprint = getBlueprint(structure.blueprintId);
    const isScaffold = structure.blueprintId === 'scaffold';
    const isInvalid = unstable.has(structure.id);
    const { x, y } = cellTopLeft(structure.origin.col, maxStructureRow, scrollY, viewportHeight);
    const w = structure.size.w * CELL_SIZE;
    const h = structure.size.h * CELL_SIZE;
    ctx.globalAlpha = isScaffold ? 0.75 : 0.55;
    ctx.fillStyle = isScaffold ? '#a0aec0' : blueprint?.color ?? colors.room;
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.globalAlpha = 1;
    if (isScaffold) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#cbd5e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.setLineDash([]);
    }
    if (isInvalid) { ctx.globalAlpha = 0.35; ctx.fillStyle = colors.ghostInvalid; ctx.fillRect(x + 3, y + 3, w - 6, h - 6); ctx.globalAlpha = 1; }
    ctx.strokeStyle = isInvalid ? colors.ghostInvalid : colors.roomStroke; ctx.lineWidth = 1; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    ctx.globalAlpha = 0.7; ctx.fillStyle = colors.text; ctx.font = `${Math.floor(CELL_SIZE * 0.4)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(blueprint?.glyph ?? 'I', x + w / 2, y + h / 2); ctx.globalAlpha = 1;
    if (blueprint) { const stats = computeStructureStats(structure, blueprint); if (structure.hp < stats.maxHp) drawHpBar(ctx, x + 4, y + 4, w - 8, structure.hp / stats.maxHp); }
  }
}

function drawRooms(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const { minRow, maxRow } = visibleRowRange(scrollY, viewportHeight);
  const alerts = new Map(selectRoomBuildAlerts(snapshot).map((a) => [a.roomId, a.message] as const));
  for (const room of snapshot.game.tower.rooms) {
    const maxRoomRow = room.origin.row + room.size.h - 1;
    if (maxRoomRow < minRow || room.origin.row > maxRow) continue;
    const blueprint = getBlueprint(room.blueprintId); const isInvalid = alerts.has(room.id);
    const { x, y } = cellTopLeft(room.origin.col, maxRoomRow, scrollY, viewportHeight);
    const w = room.size.w * CELL_SIZE; const h = room.size.h * CELL_SIZE;
    ctx.fillStyle = blueprint?.color ?? colors.room; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    if (isInvalid) { ctx.globalAlpha = 0.4; ctx.fillStyle = colors.ghostInvalid; ctx.fillRect(x + 2, y + 2, w - 4, h - 4); ctx.globalAlpha = 1; }
    ctx.strokeStyle = isInvalid ? colors.ghostInvalid : colors.roomStroke; ctx.lineWidth = isInvalid ? 3 : 2; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = colors.text; ctx.font = `${Math.floor(CELL_SIZE * 0.5)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(blueprint?.glyph ?? '?', x + w / 2, y + h / 2);
    if (blueprint) { const stats = computeRoomStats(room, blueprint); if (room.hp < stats.maxHp) drawHpBar(ctx, x + 4, y + 4, w - 8, room.hp / stats.maxHp); }
    if (room.modifications.length > 0) drawModIndicators(ctx, room.modifications, x, y + h);
  }
}

function drawRoomAlert(ctx: CanvasRenderingContext2D, message: string, left: number, top: number, width: number): void {
  const fontSize = Math.max(11, Math.floor(CELL_SIZE * 0.24)); const padX = 10; const padY = 6;
  ctx.font = `${fontSize}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(message); const textH = (metrics.actualBoundingBoxAscent || fontSize * 0.8) + (metrics.actualBoundingBoxDescent || fontSize * 0.25);
  const boxW = Math.ceil(metrics.width) + padX * 2; const boxH = Math.ceil(textH) + padY * 2; const boxX = left + (width - boxW) / 2; const boxY = top - boxH - 4;
  ctx.fillStyle = 'rgba(26, 32, 44, 0.92)'; ctx.fillRect(boxX, boxY, boxW, boxH); ctx.strokeStyle = colors.ghostInvalid; ctx.lineWidth = 1; ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1); ctx.fillStyle = colors.connectivityWarn; ctx.fillText(message, left + width / 2, boxY + boxH / 2);
}

function drawModIndicators(ctx: CanvasRenderingContext2D, modifications: { id: string; level: number }[], left: number, bottom: number): void {
  const size = Math.floor(CELL_SIZE * 0.28); const padX = 4; const padY = 2; const badgeH = size + padY * 2; const badgeBottom = bottom - 4;
  ctx.font = `${size}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; let cursorX = left + 5;
  for (const mod of modifications) {
    const def = getModification(mod.id); if (!def) continue;
    const label = mod.level > 1 ? `${def.glyph}${mod.level}` : def.glyph; const badgeW = ctx.measureText(label).width + padX * 2; const badgeY = badgeBottom - badgeH;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(cursorX, badgeY, badgeW, badgeH); ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1; ctx.strokeRect(cursorX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1); ctx.fillStyle = def.color; ctx.fillText(label, cursorX + padX, badgeBottom - padY); cursorX += badgeW + size * 0.35;
  }
}

function drawShellFortifications(ctx: CanvasRenderingContext2D, snapshot: Snapshot, scrollY: number, viewportHeight: number): void {
  const { minRow, maxRow } = visibleRowRange(scrollY, viewportHeight);
  const shell = snapshot.game.tower.shell ?? {};
  for (const [key, cell] of Object.entries(shell)) {
    const { col, row } = parseKey(key);
    if (row < minRow || row > maxRow) continue;
    const bp = getFortificationBlueprint(cell.kind);
    if (!bp) continue;
    const { x, y } = cellTopLeft(col, row, scrollY, viewportHeight);
    const size = Math.floor(CELL_SIZE * 0.32);
    const pad = 3;
    const badgeW = size + pad * 2;
    const badgeH = size + pad * 2;
    const bx = x + CELL_SIZE - badgeW - 3;
    const by = y + 3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(bx, by, badgeW, badgeH);
    ctx.strokeStyle = bp.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 0.5, by + 0.5, badgeW - 1, badgeH - 1);
    ctx.fillStyle = bp.color;
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bp.glyph, bx + badgeW / 2, by + badgeH / 2 + 1);
  }
}

export function drawPipeCell(ctx: CanvasRenderingContext2D, tower: Snapshot['game']['tower'], col: number, row: number, x: number, y: number, alpha: number, stroke: string, extraPipeKeys?: ReadonlySet<string>): void {
  const links = pipeVisualLinks(tower, col, row, extraPipeKeys); const cx = x + CELL_SIZE / 2; const cy = y + CELL_SIZE / 2;
  const ends: { x: number; y: number }[] = []; if (links.north) ends.push({ x: cx, y }); if (links.south) ends.push({ x: cx, y: y + CELL_SIZE }); if (links.west) ends.push({ x, y: cy }); if (links.east) ends.push({ x: x + CELL_SIZE, y: cy });
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = stroke; ctx.fillStyle = stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.5;
  if (ends.length === 0) { const stub = CELL_SIZE * 0.22; ctx.beginPath(); ctx.moveTo(cx, cy - stub); ctx.lineTo(cx, cy + stub); ctx.stroke(); } else for (const end of ends) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(end.x, end.y); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, cy, 2.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

export function drawStairLine(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, strokeOverride?: string): void {
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; const px = x + CELL_SIZE * 0.78; const treadW = CELL_SIZE * 0.16; ctx.strokeStyle = strokeOverride ?? colors.infraStair; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, y + 1); ctx.lineTo(px, y + CELL_SIZE - 1); ctx.stroke(); ctx.lineWidth = 1.5;
  for (let i = 1; i <= 3; i++) { const ty = y + (CELL_SIZE * i) / 4; ctx.beginPath(); ctx.moveTo(px - treadW, ty); ctx.lineTo(px, ty); ctx.stroke(); } ctx.restore();
}

export function drawElevatorShaft(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, strokeOverride?: string, showCar = false): void {
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'butt'; ctx.strokeStyle = strokeOverride ?? colors.infraElevator; ctx.lineWidth = 2; const left = x + CELL_SIZE * 0.28; const right = x + CELL_SIZE * 0.72; ctx.beginPath(); ctx.moveTo(left, y + 1); ctx.lineTo(left, y + CELL_SIZE - 1); ctx.moveTo(right, y + 1); ctx.lineTo(right, y + CELL_SIZE - 1); ctx.stroke();
  if (showCar) { ctx.fillStyle = strokeOverride ?? colors.infraElevator; const pad = CELL_SIZE * 0.08; ctx.fillRect(left + pad, y + CELL_SIZE * 0.55, right - left - pad * 2, CELL_SIZE * 0.28); } ctx.restore();
}
