import {
  SUB_CELLS_PER_MACRO,
  WIZARD_FALL_SPEED,
  WIZARD_FLIGHT_SPEED,
  WIZARD_HORIZONTAL_SPEED,
  WIZARD_PASSENGER_ID,
  WIZARD_STAIR_SPEED,
} from '@/config/constants';
import { findPath } from '@/calculations/pathfinding';
import { macroCellOfNode, macroCenterSubCell } from '@/calculations/subGrid';
import { GRID_COLS } from '@/config/constants';
import {
  expandMacroPathToSubCells,
  findWizardMacroPath,
} from '@/calculations/wizardPathfinding';
import { isWizardStandable, isWizardWalkable } from '@/calculations/wizardGraph';
import { isElevatorVerticalStep, planElevatorRide } from '@/model/elevators';
import { addMessage } from '@/model/messages';
import { getWizardPosition } from '@/model/tower';
import type { Cell, ExteriorNode, GameState, WizardAvatar } from '@/model/types';
import { getSolarCollectorPosition } from './collector';

const FLY_PROFILE = {
  kind: 'fly' as const,
  canPassUnderOverhang: false,
  canAttackOverhang: false,
  canFly: true,
  canTransferFaces: false,
};

export function createWizardAvatarAtPerch(state: GameState): WizardAvatar {
  const perch = getWizardPosition(state.tower);
  return {
    pos: { ...perch },
    path: [],
    pathIndex: 0,
    macroPath: [],
    macroPathIndex: 0,
    moveCooldown: 0,
    status: 'idle',
  };
}

export function ensureWizardAvatar(state: GameState): WizardAvatar {
  if (!state.wizardAvatar) {
    state.wizardAvatar = createWizardAvatarAtPerch(state);
  }
  return state.wizardAvatar;
}

/** Effective casting / draw position. */
export function getEffectiveWizardPosition(state: GameState): ExteriorNode {
  return ensureWizardAvatar(state).pos;
}

export function snapWizardToPerch(state: GameState): void {
  const avatar = ensureWizardAvatar(state);
  avatar.pos = { ...getWizardPosition(state.tower) };
  clearWizardPath(avatar);
  avatar.status = 'idle';
  delete state.wizardFlight;
}

function clearWizardPath(avatar: WizardAvatar): void {
  avatar.path = [];
  avatar.pathIndex = 0;
  avatar.macroPath = [];
  avatar.macroPathIndex = 0;
  clearWizardElevator(avatar);
}

function clearWizardElevator(avatar: WizardAvatar): void {
  delete avatar.elevatorShaftId;
  delete avatar.elevatorExitRow;
  delete avatar.elevatorExitMacroIndex;
  delete avatar.elevatorWaitElapsed;
  if (avatar.status === 'waiting_elevator' || avatar.status === 'riding_elevator') {
    avatar.status = 'idle';
  }
  // Drop wizard from any car passenger list.
}

export function ejectWizardFromElevators(state: GameState): void {
  for (const car of state.elevators) {
    car.passengers = car.passengers.filter((id) => id !== WIZARD_PASSENGER_ID);
  }
}

/** Click-to-path: interior when grounded, flier graph while Flight is active. */
export function setWizardDestination(state: GameState, cell: Cell): boolean {
  const avatar = ensureWizardAvatar(state);
  if (avatar.status === 'falling') return false;

  if (state.wizardFlight) {
    return setWizardAirDestination(state, cell);
  }

  if (!isWizardWalkable(state.tower, cell.col, cell.row)) {
    addMessage(state, 'Cannot path there.', 'info');
    return false;
  }

  const start = macroCellOfNode(avatar.pos);
  if (start.col === cell.col && start.row === cell.row) {
    clearWizardPath(avatar);
    avatar.status = 'idle';
    return true;
  }

  const macroPath = findWizardMacroPath(state.tower, start, cell);
  if (macroPath.length === 0) {
    addMessage(state, 'Cannot path there.', 'info');
    return false;
  }

  ejectWizardFromElevators(state);
  clearWizardElevator(avatar);
  avatar.macroPath = macroPath;
  avatar.macroPathIndex = 0;
  avatar.path = expandMacroPathToSubCells(state.tower, macroPath);
  avatar.pathIndex = 0;
  avatar.status = 'moving';
  avatar.moveCooldown = 0;
  // Snap path start to current pos so we don't teleport to cell center first.
  if (avatar.path.length > 0) {
    avatar.path[0] = { ...avatar.pos, face: 'top' };
  }
  return true;
}

