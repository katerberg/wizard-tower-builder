import type { GameMessage, GameMessageKind, GameState } from './types';

const MAX_MESSAGES = 50;

export function addMessage(state: GameState, text: string, kind: GameMessageKind = 'info'): void {
  state.messages.push({ tick: state.tick, text, kind });
  if (state.messages.length > MAX_MESSAGES) {
    state.messages.splice(0, state.messages.length - MAX_MESSAGES);
  }
}

export function recentMessages(state: GameState, count: number): GameMessage[] {
  return state.messages.slice(-count);
}
