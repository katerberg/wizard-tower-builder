import type { GameMessage, GameMessageKind, GameState } from './types';

const MAX_MESSAGES = 50;

export function addMessage(state: GameState, text: string, kind: GameMessageKind = 'info'): void {
  state.messages.push({ text, kind });
  if (state.messages.length > MAX_MESSAGES) {
    state.messages.splice(0, state.messages.length - MAX_MESSAGES);
  }
}

/** Like addMessage, but skips when the previous line is identical (avoids tick spam). */
export function addMessageOnceInRow(state: GameState, text: string, kind: GameMessageKind = 'info'): void {
  const last = state.messages[state.messages.length - 1];
  if (last?.text === text) return;
  addMessage(state, text, kind);
}

export function recentMessages(state: GameState, count: number): GameMessage[] {
  return state.messages.slice(-count);
}
