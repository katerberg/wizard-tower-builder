import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { roomAnchorCell } from '@/calculations/interiorGraph';
import { getBlueprint } from '@/model/blueprints';
import { computeRoomStats } from '@/calculations/combat';
import { isManaSpringRoom } from '@/model/pipes';
import {
  housingKindOf,
  isQuarters,
  isSlotRoom,
  staffKindForHousing,
} from './capacity';
import type { GameState, Room } from '@/model/types';

export interface SlotConnectivity {
  slotId: string;
  slotName: string;
  allocated: number;
  connected: boolean;
  pathLength: number;
  warning: string | null;
}

export interface WorkplaceConnectivity {
  roomId: string;
  roomName: string;
  kind: 'slot' | 'manaSpring' | 'damage';
  allocated: number;
  connected: boolean;
  warning: string | null;
}

export interface LogisticsReport {
  warnings: string[];
  slots: SlotConnectivity[];
  workplaces: WorkplaceConnectivity[];
  overAllocatedSoldiers: boolean;
  overAllocatedMagi: boolean;
}

function housingRoomsOf(
  state: GameState,
  kind: 'soldier' | 'mage' | 'laborer',
): Room[] {
  return state.tower.rooms.filter((r) => {
    const housing = housingKindOf(r);
    return housing !== null && staffKindForHousing(housing) === kind;
  });
}

function recruitedOf(state: GameState, kind: 'soldier' | 'mage' | 'laborer'): number {
  return housingRoomsOf(state, kind).reduce(
    (sum, r) => sum + (state.housingRecruited[r.id] ?? 0),
    0,
  );
}

function pathFromAnyHousing(
  state: GameState,
  housing: Room[],
  to: { col: number; row: number },
): { connected: boolean; pathLength: number; hasStaffed: boolean } {
  let bestPath = 0;
  let connected = false;
  const hasStaffed = housing.some((b) => (state.housingRecruited[b.id] ?? 0) > 0);
  for (const b of housing) {
    if ((state.housingRecruited[b.id] ?? 0) <= 0) continue;
    const from = roomAnchorCell(state.tower, b.origin, b.size);
    if (!from) continue;
    const path = findInteriorPath(state.tower, from, to);
    if (path.length > 0) {
      connected = true;
      bestPath = bestPath === 0 ? path.length : Math.min(bestPath, path.length);
    }
  }
  return { connected, pathLength: bestPath, hasStaffed };
}

