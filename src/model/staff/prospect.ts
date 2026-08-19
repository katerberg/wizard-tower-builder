import { getProspectWorkTime } from '../mines/generate';
import { resolveProspect } from './harvest';
import type { GameState } from '../types';

/** Resolve prospect tier reveal at nightfall if day work completed. */
export function resolveProspectAtNightfall(state: GameState): void {
  if (state.prospectAllocation <= 0 || state.prospectResolved) return;
  const workTime = getProspectWorkTime(state.mine.unlockedDepth);
  if (state.prospectWorkElapsed >= workTime) {
    resolveProspect(state);
    state.prospectResolved = true;
  }
}

/** Advance prospect work during day ticks (prospectors path during day). */
export function tickProspectWork(state: GameState, dt: number): void {
  if (state.phase !== 'day') return;
  if (state.prospectAllocation <= 0 || state.prospectResolved) return;
  const prospectors = state.staff.filter(
    (s) => s.kind === 'laborer' && s.targetWorkplaceId === 'mine:prospect' && s.status === 'working',
  );
  if (prospectors.length > 0) {
    state.prospectWorkElapsed += dt;
  }
}
