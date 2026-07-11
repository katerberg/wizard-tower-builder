import type { ViewState } from './intents';

/** Clears build UI and combat targeting — used when entering/exiting attack. */
export function resetToSelectMode(view: ViewState): void {
  view.selectedBlueprintId = null;
  view.selectedSpellId = null;
  view.castAnchor = null;
  view.modal = null;
}

/** Strips build-only UI that must not appear during attack. */
export function clearBuildUi(view: ViewState): void {
  view.selectedBlueprintId = null;
  view.modal = null;
}