/** Unified logistics warnings for soldiers, magi, laborers, and paths. */
export function selectLogisticsReport(state: GameState): LogisticsReport {
  const warnings: string[] = [];
  const slots: SlotConnectivity[] = [];
  const workplaces: WorkplaceConnectivity[] = [];

  const soldierRecruited = recruitedOf(state, 'soldier');
  const soldierAllocated = Object.values(state.slotAllocations).reduce((s, n) => s + n, 0);
  const overAllocatedSoldiers = soldierAllocated > soldierRecruited;
  if (overAllocatedSoldiers) {
    warnings.push(
      `Allocated ${soldierAllocated} soldiers but only ${soldierRecruited} recruited.`,
    );
  }

  const mageRecruited = recruitedOf(state, 'mage');
  const mageAllocated = Object.values(state.manaSpringAllocations).reduce((s, n) => s + n, 0);
  const overAllocatedMagi = mageAllocated > mageRecruited;
  if (overAllocatedMagi) {
    warnings.push(`Allocated ${mageAllocated} magi but only ${mageRecruited} recruited.`);
  }

  const guardrooms = housingRoomsOf(state, 'soldier');
  for (const slot of state.tower.rooms.filter((r) => isSlotRoom(r))) {
    const allocatedCount = state.slotAllocations[slot.id] ?? 0;
    if (allocatedCount <= 0) continue;

    const slotAnchor = roomAnchorCell(state.tower, slot.origin, slot.size);
    if (!slotAnchor) {
      const warning = 'Needs a walkable cell';
      slots.push({
        slotId: slot.id,
        slotName: 'Slot',
        allocated: allocatedCount,
        connected: false,
        pathLength: 0,
        warning,
      });
      workplaces.push({
        roomId: slot.id,
        roomName: 'Slot',
        kind: 'slot',
        allocated: allocatedCount,
        connected: false,
        warning,
      });
      warnings.push(warning);
      continue;
    }

    const { connected, pathLength, hasStaffed } = pathFromAnyHousing(
      state,
      guardrooms,
      slotAnchor,
    );
    let warning: string | null = null;
    if (!connected) {
      warning = hasStaffed
        ? 'Needs stairs from a guardroom'
        : 'Needs recruited soldiers in a guardroom';
      warnings.push(warning);
    }

    slots.push({
      slotId: slot.id,
      slotName: 'Slot',
      allocated: allocatedCount,
      connected,
      pathLength,
      warning,
    });
    workplaces.push({
      roomId: slot.id,
      roomName: 'Slot',
      kind: 'slot',
      allocated: allocatedCount,
      connected,
      warning,
    });
  }

  const chambers = housingRoomsOf(state, 'mage');
  for (const spring of state.tower.rooms.filter((r) => isManaSpringRoom(r))) {
    const allocatedCount = state.manaSpringAllocations[spring.id] ?? 0;
    if (allocatedCount <= 0) continue;

    const springAnchor = roomAnchorCell(state.tower, spring.origin, spring.size);
    if (!springAnchor) {
      const warning = 'Needs a walkable cell';
      workplaces.push({
        roomId: spring.id,
        roomName: 'Mana Spring',
        kind: 'manaSpring',
        allocated: allocatedCount,
        connected: false,
        warning,
      });
      warnings.push(warning);
      continue;
    }

    const { connected, hasStaffed } = pathFromAnyHousing(state, chambers, springAnchor);
    let warning: string | null = null;
    if (!connected) {
      warning = hasStaffed
        ? 'Needs stairs from a chamber'
        : 'Needs recruited magi in a chamber';
      warnings.push(warning);
    }

    workplaces.push({
      roomId: spring.id,
      roomName: 'Mana Spring',
      kind: 'manaSpring',
      allocated: allocatedCount,
      connected,
      warning,
    });
  }

  const quarters = state.tower.rooms.filter((r) => isQuarters(r));
  const laborerRecruited = recruitedOf(state, 'laborer');
  for (const room of state.tower.rooms) {
    const bp = getBlueprint(room.blueprintId);
    if (!bp) continue;
    const maxHp = computeRoomStats(room, bp).maxHp;
    if (room.hp >= maxHp) continue;

    const anchor = roomAnchorCell(state.tower, room.origin, room.size);
    if (!anchor) continue;

    const { connected, hasStaffed } = pathFromAnyHousing(state, quarters, anchor);
    if (laborerRecruited <= 0) {
      const warning = 'Needs recruited laborers in quarters';
      workplaces.push({
        roomId: room.id,
        roomName: bp.name,
        kind: 'damage',
        allocated: 0,
        connected: false,
        warning,
      });
      warnings.push(warning);
      continue;
    }
    if (!connected) {
      const warning = hasStaffed
        ? 'Needs stairs from quarters'
        : 'Needs recruited laborers in quarters';
      workplaces.push({
        roomId: room.id,
        roomName: bp.name,
        kind: 'damage',
        allocated: 0,
        connected: false,
        warning,
      });
      warnings.push(warning);
    }
  }

  return {
    warnings: [...new Set(warnings)],
    slots,
    workplaces,
    overAllocatedSoldiers,
    overAllocatedMagi,
  };
}

/** @deprecated Use selectLogisticsReport. */
export function selectConnectivityReport(state: GameState) {
  const report = selectLogisticsReport(state);
  return {
    warnings: report.warnings,
    slots: report.slots,
    overAllocated: report.overAllocatedSoldiers,
  };
}
