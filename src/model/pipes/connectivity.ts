import { parseKey } from '@/calculations/grid';
import {
  adjacentSteamPipeKeys,
  boilerHasSteamPort,
  boilerHasWaterPort,
  isBoilerRoom,
  isManaSpringRoom,
  isSteamTurretRoom,
  steamComponentKeys,
} from './fluids';
import type { GameState } from '@/model/types';

export interface PipeConnectivityReport {
  warnings: string[];
  /** Per-room contextual pipe warnings. */
  rooms: { roomId: string; warning: string }[];
  /** @deprecated use rooms — kept for boiler-focused call sites */
  boilers: { roomId: string; warning: string }[];
}

/** Warn-only pipe/boiler/turret/spring connectivity for build phase. */
export function selectPipeConnectivityReport(state: GameState): PipeConnectivityReport {
  const warnings: string[] = [];
  const rooms: { roomId: string; warning: string }[] = [];

  const push = (roomId: string, warning: string) => {
    rooms.push({ roomId, warning });
    warnings.push(warning);
  };

  for (const room of state.tower.rooms) {
    if (isBoilerRoom(room)) {
      const waterOk = boilerHasWaterPort(state.tower, room.origin, room.size);
      const steamOk = boilerHasSteamPort(state.tower, room.origin, room.size);
      if (!waterOk) {
        push(room.id, 'Needs water from ground pipes');
      } else if (!steamOk) {
        push(room.id, 'Needs a steam pipe outlet');
      }
      continue;
    }

    if (isManaSpringRoom(room)) {
      if (!boilerHasWaterPort(state.tower, room.origin, room.size)) {
        push(room.id, 'Needs water from ground pipes');
      }
      continue;
    }

    if (isSteamTurretRoom(room)) {
      const steamKeys = adjacentSteamPipeKeys(state.tower, room.origin, room.size);
      if (steamKeys.length === 0) {
        push(room.id, 'Needs a steam pipe');
        continue;
      }
      const component = steamComponentKeys(state.tower, parseKey(steamKeys[0]));
      const hasBoiler = state.tower.rooms.some(
        (r) =>
          isBoilerRoom(r) &&
          adjacentSteamPipeKeys(state.tower, r.origin, r.size).some((k) => component.has(k)),
      );
      if (!hasBoiler) {
        push(room.id, 'No steam from a boiler');
      }
    }
  }

  return {
    warnings,
    rooms,
    boilers: rooms.filter((r) =>
      state.tower.rooms.some((room) => room.id === r.roomId && isBoilerRoom(room)),
    ),
  };
}
