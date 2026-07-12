import { BOILER_MANA_PER_SEC, BOILER_THROUGHPUT } from '@/config/constants';
import { boilerHasSteamPort, boilerHasWaterPort, isBoilerRoom } from './pipes';
import type { GameState, Room } from './types';

export function boilerThroughput(room: Room): number {
  const expansion = room.modifications.find((m) => m.id === 'boilerExpansion');
  const level = expansion?.level ?? 0;
  return BOILER_THROUGHPUT[Math.min(level, BOILER_THROUGHPUT.length - 1)] ?? BOILER_THROUGHPUT[0];
}

export function resetBoilerRuntime(state: GameState): void {
  state.boilerRuntime = {};
  for (const room of state.tower.rooms) {
    if (!isBoilerRoom(room)) continue;
    state.boilerRuntime[room.id] = { producing: false, steamAvailable: false };
  }
}

/** Drain mana and mark steam availability while water-connected and mana remains. */
export function tickBoilers(state: GameState, dt: number): void {
  for (const room of state.tower.rooms) {
    if (!isBoilerRoom(room)) continue;

    const waterOk = boilerHasWaterPort(state.tower, room.origin, room.size);
    const steamOk = boilerHasSteamPort(state.tower, room.origin, room.size);
    const producing = waterOk && steamOk && state.player.mana > 0;

    if (producing) {
      state.player.mana = Math.max(0, state.player.mana - BOILER_MANA_PER_SEC * dt);
    }

    const stillProducing = producing && state.player.mana > 0;
    state.boilerRuntime[room.id] = {
      producing: stillProducing,
      steamAvailable: stillProducing,
    };
  }
}
