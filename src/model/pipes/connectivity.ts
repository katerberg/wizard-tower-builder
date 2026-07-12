import {
  boilerHasSteamPort,
  boilerHasWaterPort,
  isBoilerRoom,
} from './fluids';
import type { GameState } from '@/model/types';

export interface PipeConnectivityReport {
  warnings: string[];
  /** Per-boiler contextual warnings. */
  boilers: { roomId: string; warning: string }[];
}

/** Warn-only pipe/boiler connectivity for build phase. */
export function selectPipeConnectivityReport(state: GameState): PipeConnectivityReport {
  const warnings: string[] = [];
  const boilers: { roomId: string; warning: string }[] = [];

  for (const room of state.tower.rooms) {
    if (!isBoilerRoom(room)) continue;
    const waterOk = boilerHasWaterPort(state.tower, room.origin, room.size);
    const steamOk = boilerHasSteamPort(state.tower, room.origin, room.size);

    if (!waterOk) {
      const warning = 'Needs water from ground pipes';
      boilers.push({ roomId: room.id, warning });
      warnings.push(warning);
    } else if (!steamOk) {
      const warning = 'Needs a steam pipe outlet';
      boilers.push({ roomId: room.id, warning });
      warnings.push(warning);
    }
  }

  return { warnings, boilers };
}
