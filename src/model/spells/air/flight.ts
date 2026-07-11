import { isWalkable } from '../../../calculations/exteriorGraph';
import { getWizardPosition } from '../../tower';
import type { ExteriorNode, GameState } from '../../types';

export function getEffectiveWizardPosition(state: GameState): ExteriorNode {
  if (state.wizardFlight) {
    return state.wizardFlight.pos;
  }
  return getWizardPosition(state.tower);
}

export function startFlight(state: GameState, ascentSubRows: number): void {
  const perch = getWizardPosition(state.tower);
  state.wizardFlight = {
    pos: { ...perch, row: perch.row + ascentSubRows },
    until: state.waveTimer + 0, // set by caller with duration
    descending: false,
  };
}

export function tickWizardFlight(state: GameState, dt: number, duration: number): void {
  if (!state.wizardFlight) return;

  if (!state.wizardFlight.descending) {
    if (state.wizardFlight.until <= 0) {
      state.wizardFlight.until = state.waveTimer + duration;
    }
    if (state.waveTimer < state.wizardFlight.until) return;
    state.wizardFlight.descending = true;
  }

  state.wizardFlight.descendTimer = (state.wizardFlight.descendTimer ?? 0) + dt;
  if (state.wizardFlight.descendTimer < 0.12) return;
  state.wizardFlight.descendTimer = 0;

  const below: ExteriorNode = {
    ...state.wizardFlight.pos,
    row: state.wizardFlight.pos.row - 1,
  };

  const profile = {
    kind: 'under_overhang' as const,
    canPassUnderOverhang: true,
    canAttackOverhang: false,
    canFly: false,
    canTransferFaces: false,
  };

  if (isWalkable(state.tower, below.col, below.row, profile) || below.row === 0) {
    state.wizardFlight.pos = below;
    if (isWalkable(state.tower, below.col, below.row, profile)) {
      delete state.wizardFlight;
    }
    return;
  }

  state.wizardFlight.pos = below;
}

export function clearWizardFlight(state: GameState): void {
  delete state.wizardFlight;
}
