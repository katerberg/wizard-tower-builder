import type { GameState } from '@/model/types';
import type { ModalData, ViewState } from './intents';

/**
 * If leaving the research modal, restore the sim speed it paused.
 * Call before replacing or clearing `view.modal` when it might be research.
 */
export function releaseResearchSimPause(view: ViewState, game: GameState): void {
  if (view.modal?.kind !== 'research') return;
  if (view.researchResumeSimSpeed != null) {
    game.simSpeed = view.researchResumeSimSpeed;
    view.researchResumeSimSpeed = null;
  }
}

/** Open the research DAG and pause sim until the modal closes. */
export function openResearchModal(view: ViewState, game: GameState): void {
  if (game.scene !== 'run' || game.phase !== 'day') return;
  if (view.modal?.kind !== 'research') {
    view.researchResumeSimSpeed = game.simSpeed;
    game.simSpeed = 0;
  }
  view.modal = { kind: 'research' };
}

/** Set modal, restoring research pause when leaving research. */
export function setModal(view: ViewState, game: GameState, modal: ModalData | null): void {
  if (view.modal?.kind === 'research' && modal?.kind !== 'research') {
    releaseResearchSimPause(view, game);
  }
  view.modal = modal;
}

/** Clears build UI and combat targeting — used when entering/exiting attack. */
export function resetToSelectMode(view: ViewState, game: GameState): void {
  releaseResearchSimPause(view, game);
  view.selectedBlueprintId = null;
  view.selectedSpellId = null;
  view.castAnchor = null;
  view.modal = null;
}

/** Strips build-only UI that must not appear during attack. */
export function clearBuildUi(view: ViewState, game: GameState): void {
  releaseResearchSimPause(view, game);
  view.selectedBlueprintId = null;
  view.modal = null;
}
