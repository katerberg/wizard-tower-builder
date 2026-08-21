import type { PlayerResearchState } from './research/types';

export interface Cell { col: number; row: number }

export interface Modifier { attack?: number; defense?: number; hp?: number }

export type BlueprintCategory = 'structure' | 'room' | 'infra' | 'fortification';

export type InfraKind = 'stair' | 'pipe' | 'elevator';

/** Exterior shell fortification kinds (framing-cell attachments). */
export type FortificationId =
  | 'moat'
  | 'glacis'
  | 'parapet'
  | 'cornice'
  | 'stakes'
  | 'barbican';

export interface ShellCell {
  kind: FortificationId;
}

export type Fluid = 'water' | 'steam' | 'fire' | 'unassigned';

export type HousingKind = 'guardroom' | 'chamber' | 'quarters';
export type StaffKind = 'soldier' | 'mage' | 'laborer';

export type ResourceId = 'gold' | 'metal' | 'stone' | 'souls';

/** Full wallet / cost bag. Missing keys on Partial costs are treated as 0. */
export interface Resources {
  gold: number;
  metal: number;
  stone: number;
  souls: number;
}

export type ResourceCost = Partial<Resources>;

export interface Blueprint {
  id: string;
  name: string;
  glyph: string;
  color: string;
  size: { w: number; h: number };
  cost: ResourceCost;
  baseHp: number;
  description: string;
  category?: BlueprintCategory;
  infraKind?: InfraKind;
  /** Staff may path through this room when true (default). Ignored on structure blueprints. */
  passable?: boolean;
  /** When set, this blueprint is housing for the matching staff kind. */
  housing?: HousingKind;
}

export interface InfraCell {
  kind: InfraKind;
  /** Locked at wave start; live preview ignores this during build. */
  fluid?: Fluid;
}

/** A modification instance attached to a room (one per type, leveled in place). */
export interface RoomModification { id: string; level: number }

/** Load-bearing framing piece (spire block). */
export interface Structure {
  id: string;
  blueprintId: string;
  origin: Cell;
  size: { w: number; h: number };
  hp: number;
}

export interface Room {
  id: string;
  blueprintId: string;
  origin: Cell;
  size: { w: number; h: number };
  modifications: RoomModification[];
  hp: number;
}

export interface RoomStats { maxHp: number; attack: number; defense: number }

/** Max HP for structure pieces (no room modifications). */
export interface StructureStats { maxHp: number }

export interface Tower {
  /** Load-bearing framing (spire blocks). */
  structures: Structure[];
  /** cellKey → structureId */
  structureOccupancy: Record<string, string>;
  /** Functional rooms overlaid on structure. */
  rooms: Room[];
  /** cellKey → roomId */
  occupancy: Record<string, string>;
  /** Per-cell infrastructure overlay (stair, pipe, or elevator — never two). */
  infra: Record<string, InfraCell>;
  /** Per framing cell shell fortification (at most one kind). */
  shell: Record<string, ShellCell>;
}

export type StaffStatus =
  | 'idle'
  | 'moving'
  | 'stationed'
  | 'working'
  | 'waiting_elevator'
  | 'riding_elevator';

export interface StaffUnit {
  id: string;
  kind: StaffKind;
  homeHousingId: string;
  /** Slot, mana spring, damaged room/structure id, hand-pump, or mine patch id. */
  targetWorkplaceId: string | null;
  pos: Cell;
  path: Cell[];
  pathIndex: number;
  moveCooldown: number;
  status: StaffStatus;
  /** Shaft being waited on / ridden (elevator statuses). */
  elevatorShaftId?: string;
  /** Exit row within the shaft for the current ride. */
  elevatorExitRow?: number;
  /** Path index of the exit cell once unloaded. */
  elevatorExitPathIndex?: number;
  /** Storage room id when hauling materials. */
  carry?: Stockpile;
  /** Storage room id for pickup target. */
  carryFromStorageId?: string;
  /** Construction order id when hauling to/from site. */
  carryOrderId?: string;
  /** Seconds spent waiting for a car (call priority tie-break). */
  elevatorWaitElapsed?: number;
}

export type ElevatorDir = 'up' | 'down' | 'idle';

/** Contiguous vertical run of elevator infra in one column. */
export interface ElevatorShaft {
  id: string;
  col: number;
  minRow: number;
  maxRow: number;
}

