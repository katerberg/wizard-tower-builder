import { ELEVATOR_CAPACITY, STAFF_ELEVATOR_SPEED } from '@/config/constants';
import { hasInfraKind } from '@/model/infra';
import type {
  Cell,
  ElevatorCar,
  ElevatorDir,
  ElevatorShaft,
  GameState,
  StaffUnit,
  Tower,
} from '@/model/types';

function parseInfraKey(key: string): Cell {
  const [col, row] = key.split(',').map(Number);
  return { col, row };
}

/** Contiguous elevator runs in each column — a gap yields separate shafts. */
export function discoverElevatorShafts(tower: Tower): ElevatorShaft[] {
  const byCol = new Map<number, number[]>();
  for (const [key, cell] of Object.entries(tower.infra ?? {})) {
    if (cell.kind !== 'elevator') continue;
    const { col, row } = parseInfraKey(key);
    const rows = byCol.get(col) ?? [];
    rows.push(row);
    byCol.set(col, rows);
  }

  const shafts: ElevatorShaft[] = [];
  for (const [col, rows] of byCol) {
    rows.sort((a, b) => a - b);
    let runStart = rows[0];
    let prev = rows[0];
    for (let i = 1; i <= rows.length; i++) {
      const row = rows[i];
      if (row === prev + 1) {
        prev = row;
        continue;
      }
      shafts.push({
        id: `shaft-${col}-${runStart}-${prev}`,
        col,
        minRow: runStart,
        maxRow: prev,
      });
      if (row !== undefined) {
        runStart = row;
        prev = row;
      }
    }
  }
  return shafts;
}

export function shaftAt(tower: Tower, col: number, row: number): ElevatorShaft | null {
  if (!hasInfraKind(tower, col, row, 'elevator')) return null;
  return discoverElevatorShafts(tower).find((s) => s.col === col && row >= s.minRow && row <= s.maxRow) ?? null;
}

export function shaftById(tower: Tower, shaftId: string): ElevatorShaft | null {
  return discoverElevatorShafts(tower).find((s) => s.id === shaftId) ?? null;
}

/** True when adjacent vertical cells are both elevator infra in the same column (same shaft). */
export function isElevatorVerticalStep(tower: Tower, from: Cell, to: Cell): boolean {
  if (from.col !== to.col) return false;
  if (Math.abs(from.row - to.row) !== 1) return false;
  return (
    hasInfraKind(tower, from.col, from.row, 'elevator') &&
    hasInfraKind(tower, to.col, to.row, 'elevator')
  );
}

/**
 * Scan the path forward from pathIndex for a contiguous same-shaft vertical ride.
 * Returns null if the next step is not an elevator vertical.
 */
export function planElevatorRide(
  tower: Tower,
  path: Cell[],
  pathIndex: number,
): { shaftId: string; exitRow: number; exitPathIndex: number } | null {
  if (pathIndex >= path.length - 1) return null;
  const from = path[pathIndex];
  const next = path[pathIndex + 1];
  if (!isElevatorVerticalStep(tower, from, next)) return null;

  const shaft = shaftAt(tower, from.col, from.row);
  if (!shaft) return null;

  let i = pathIndex;
  while (i < path.length - 1) {
    const a = path[i];
    const b = path[i + 1];
    if (!isElevatorVerticalStep(tower, a, b)) break;
    if (a.col !== shaft.col || b.row < shaft.minRow || b.row > shaft.maxRow) break;
    i += 1;
  }
  if (i === pathIndex) return null;
  return { shaftId: shaft.id, exitRow: path[i].row, exitPathIndex: i };
}

export function initElevators(state: GameState): void {
  const shafts = discoverElevatorShafts(state.tower);
  state.elevators = shafts.map((shaft) => ({
    shaftId: shaft.id,
    col: shaft.col,
    row: shaft.minRow,
    dir: 'idle' as const,
    passengers: [],
    moveCooldown: 0,
    targetRow: null,
  }));
}

export function clearElevators(state: GameState): void {
  state.elevators = [];
}

function staffById(state: GameState, id: string): StaffUnit | undefined {
  return state.staff.find((s) => s.id === id);
}

function waitersAt(
  state: GameState,
  shaftId: string,
  row: number,
): StaffUnit[] {
  return state.staff.filter(
    (s) =>
      s.status === 'waiting_elevator' &&
      s.elevatorShaftId === shaftId &&
      s.pos.row === row &&
      s.elevatorExitRow !== undefined &&
      s.elevatorExitRow !== row,
  );
}

function wantsDirection(unit: StaffUnit, dir: ElevatorDir, carRow: number): boolean {
  if (unit.elevatorExitRow === undefined) return false;
  if (dir === 'up') return unit.elevatorExitRow > carRow;
  if (dir === 'down') return unit.elevatorExitRow < carRow;
  return false;
}

