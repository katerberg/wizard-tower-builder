import type { Cell } from '@/model/types';

export type Intent =
  | { type: 'beginRun' }
  | { type: 'selectBlueprint'; blueprintId: string }
  | { type: 'hoverCell'; cell: Cell | null }
  | { type: 'placeSelectedAt'; cell: Cell }
  | { type: 'removeRoomAt'; cell: Cell }
  | { type: 'inspectRoomAt'; cell: Cell }
  | { type: 'closeModal' }
  | { type: 'startWave' }
  | { type: 'restart' }
  | { type: 'toggleDevMode' }
  | { type: 'devAddCurrency' }
  | { type: 'devSkipWave' };

export type ModalData = { kind: 'room'; roomId: string } | { kind: 'help' };

export type ViewState = {
  selectedBlueprintId: string | null;
  hoveredCell: Cell | null;
  modal: ModalData | null;
};
