import type { Cell } from '@/model/types';

export type Intent =
  | { type: 'beginRun' }
  | { type: 'selectBlueprint'; blueprintId: string | null }
  | { type: 'hoverCell'; cell: Cell | null }
  | { type: 'placeSelectedAt'; cell: Cell }
  | { type: 'removeRoomAt'; cell: Cell }
  | { type: 'inspectRoomAt'; cell: Cell }
  | { type: 'addModification'; roomId: string; modId: string }
  | { type: 'upgradeModification'; roomId: string; modId: string }
  | { type: 'sellRoom'; roomId: string }
  | { type: 'closeModal' }
  | { type: 'startWave' }
  | { type: 'restart' }
  | { type: 'toggleDevMode' }
  | { type: 'devAddCurrency' }
  | { type: 'devSkipWave' }
  | { type: 'scrollCamera'; deltaY: number }
  | { type: 'setViewportHeight'; height: number }
  | { type: 'undoBuild' }
  | { type: 'revertBuild' }
  | { type: 'selectSpell'; spellId: string | null }
  | { type: 'castSpellAt'; spellId: string; cell: Cell }
  | { type: 'cancelCast' };

export type ModalData = { kind: 'room'; roomId: string } | { kind: 'help' };

export interface ViewState {
  selectedBlueprintId: string | null;
  selectedSpellId: string | null;
  hoveredCell: Cell | null;
  modal: ModalData | null;
  /** Pixels scrolled upward from ground (viewport camera). */
  cameraScrollY: number;
  /** Canvas height in pixels (snapped to whole cell rows). */
  viewportHeight: number;
}
