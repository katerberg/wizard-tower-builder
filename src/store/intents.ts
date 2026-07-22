import type { Cell } from '@/model/types';

export type TowerLayer = 'rooms' | 'infra' | 'workers';

export type Intent =
  | { type: 'beginRun' }
  | { type: 'selectBlueprint'; blueprintId: string | null }
  | { type: 'hoverCell'; cell: Cell | null }
  | { type: 'placeSelectedAt'; cell: Cell }
  | { type: 'removeRoomAt'; cell: Cell }
  | { type: 'removeInfraAt'; cell: Cell }
  | { type: 'inspectRoomAt'; cell: Cell }
  | { type: 'addModification'; roomId: string; modId: string }
  | { type: 'upgradeModification'; roomId: string; modId: string }
  | { type: 'sellRoom'; roomId: string }
  | { type: 'sellStructure'; structureId: string }
  | { type: 'recruitStaff'; housingRoomId: string }
  | { type: 'unrecruitStaff'; housingRoomId: string }
  | { type: 'setSlotAllocation'; slotRoomId: string; count: number }
  | { type: 'setManaSpringAllocation'; springRoomId: string; count: number }
  | { type: 'toggleLayer'; layer: TowerLayer }
  | { type: 'closeModal' }
  | { type: 'startWave' }
  | { type: 'restart' }
  | { type: 'toggleDevMode' }
  | { type: 'devAddCurrency' }
  | { type: 'devSkipWave' }
  | { type: 'devSetSpellSchool'; school: 'fire' | 'air' | 'earth' }
  | { type: 'scrollCamera'; deltaY: number }
  | { type: 'setViewportHeight'; height: number }
  | { type: 'undoBuild' }
  | { type: 'revertBuild' }
  | { type: 'selectSpell'; spellId: string | null }
  | { type: 'castSpellAt'; spellId: string; cell: Cell }
  | { type: 'cancelCast' }
  | { type: 'setSimSpeed'; speed: 1 | 2 | 4 };

export type ModalData =
  | { kind: 'room'; roomId: string }
  | { kind: 'structure'; structureId: string }
  | { kind: 'help' };

export interface ViewState {
  selectedBlueprintId: string | null;
  selectedSpellId: string | null;
  hoveredCell: Cell | null;
  /** First click for Wall of Flame A→B targeting. */
  castAnchor: Cell | null;
  modal: ModalData | null;
  /** Pixels scrolled upward from ground (viewport camera). */
  cameraScrollY: number;
  /** Canvas height in pixels (snapped to whole cell rows). */
  viewportHeight: number;
  layerVisibility: Record<TowerLayer, boolean>;
  /** Slot room id highlighted for connectivity (hover/inspect). */
  connectivityFocusSlotId: string | null;
}