function clearElevatorFields(unit: StaffUnit): void {
  delete unit.elevatorShaftId;
  delete unit.elevatorExitRow;
  delete unit.elevatorExitPathIndex;
  delete unit.elevatorWaitElapsed;
}

function unloadAtFloor(state: GameState, car: ElevatorCar): void {
  const remaining: string[] = [];
  for (const id of car.passengers) {
    const unit = staffById(state, id);
    if (!unit) continue;
    if (unit.elevatorExitRow === car.row) {
      unit.pos = { col: car.col, row: car.row };
      if (unit.elevatorExitPathIndex !== undefined) {
        unit.pathIndex = unit.elevatorExitPathIndex;
      }
      clearElevatorFields(unit);
      unit.status = 'moving';
      unit.moveCooldown = 0;
    } else {
      remaining.push(id);
      unit.pos = { col: car.col, row: car.row };
    }
  }
  car.passengers = remaining;
}

function boardAtFloor(state: GameState, car: ElevatorCar, dir: ElevatorDir): void {
  const queue = waitersAt(state, car.shaftId, car.row).sort(
    (a, b) => (b.elevatorWaitElapsed ?? 0) - (a.elevatorWaitElapsed ?? 0),
  );
  for (const unit of queue) {
    if (car.passengers.length >= ELEVATOR_CAPACITY) break;
    if (!wantsDirection(unit, dir, car.row)) continue;
    car.passengers.push(unit.id);
    unit.status = 'riding_elevator';
    unit.pos = { col: car.col, row: car.row };
    unit.moveCooldown = 0;
  }
}

/** When idle, first boarded waiter sets direction; then fill same-direction waiters. */
function boardFromIdle(state: GameState, car: ElevatorCar): ElevatorDir | null {
  const queue = waitersAt(state, car.shaftId, car.row).sort(
    (a, b) => (b.elevatorWaitElapsed ?? 0) - (a.elevatorWaitElapsed ?? 0),
  );
  if (queue.length === 0) return null;

  const first = queue[0];
  if (first.elevatorExitRow === undefined || first.elevatorExitRow === car.row) return null;
  const dir: ElevatorDir = first.elevatorExitRow > car.row ? 'up' : 'down';
  boardAtFloor(state, car, dir);
  return car.passengers.length > 0 ? dir : null;
}

function farthestPassengerExit(state: GameState, car: ElevatorCar, dir: ElevatorDir): number | null {
  let best: number | null = null;
  for (const id of car.passengers) {
    const unit = staffById(state, id);
    if (unit?.elevatorExitRow === undefined) continue;
    if (dir === 'up' && unit.elevatorExitRow > car.row) {
      best = best === null ? unit.elevatorExitRow : Math.max(best, unit.elevatorExitRow);
    }
    if (dir === 'down' && unit.elevatorExitRow < car.row) {
      best = best === null ? unit.elevatorExitRow : Math.min(best, unit.elevatorExitRow);
    }
  }
  return best;
}

function nextPickupRow(
  state: GameState,
  car: ElevatorCar,
  dir: ElevatorDir,
  farthest: number,
): number | null {
  if (car.passengers.length >= ELEVATOR_CAPACITY) return null;
  const shaft = shaftById(state.tower, car.shaftId);
  if (!shaft) return null;

  let best: number | null = null;
  const lo = dir === 'up' ? car.row + 1 : farthest;
  const hi = dir === 'up' ? farthest : car.row - 1;
  for (let row = lo; row <= hi; row++) {
    const waiters = waitersAt(state, car.shaftId, row).filter((w) => wantsDirection(w, dir, row));
    if (waiters.length === 0) continue;
    if (dir === 'up') {
      best = best === null ? row : Math.min(best, row);
    } else {
      best = best === null ? row : Math.max(best, row);
    }
  }
  return best;
}

function nextPassengerStop(state: GameState, car: ElevatorCar, dir: ElevatorDir): number | null {
  let best: number | null = null;
  for (const id of car.passengers) {
    const unit = staffById(state, id);
    if (unit?.elevatorExitRow === undefined) continue;
    const exit = unit.elevatorExitRow;
    if (dir === 'up' && exit > car.row) {
      best = best === null ? exit : Math.min(best, exit);
    }
    if (dir === 'down' && exit < car.row) {
      best = best === null ? exit : Math.max(best, exit);
    }
  }
  return best;
}

function chooseNextTarget(state: GameState, car: ElevatorCar, dir: ElevatorDir): number | null {
  const farthest = farthestPassengerExit(state, car, dir);
  const dropoff = nextPassengerStop(state, car, dir);
  if (farthest === null || dropoff === null) return null;
  const pickup = nextPickupRow(state, car, dir, farthest);
  if (pickup === null) return dropoff;
  if (dir === 'up') return Math.min(dropoff, pickup);
  return Math.max(dropoff, pickup);
}

