import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { roomAnchorCell } from '@/calculations/interiorGraph';
import { isBarracksRoom, isSlotRoom } from '@/model/soldiers/capacity';
import type { GameState } from '@/model/types';

export interface SlotConnectivity {
  slotId: string;
  slotName: string;
  allocated: number;
  connected: boolean;
  pathLength: number;
}

export interface ConnectivityReport {
  warnings: string[];
  slots: SlotConnectivity[];
  overAllocated: boolean;
}

export function selectConnectivityReport(state: GameState): ConnectivityReport {
  const warnings: string[] = [];
  const slots: SlotConnectivity[] = [];

  const recruited = Object.values(state.barracksRecruited).reduce((s, n) => s + n, 0);
  const allocated = Object.values(state.slotAllocations).reduce((s, n) => s + n, 0);
  const overAllocated = allocated > recruited;
  if (overAllocated) {
    warnings.push(`Allocated ${allocated} soldiers but only ${recruited} recruited.`);
  }

  const barracks = state.tower.rooms.filter((r) => isBarracksRoom(r));

  for (const slot of state.tower.rooms.filter((r) => isSlotRoom(r))) {
    const allocatedCount = state.slotAllocations[slot.id] ?? 0;
    if (allocatedCount <= 0) continue;

    const slotAnchor = roomAnchorCell(state.tower, slot.origin, slot.size);
    if (!slotAnchor) {
      slots.push({
        slotId: slot.id,
        slotName: 'Slot',
        allocated: allocatedCount,
        connected: false,
        pathLength: 0,
      });
      warnings.push('Slot has no walkable anchor cell.');
      continue;
    }

    let bestPath = 0;
    let connected = false;
    for (const b of barracks) {
      if ((state.barracksRecruited[b.id] ?? 0) <= 0) continue;
      const from = roomAnchorCell(state.tower, b.origin, b.size);
      if (!from) continue;
      const path = findInteriorPath(state.tower, from, slotAnchor);
      if (path.length > 0) {
        connected = true;
        bestPath = bestPath === 0 ? path.length : Math.min(bestPath, path.length);
      }
    }

    slots.push({
      slotId: slot.id,
      slotName: 'Slot',
      allocated: allocatedCount,
      connected,
      pathLength: bestPath,
    });

    if (!connected) {
      warnings.push(`Slot needs ${allocatedCount} — no path from any barracks.`);
    }
  }

  return { warnings, slots, overAllocated };
}