/** Attack-phase elevator car (one per shaft). */
export interface ElevatorCar {
  shaftId: string;
  col: number;
  row: number;
  dir: ElevatorDir;
  /** Staff ids currently riding. */
  passengers: string[];
  moveCooldown: number;
  /** Floor the car is traveling toward (empty call or next stop). */
  targetRow: number | null;
}

/** @deprecated Prefer StaffUnit. */
export type Soldier = StaffUnit;
/** @deprecated Prefer StaffStatus. */
export type SoldierStatus = StaffStatus;

/** Physical resources held in storage rooms (stone + metal). */
export interface Stockpile {
  stone: number;
  metal: number;
}

export interface StorageSite {
  roomId: string;
  stockpile: Stockpile;
  /** Flat cap on stone + metal combined. */
  capacity: number;
  /** Starter supply — cannot be sold. */
  locked: boolean;
}

export interface StorageReservation {
  orderId: string;
  storageRoomId: string;
  reserved: Stockpile;
}

export type ConstructionKind = 'build' | 'teardown';

export type ConstructionStatus =
  | 'planned'
  | 'delivering'
  | 'scaffold'
  | 'building'
  | 'teardown';

export interface ConstructionOrder {
  id: string;
  kind: ConstructionKind;
  blueprintId: string;
  origin: Cell;
  /** Existing room/structure id when tearing down or replacing. */
  targetId?: string;
  status: ConstructionStatus;
  /** Materials still needed on-site before build timer starts. */
  deliverRemaining: Stockpile;
  onSiteMaterials: Stockpile;
  /** 0..1 after all materials delivered. */
  buildProgress: number;
  /** Total work units (footprint cells × BUILD_WORK_PER_CELL). */
  buildWorkRequired: number;
  /** Reserved souls (deducted from wallet at paint time). */
  soulsReserved: number;
}

export type SideJobKind = 'recruit' | 'unrecruit' | 'applyMod' | 'researchEnqueue';

export interface SideJob {
  id: string;
  kind: SideJobKind;
  label: string;
  duration: number;
  elapsed: number;
  payload: Record<string, unknown>;
  status: 'running' | 'success';
}

/** @deprecated Build baseline removed — use storage reservations. */
export interface BuildBaseline {
  tower: Tower;
  resources: Resources;
  housingRecruited: Record<string, number>;
  slotAllocations: Record<string, number>;
  manaSpringAllocations: Record<string, number>;
  researchRoomAllocations: Record<string, number>;
  prospectAllocation: number;
}

/** One undo frame for tower layout + draft staff economy. */
export interface BuildDraftSnapshot {
  tower: Tower;
  housingRecruited: Record<string, number>;
  slotAllocations: Record<string, number>;
  manaSpringAllocations: Record<string, number>;
  researchRoomAllocations: Record<string, number>;
  leylineResearchAllocations: Record<string, number>;
  pendingRecruitSpend: number;
  prospectAllocation: number;
}

export interface Wizard {
  glyph: string;
  // Wand Strike / combat stats. Lose-condition HP is on SolarCollector.
  attack: number;
  defense: number;
  dexterity: number;
  range: number;
  attackCooldown: number;
}

/** Crown objective — enemies path here; Fortify mitigates its damage. */
export interface SolarCollector {
  hp: number;
  maxHp: number;
  glyph: string;
}

export type WizardMoveStatus =
  | 'idle'
  | 'moving'
  | 'waiting_elevator'
  | 'riding_elevator'
  | 'flying'
  | 'falling';

/** Player firefighter avatar — distinct from staff; never an enemy melee target. */
export interface WizardAvatar {
  /** Sub-cell position (`face: 'air'` while flying). */
  pos: ExteriorNode;
  /** Expanded sub-cell waypoints for the current grounded / air path. */
  path: ExteriorNode[];
  pathIndex: number;
  /** Macro cells used for elevator planning and repath. */
  macroPath: Cell[];
  macroPathIndex: number;
  moveCooldown: number;
  status: WizardMoveStatus;
  elevatorShaftId?: string;
  elevatorExitRow?: number;
  elevatorExitMacroIndex?: number;
  elevatorWaitElapsed?: number;
}

export type ExteriorFace = 'left' | 'right' | 'top' | 'air';

export interface ExteriorNode { col: number; row: number; face: ExteriorFace }

export type MovementKind = 'under_overhang' | 'surface_climb' | 'attack_overhang' | 'fly' | 'face_transfer';