interface CallFloor {
  row: number;
  maxWait: number;
}

function collectCalls(state: GameState, shaftId: string): CallFloor[] {
  const byRow = new Map<number, number>();
  for (const unit of state.staff) {
    if (unit.status !== 'waiting_elevator' || unit.elevatorShaftId !== shaftId) continue;
    if (unit.elevatorExitRow === undefined || unit.elevatorExitRow === unit.pos.row) continue;
    const wait = unit.elevatorWaitElapsed ?? 0;
    byRow.set(unit.pos.row, Math.max(byRow.get(unit.pos.row) ?? 0, wait));
  }
  return [...byRow.entries()].map(([row, maxWait]) => ({ row, maxWait }));
}

function pickNearestCall(car: ElevatorCar, calls: CallFloor[]): CallFloor | null {
  if (calls.length === 0) return null;
  let best = calls[0];
  let bestDist = Math.abs(best.row - car.row);
  for (let i = 1; i < calls.length; i++) {
    const c = calls[i];
    const dist = Math.abs(c.row - car.row);
    if (dist < bestDist || (dist === bestDist && c.maxWait > best.maxWait)) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

function syncPassengerPositions(state: GameState, car: ElevatorCar): void {
  for (const id of car.passengers) {
    const unit = staffById(state, id);
    if (unit) unit.pos = { col: car.col, row: car.row };
  }
}

function processStop(state: GameState, car: ElevatorCar): void {
  unloadAtFloor(state, car);

  if (car.passengers.length > 0 && car.dir !== 'idle') {
    boardAtFloor(state, car, car.dir);
    const next = chooseNextTarget(state, car, car.dir);
    if (next !== null && next !== car.row) {
      car.targetRow = next;
      return;
    }
    // No further stops in this direction — unload should have cleared; fall through.
  }

  if (car.passengers.length === 0) {
    const boardedDir = boardFromIdle(state, car);
    if (boardedDir) {
      car.dir = boardedDir;
      const next = chooseNextTarget(state, car, boardedDir);
      car.targetRow = next;
      if (next === null || next === car.row) {
        // Degenerate — unload immediately next tick
        car.dir = 'idle';
        car.targetRow = null;
      }
      return;
    }

    car.dir = 'idle';
    const call = pickNearestCall(car, collectCalls(state, car.shaftId));
    if (call && call.row !== car.row) {
      car.dir = call.row > car.row ? 'up' : 'down';
      car.targetRow = call.row;
      return;
    }
    if (call?.row === car.row) {
      // Waiters here but boardFromIdle failed (e.g. exit==row); stay idle
      car.targetRow = null;
      return;
    }
    car.targetRow = null;
    return;
  }

  // Passengers remain but no valid next — reset direction from passengers
  const unit = staffById(state, car.passengers[0]);
  if (unit?.elevatorExitRow !== undefined && unit.elevatorExitRow !== car.row) {
    car.dir = unit.elevatorExitRow > car.row ? 'up' : 'down';
    car.targetRow = chooseNextTarget(state, car, car.dir);
  } else {
    car.dir = 'idle';
    car.targetRow = null;
  }
}

function stepCarOneFloor(state: GameState, car: ElevatorCar): void {
  if (car.targetRow === null || car.targetRow === car.row) {
    processStop(state, car);
    return;
  }
  if (car.targetRow > car.row) car.row += 1;
  else car.row -= 1;
  syncPassengerPositions(state, car);
  car.moveCooldown = 1 / STAFF_ELEVATOR_SPEED;

  if (car.row === car.targetRow) {
    processStop(state, car);
  }
}

/** Advance elevator cars and boarding during the attack phase. */
export function stepElevators(state: GameState, dt: number): void {
  // Accumulate wait time for callers.
  for (const unit of state.staff) {
    if (unit.status === 'waiting_elevator') {
      unit.elevatorWaitElapsed = (unit.elevatorWaitElapsed ?? 0) + dt;
    }
  }

  for (const car of state.elevators) {
    car.moveCooldown -= dt;
    if (car.moveCooldown > 0) continue;

    // Idle car with no target: look for calls / local waiters.
    if (car.dir === 'idle' && car.targetRow === null) {
      processStop(state, car);
      // Depart next tick (door close) — do not step the same frame as boarding.
      if (car.targetRow !== null && car.targetRow !== car.row) {
        car.moveCooldown = 1 / STAFF_ELEVATOR_SPEED;
      }
      continue;
    }

    stepCarOneFloor(state, car);
  }
}
