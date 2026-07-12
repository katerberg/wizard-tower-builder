export interface Cell { col: number; row: number }

export interface Modifier { attack?: number; defense?: number; hp?: number }

export type BlueprintCategory = 'structure' | 'infra';

export type InfraKind = 'stair' | 'pipe';

export type Fluid = 'water' | 'steam' | 'unassigned';

export interface Blueprint {
  id: string;
  name: string;
  glyph: string;
  color: string;
  size: { w: number; h: number };
  cost: number;
  baseHp: number;
  description: string;
  category?: BlueprintCategory;
  infraKind?: InfraKind;
  /** Soldiers may path through structure cells when true (default). */
  passable?: boolean;
}

export interface InfraCell {
  kind: InfraKind;
  /** Locked at wave start; live preview ignores this during build. */
  fluid?: Fluid;
}

/** A modification instance attached to a room (one per type, leveled in place). */
export interface RoomModification { id: string; level: number }

export interface Room {
  id: string;
  blueprintId: string;
  origin: Cell;
  size: { w: number; h: number };
  modifications: RoomModification[];
  hp: number;
}

export interface RoomStats { maxHp: number; attack: number; defense: number }

export interface Tower {
  rooms: Room[];
  occupancy: Record<string, string>;
  /** Per-cell infrastructure overlay (stair or pipe, never both). */
  infra: Record<string, InfraCell>;
}

export type SoldierStatus = 'moving' | 'stationed';

export interface Soldier {
  id: string;
  homeBarracksId: string;
  targetSlotId: string;
  pos: Cell;
  path: Cell[];
  pathIndex: number;
  moveCooldown: number;
  status: SoldierStatus;
  /** Column locked while traversing stairs vertically. */
  stairColumn: number | null;
}

/** Snapshot of tower + gold at the start of a build phase (planning baseline). */
export interface BuildBaseline { tower: Tower; currency: number }

export interface Wizard {
  hp: number;
  maxHp: number;
  glyph: string;
  // v1 defense: wizard auto-attacks; dedicated turret rooms also fire via roomBehaviors.
  attack: number;
  defense: number;
  dexterity: number;
  range: number;
  attackCooldown: number;
}

export type ExteriorFace = 'left' | 'right' | 'top';

export interface ExteriorNode { col: number; row: number; face: ExteriorFace }

export type MovementKind = 'under_overhang' | 'surface_climb' | 'attack_overhang' | 'fly' | 'face_transfer';

export interface MovementProfile {
  kind: MovementKind;
  canPassUnderOverhang: boolean;
  canAttackOverhang: boolean;
  canFly: boolean;
  canTransferFaces: boolean;
}

export type EnemySizeTier = 'swarm' | 'elite' | 'boss';

export interface EnemyTemplate {
  id: string;
  type: string;
  glyph: string;
  color: string;
  stats: { strength: number; dexterity: number; maxHp: number };
  speed: number;
  currencyReward: number;
  movement: MovementProfile;
  sizeTier: EnemySizeTier;
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
}

export type GameMessageKind = 'info' | 'combat' | 'economy';

export interface GameMessage { text: string; kind: GameMessageKind }

export interface Player {
  currency: number;
  unlockedBlueprints: string[];
  levelIndex: number;
  wizard: Wizard;
  mana: number;
  maxMana: number;
}

export type ProgressionMode = 'linear' | 'branching';

export type Phase = 'build' | 'attack';

export type Scene = 'menu' | 'run' | 'gameOver' | 'victory';

export interface KindlingPatch {
  col: number;
  row: number;
  expiresAt: number;
}

export interface WallOfFlameSegment {
  cells: Cell[];
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

export interface WizardFlight {
  pos: ExteriorNode;
  until: number;
  descending: boolean;
  descendTimer?: number;
}

export type SpellSchool = 'fire' | 'air';

export type SimSpeed = 1 | 2 | 4;

export interface GameState {
  scene: Scene;
  phase: Phase;
  progressionMode: ProgressionMode;
  levelIndex: number;
  waveIndex: number;
  waveTimer: number;
  spawnTimer: number;
  spawnQueue: string[];
  /** Simulation speed multiplier during attack (1 = normal). */
  simSpeed: SimSpeed;
  player: Player;
  tower: Tower;
  enemies: Enemy[];
  messages: GameMessage[];
  rngState: number;
  devMode: boolean;
  roomEffectTimers: Record<string, number>;
  soldiers: Soldier[];
  /** Recruited soldier count per barracks room (build phase). */
  barracksRecruited: Record<string, number>;
  /** Headcount allocated per slot room for the upcoming wave (build phase). */
  slotAllocations: Record<string, number>;
  /** Gold spent recruiting soldiers this build phase (commits on wave start). */
  buildRecruitSpend: number;
  /** Stair columns currently in use for vertical movement. */
  stairColumnLocks: Record<number, string>;
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
  /** Dev playtest: which spell kit is on the hotbar. */
  activeSpellSchool: SpellSchool;
  /** Attack-phase boiler production state. */
  boilerRuntime: Record<string, BoilerRuntime>;
  /** Attack-phase steam turret charge state. */
  steamTurretRuntime: Record<string, SteamTurretRuntime>;
  /** Tower + gold at build-phase start; edits commit on wave start. */
  buildBaseline: BuildBaseline | null;
}

export interface BoilerRuntime {
  producing: boolean;
  steamAvailable: boolean;
}

export interface SteamTurretRuntime {
  charge: number;
  chargeRate: number;
}

export type PlacementReason =
  | 'ok'
  | 'out_of_bounds'
  | 'overlap'
  | 'no_support'
  | 'overhang_too_far'
  | 'disconnected'
  | 'fluid_mix'
  | 'boiler_footprint';

export interface PlacementResult { ok: boolean; reason: PlacementReason }