export interface MovementProfile {
  kind: MovementKind;
  canPassUnderOverhang: boolean;
  canAttackOverhang: boolean;
  canFly: boolean;
  canTransferFaces: boolean;
}

export type EnemySizeTier = 'small' | 'medium' | 'large';

export interface EnemyTemplate {
  id: string;
  type: string;
  glyph: string;
  color: string;
  stats: { strength: number; dexterity: number; maxHp: number };
  speed: number;
  /** Souls granted when this enemy is killed. */
  soulsReward: number;
  movement: MovementProfile;
  sizeTier: EnemySizeTier;
  /** Contact attack then self-remove (kamikaze). */
  kamikaze?: boolean;
  /** Hover off-tower and launch weaker kamikazes. */
  carrier?: boolean;
  dropChance?: number;
  dropItemId?: string;
}

export interface Enemy {
  id: string;
  templateId: string;
  name: string;
  pos: ExteriorNode;
  path: ExteriorNode[];
  pathIndex: number;
  currentHp: number;
  moveCooldown: number;
  attackCooldown: number;
  /** Fire school: Kindled mark expires at this waveTimer. */
  kindledUntil?: number;
  /** Fire school: Immolate burn expires at this waveTimer. */
  immolateUntil?: number;
  /** Cells traveled on wall while Immolating (macro cells, for ramp). */
  immolateDistanceBurned?: number;
  immolateTickTimer?: number;
  /** Last macro cell counted toward Immolate ramp. */
  immolateLastMacroKey?: string;
  /** Wall of Flame segment keys the enemy is currently inside. */
  wallFlameInside?: string[];
  /** Air school: permanent attachment tax. */
  discombobulated?: boolean;
  /** Next attachment transition is allowed through. */
  discombobulatedAttachReady?: boolean;
  /** Falling after detach. */
  airborne?: boolean;
  /** Sub-row where the enemy was knocked loose. */
  airborneFromRow?: number;
  fallSubRows?: number;
  airborneTimer?: number;
  /** Tornado segment keys inside. */
  tornadoInside?: string[];
  /** Carrier-launched kamikazes: macro cells traveled before self-destruct. */
  lifetimeMacroCells?: number;
  /** Macro cells moved since spawn (carrier kamikaze leash). */
  macroCellsMoved?: number;
  lastMacroKey?: string;
  /** Carrier launch cooldown accumulator. */
  carrierLaunchTimer?: number;
  /** Last solar-collector perch macro key used for repath (`col,row`). */
  pathGoalKey?: string;
  /** Water school: Soak stacks (0–100). Slow only — no inherent damage. */
  soak?: number;
  /** Seconds until next Soak half-life tick. */
  soakHalfLifeTimer?: number;
  /** Deadweight: fake Soak for speed math only. */
  deadweightSoakBonus?: number;
  /** waveTimer when Deadweight fake Soak ends. */
  deadweightUntil?: number;
}

export type GameMessageKind = 'info' | 'combat' | 'economy';

export interface GameMessage { text: string; kind: GameMessageKind }

export interface Player {
  resources: Resources;
  unlockedBlueprints: string[];
  /** Modification ids the player may apply (research-gated expansions). */
  unlockedModifications: string[];
  research: PlayerResearchState;
  levelIndex: number;
  wizard: Wizard;
  mana: number;
  maxMana: number;
}

export type ProgressionMode = 'height' | 'branching';

export type Phase = 'day' | 'night';

export type Scene = 'menu' | 'run' | 'gameOver' | 'victory';

export interface KindlingPatch {
  col: number;
  row: number;
  expiresAt: number;
}

export interface WallOfFlameSegment {
  cells: Cell[];
  /** Tower face, or `air` for open-air lanes. */
  face: ExteriorFace;
  expiresAt: number;
  tickTimer: number;
}

export interface TornadoSegment {
  macroCells: Cell[];
  expiresAt: number;
  tickTimer: number;
}

export interface BlizzardZone {
  center: Cell;
  radius: number;
  expiresAt: number;
  tickTimer: number;
}

/** Flight spell timer — position lives on WizardAvatar. */
export interface WizardFlight {
  until: number;
}

/** Earth school — Fault trap (Charge per pass). */
export interface FaultPatch {
  col: number;
  row: number;
  expiresAt: number;
}