function setWizardAirDestination(state: GameState, cell: Cell): boolean {
  const avatar = ensureWizardAvatar(state);
  const mid = Math.floor(SUB_CELLS_PER_MACRO / 2);
  const goal: ExteriorNode = {
    col: cell.col * SUB_CELLS_PER_MACRO + mid,
    row: cell.row * SUB_CELLS_PER_MACRO + mid,
    face: 'air',
  };
  const path = findPath(state.tower, { ...avatar.pos, face: 'air' }, goal, FLY_PROFILE);
  if (path.length === 0) {
    addMessage(state, 'Cannot path there.', 'info');
    return false;
  }
  avatar.path = path.map((n) => ({ ...n, face: 'air' as const }));
  avatar.pathIndex = 0;
  avatar.macroPath = [];
  avatar.macroPathIndex = 0;
  avatar.status = 'flying';
  avatar.moveCooldown = 0;
  return true;
}

export function beginWizardFall(state: GameState): void {
  const avatar = ensureWizardAvatar(state);
  ejectWizardFromElevators(state);
  clearWizardPath(avatar);
  delete state.wizardFlight;
  avatar.status = 'falling';
  avatar.moveCooldown = 0;
}

function beginElevatorWait(state: GameState, avatar: WizardAvatar): boolean {
  const ride = planElevatorRide(state.tower, avatar.macroPath, avatar.macroPathIndex);
  if (!ride) return false;
  avatar.status = 'waiting_elevator';
  avatar.elevatorShaftId = ride.shaftId;
  avatar.elevatorExitRow = ride.exitRow;
  avatar.elevatorExitMacroIndex = ride.exitPathIndex;
  avatar.elevatorWaitElapsed = 0;
  avatar.moveCooldown = 0;
  return true;
}

function subStepCooldown(vertical: boolean): number {
  const macroSpeed = vertical ? WIZARD_STAIR_SPEED : WIZARD_HORIZONTAL_SPEED;
  return 1 / (macroSpeed * SUB_CELLS_PER_MACRO);
}

function stepFall(state: GameState, avatar: WizardAvatar, dt: number): void {
  avatar.moveCooldown -= dt;
  if (avatar.moveCooldown > 0) return;
  avatar.moveCooldown = 1 / WIZARD_FALL_SPEED;

  const below: ExteriorNode = {
    col: avatar.pos.col,
    row: avatar.pos.row - 1,
    face: 'top',
  };
  if (below.row < 0) {
    // Land on ground under current column.
    const macroCol = Math.max(0, Math.min(GRID_COLS - 1, macroCellOfNode(avatar.pos).col));
    avatar.pos = macroCenterSubCell(macroCol, 0);
    avatar.status = 'idle';
    return;
  }

  avatar.pos = below;
  const macro = macroCellOfNode(avatar.pos);
  if (isWizardStandable(state.tower, macro.col, macro.row)) {
    avatar.pos = macroCenterSubCell(macro.col, macro.row);
    avatar.status = 'idle';
    return;
  }
}

function stepAir(state: GameState, avatar: WizardAvatar, dt: number): void {
  if (!state.wizardFlight) {
    beginWizardFall(state);
    return;
  }
  if (state.waveTimer >= state.wizardFlight.until) {
    beginWizardFall(state);
    return;
  }

  avatar.moveCooldown -= dt;
  if (avatar.moveCooldown > 0) return;
  if (avatar.pathIndex >= avatar.path.length - 1) {
    avatar.status = 'flying';
    return;
  }
  avatar.pathIndex += 1;
  avatar.pos = { ...avatar.path[avatar.pathIndex], face: 'air' };
  avatar.moveCooldown = 1 / WIZARD_FLIGHT_SPEED;
}

