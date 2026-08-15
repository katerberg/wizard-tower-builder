import type { Cell, Resources, SimSpeed } from '@/model/types';

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
  | { type: 'sellShell'; col: number; row: number }
  | { type: 'recruitStaff'; housingRoomId: string }
  | { type: 'unrecruitStaff'; housingRoomId: string }
  | { type: 'setSlotAllocation'; slotRoomId: string; count: number }
  | { type: 'setManaSpringAllocation'; springRoomId: string; count: number }
  | { type: 'setResearchAllocation'; researchRoomId: string; count: number }
  | { type: 'startResearch'; nodeId: string }
  | { type: 'enqueueResearch'; nodeId: string }
  | { type: 'dequeueResearch'; nodeId: string }
  | { type: 'cancelResearch' }
  | { type: 'openResearchModal' }
  | { type: 'selectResearchNode'; nodeId: string | null }
  | { type: 'toggleResearchGroup'; groupId: string }
  | { type: 'devUnlockResearch'; nodeId: string }
  | { type: 'toggleLayer'; layer: TowerLayer }
  | { type: 'closeModal' }
  | { type: 'startWave' }
  | { type: 'restart' }
  | { type: 'toggleDevMode' }
  | { type: 'devAddCurrency' }
  | { type: 'devSkipWave' }
  | { type: 'devUnlockAll' }
  | { type: 'devSetSpellSchool'; school: 'fire' | 'air' | 'earth' | 'water' }
  | { type: 'toggleWaveBuilder' }
  | { type: 'devSetWaveCount'; templateId: string; count: number }
  | { type: 'devClearWaveBuilder' }
  | { type: 'devLoadCurrentWave' }
  | { type: 'scrollCamera'; deltaY: number }
  | { type: 'setViewportHeight'; height: number }
  | { type: 'undoBuild' }
  | { type: 'revertBuild' }
  | { type: 'selectSpell'; spellId: string | null }
  | { type: 'castSpellAt'; spellId: string; cell: Cell }
  | { type: 'cancelCast' }
  | { type: 'setSimSpeed'; speed: SimSpeed };

export type ModalData =
  | { kind: 'room'; roomId: string }
  | { kind: 'structure'; structureId: string }
  | { kind: 'research' }
  | { kind: 'help' }
  | { kind: 'waveClear'; gold: number; haul: Resources };

export interface WaveBuilderState {
  open: boolean;
  /** templateId → count for the custom wave draft. */
  counts: Record<string, number>;
}

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
  /** Dev-only custom wave draft; Start Wave uses it while open. */
  waveBuilder: WaveBuilderState;
  /** Selected node in the research DAG modal. */
  selectedResearchNodeId: string | null;
  /** Expanded expansion-group ids in the research DAG (collapsed by default). */
  researchExpandedGroupIds: string[];
}