/** Earth school — pending Boulder projectile. */
export interface PendingBoulder {
  aimCol: number;
  aimRow: number;
  chargeSpent: number;
  impactAt: number;
  phase: 'aimed' | 'falling';
  col: number;
  row: number;
  fallDir?: number;
  nextFallAt?: number;
}

/** Water school — exterior wetness (combat, not pipe fluid). */
export interface WetCell {
  col: number;
  row: number;
  kind: 'sheet' | 'puddle';
  /** Seconds remaining before this wetness dissipates. */
  lifetime: number;
  /** Accumulator toward the next sheet flow step (sheets only). */
  flowAcc?: number;
  /**
   * Pinned waterfall stream cell — owned by `ActiveWaterfall`, not hydrant flow.
   * Skipped by wet-cell drip / evaporation.
   */
  stream?: boolean;
}

/** Water school — cascading waterfall column (grows down, then fades from top). */
export interface ActiveWaterfall {
  col: number;
  /** Macro rows from cast start down to stop (high → low). */
  rows: number[];
  /** Inclusive index of the lowest wet cell. */
  front: number;
  /** Inclusive index of the highest still-wet cell (rises while fading). */
  top: number;
  phase: 'growing' | 'fading';
  flowAcc: number;
}

export type SpellSchool = 'fire' | 'air' | 'earth' | 'water';

export const SIM_SPEEDS = [0, 1, 2, 5] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number];

export function isSimSpeed(value: number): value is SimSpeed {
  return (SIM_SPEEDS as readonly number[]).includes(value);
}

export interface GameState {
  scene: Scene;
  phase: Phase;
  /** The seed this session was created with (for fixture diffing). */
  sessionSeed: string | number;
  progressionMode: ProgressionMode;
  /** Wave counter within the run (not the win condition). */
  levelIndex: number;
  waveIndex: number;
  waveTimer: number;
  spawnTimer: number;
  spawnQueue: string[];
  /**
   * Framing height (`maxOccupiedRow`) snapshotted at Start Wave.
   * Locks difficulty / flier bands for the attack; win checks live height at clear.
   */
  waveStartHeight: number;
  /** Enemy template ids permanently unlocked this run (thresholds crossed at wave start). */
  unlockedEnemyIds: string[];
  /** Simulation speed multiplier during attack (1 = normal). */
  simSpeed: SimSpeed;
  player: Player;
  tower: Tower;
  enemies: Enemy[];
  messages: GameMessage[];
  rngState: number;
  devMode: boolean;
  roomEffectTimers: Record<string, number>;
  /** Attack-phase staff entities (cleared at wave end; rosters persist). */
  staff: StaffUnit[];
  /** Recruited count per housing room (day phase). */
  housingRecruited: Record<string, number>;
  /** Headcount allocated per slot room for the upcoming night (day phase). */
  slotAllocations: Record<string, number>;
  /** Desired magi headcount per mana spring (0..MANA_SPRING_STAFF_CAPACITY). */
  manaSpringAllocations: Record<string, number>;
  /** Desired magi headcount per research room. */
  researchRoomAllocations: Record<string, number>;
  /** Desired magi headcount per Leyline Research room (cap 1). */
  leylineResearchAllocations: Record<string, number>;
  /**
   * Leyline ritual tiers 2–4 completed this run (tier 1 is the starter spell).
   * Spell stays on the hotbar only while a matching band room exists.
   */
  leylineCompletedTiers: Record<2 | 3 | 4, boolean>;
  /** Laborers assigned to prospecting (day work; excluded from night harvest/repair). */
  prospectAllocation: number;
  /** 1-based day counter; increments at each dawn. */
  dayIndex: number;
  /** Seconds remaining in the current day or night phase. */
  phaseTimer: number;
  /** When true, phase timer does not decrement. */
  phasePaused: boolean;
  /** Stockpiles keyed by storage room id. */
  storageSites: Record<string, StorageSite>;
  /** Materials reserved from storage for construction orders. */
  storageReservations: StorageReservation[];
  /** Active construction / teardown orders (persist across days). */
  constructionOrders: ConstructionOrder[];
  /** Timed non-tower jobs (recruit, mods, research queue). */
  sideJobs: SideJob[];
  /** Gold spent recruiting staff this day (commits at night deploy). */
  pendingRecruitSpend: number;
  /** Seconds remaining before each spell can be cast again. */
  spellCooldowns: Record<string, number>;
  /** Active Kindling trap patches (fire school). */
  kindlingPatches: KindlingPatch[];
  /** Timed Wall of Flame damage zones. */
  wallOfFlameSegments: WallOfFlameSegment[];
  /** Tracks enter-damage already dealt per segment+entity. */
  fireEnterDone: Record<string, true>;
  /** Air school: blocking tornado lanes. */
  tornadoSegments: TornadoSegment[];
  /** Air school: slowing blizzard zones. */
  blizzardZones: BlizzardZone[];
  tornadoEnterDone: Record<string, true>;
  wizardFlight?: WizardFlight;
  /** Mobile wizard avatar (firefighter). */
  wizardAvatar: WizardAvatar;
  /** Crown lose-condition objective. */
  solarCollector: SolarCollector;
  /** Earth school — Charge meter (0…max). */
  earthCharge: number;
  /** Earth school — Fault patches. */
  faultPatches: FaultPatch[];
  /** Earth school — Fortify concentration. */
  fortified: boolean;
  fortifyChargeAccum: number;
  /** Earth school — in-flight boulders. */
  pendingBoulders: PendingBoulder[];
  /** Water school — exterior sheets and puddles. */
  wetCells: WetCell[];
  /** Water school — active cascading waterfall streams. */
  activeWaterfalls: ActiveWaterfall[];
  /** Water school — Hydrant spray cooldown per room id. */
  hydrantSprayTimers: Record<string, number>;
  /** Dev playtest: which spell kit is on the hotbar. */
  activeSpellSchool: SpellSchool;
  /** Attack-phase boiler production state. */
  boilerRuntime: Record<string, BoilerRuntime>;
  /** Attack-phase steam turret charge state. */
  steamTurretRuntime: Record<string, SteamTurretRuntime>;
  /** Attack-phase flame turret charge state. */
  flameTurretRuntime: Record<string, FlameTurretRuntime>;
  /** Attack-phase magic turret depower state. */
  turretRuntime: Record<string, TurretRuntime>;
  /** Attack-phase elevator cars (one per shaft; cleared at wave end). */
  elevators: ElevatorCar[];
  /**
   * Deterministic underground mine for the run (tunnels + patches).
   * Not part of tower mass / height; laborers path here during attack.
   */
  mine: MineState;
  /** Resources harvested this attack (reset at wave start). */
  waveHaul: Resources;
  /**
   * Set at wave clear for the haul summary modal; cleared when the modal closes.
   * Null while attacking or after dismiss.
   */
  pendingWaveClear: WaveClearSummary | null;
  /** Seconds accumulated on the prospect job (day work; resolves at nightfall). */
  prospectWorkElapsed: number;
  /** True once the prospect job has been resolved this cycle (tier revealed). */
  prospectResolved: boolean;
}