function stepGround(state: GameState, avatar: WizardAvatar, dt: number): void {
  if (
    avatar.status === 'waiting_elevator' ||
    avatar.status === 'riding_elevator'
  ) {
    if (avatar.status === 'waiting_elevator') {
      avatar.elevatorWaitElapsed = (avatar.elevatorWaitElapsed ?? 0) + dt;
    }
    return;
  }

  if (avatar.path.length === 0 || avatar.pathIndex >= avatar.path.length - 1) {
    avatar.status = 'idle';
    return;
  }

  avatar.moveCooldown -= dt;
  if (avatar.moveCooldown > 0) return;

  const next = avatar.path[avatar.pathIndex + 1];
  const curMacro = macroCellOfNode(avatar.pos);
  const nextMacro = macroCellOfNode(next);

  // About to cross an elevator vertical macro edge — board instead of free-climbing.
  if (
    (curMacro.col !== nextMacro.col || curMacro.row !== nextMacro.row) &&
    isElevatorVerticalStep(state.tower, curMacro, nextMacro)
  ) {
    // Sync macroPathIndex to current cell.
    const idx = avatar.macroPath.findIndex(
      (c) => c.col === curMacro.col && c.row === curMacro.row,
    );
    if (idx >= 0) avatar.macroPathIndex = idx;
    if (beginElevatorWait(state, avatar)) return;
  }

  const vertical = curMacro.col === nextMacro.col && curMacro.row !== nextMacro.row;
  avatar.pathIndex += 1;
  avatar.pos = { ...next, face: 'top' };
  // Keep macroPathIndex in sync when entering a new macro cell.
  if (curMacro.col !== nextMacro.col || curMacro.row !== nextMacro.row) {
    const idx = avatar.macroPath.findIndex(
      (c) => c.col === nextMacro.col && c.row === nextMacro.row,
    );
    if (idx >= 0) avatar.macroPathIndex = idx;
  }
  avatar.moveCooldown = subStepCooldown(vertical);
  avatar.status = 'moving';
}

export function stepWizard(state: GameState, dt: number): void {
  const avatar = ensureWizardAvatar(state);
  if (avatar.status === 'falling') {
    stepFall(state, avatar, dt);
    return;
  }
  if (state.wizardFlight || avatar.status === 'flying') {
    stepAir(state, avatar, dt);
    return;
  }
  stepGround(state, avatar, dt);
}

/** After elevator unload: snap to exit floor and rebuild remaining sub-path. */
export function onWizardElevatorUnload(state: GameState): void {
  const avatar = ensureWizardAvatar(state);
  if (avatar.elevatorExitRow === undefined || avatar.elevatorExitMacroIndex === undefined) {
    clearWizardElevator(avatar);
    avatar.status = 'idle';
    return;
  }
  const col = avatar.macroPath[avatar.elevatorExitMacroIndex]?.col ?? macroCellOfNode(avatar.pos).col;
  const row = avatar.elevatorExitRow;
  avatar.pos = macroCenterSubCell(col, row);
  avatar.macroPathIndex = avatar.elevatorExitMacroIndex;
  const remaining = avatar.macroPath.slice(avatar.macroPathIndex);
  avatar.path = expandMacroPathToSubCells(state.tower, remaining);
  avatar.pathIndex = 0;
  if (avatar.path.length > 0) {
    avatar.path[0] = { ...avatar.pos, face: 'top' };
  }
  clearWizardElevator(avatar);
  avatar.status = remaining.length > 1 ? 'moving' : 'idle';
  avatar.moveCooldown = 0;
}

/** If support under the wizard was destroyed, start falling. */
export function maybeWizardCollapseFall(state: GameState, clearedKeys: Set<string>): void {
  const avatar = ensureWizardAvatar(state);
  const macro = macroCellOfNode(avatar.pos);
  const key = `${macro.col},${macro.row}`;
  if (clearedKeys.has(key) || !isWizardStandable(state.tower, macro.col, macro.row)) {
    // Still standable ground row-0 without structure is ok — isWizardStandable handles it.
    if (isWizardStandable(state.tower, macro.col, macro.row) && !clearedKeys.has(key)) {
      return;
    }
    if (avatar.status === 'falling') return;
    beginWizardFall(state);
  }
}

export { getSolarCollectorPosition };
