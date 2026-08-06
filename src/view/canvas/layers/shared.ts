import { colors } from '@/view/theme';
import type { PipeFluid } from '@/model/pipes';

export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  ratio: number,
): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = colors.hpBarBg;
  ctx.fillRect(x, y, width, 4);
  ctx.fillStyle = colors.hpBar;
  ctx.fillRect(x, y, width * clamped, 4);
}

export function pipeFluidColor(fluid: PipeFluid): string {
  if (fluid === 'water') return colors.infraPipe;
  if (fluid === 'steam') return colors.infraPipeSteam;
  if (fluid === 'fire') return colors.infraPipeFire;
  return colors.infraPipeDry;
}