/** Wave-clear economy beat shown in a modal (gold payroll + mine haul). */
export interface WaveClearSummary {
  gold: number;
  haul: Resources;
  /** Prospecting result note (null when no prospecting occurred this wave). */
  prospectNote: string | null;
}

/** Finite harvest patch inside the invisible mine grid. */
export interface MinePatch {
  id: string;
  cell: Cell;
  resource: 'stone' | 'metal' | 'gold';
  remaining: number;
}

/** Run-persistent underground geography (see docs/MINES.md). */
export interface MineState {
  /** First underground cell; ortho-adjacent to ground framing above. */
  entrance: Cell;
  /** Walkable tunnel cells (`cellKey` → true), including entrance and patches. */
  tunnels: Record<string, true>;
  patches: MinePatch[];
  /** Highest revealed depth index (shallow = 1; incremented by prospecting). */
  unlockedDepth: number;
}

export interface BoilerRuntime {
  producing: boolean;
  steamAvailable: boolean;
}

export interface SteamTurretRuntime {
  charge: number;
  chargeRate: number;
}

export interface FlameTurretRuntime {
  charge: number;
  chargeRate: number;
}

export interface TurretRuntime {
  depowered: boolean;
}

export type PlacementReason =
  | 'ok'
  | 'out_of_bounds'
  | 'overlap'
  | 'no_support'
  | 'overhang_too_far'
  | 'disconnected'
  | 'fluid_mix'
  | 'boiler_footprint'
  | 'no_framing'
  | 'not_exterior'
  | 'wrong_face'
  | 'leyline_band_required'
  | 'leyline_band_taken'
  | 'leyline_tier_locked';

export interface PlacementResult { ok: boolean; reason: PlacementReason }
