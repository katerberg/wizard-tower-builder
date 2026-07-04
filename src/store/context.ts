import type { GameState, Tower } from '@/model/types';
import type { ViewState } from './intents';

/** Mutable store state passed to intent handlers. */
export interface StoreRefs {
  game: GameState;
  view: ViewState;
  buildHistory: Tower[];
}

export interface HandlerContext extends StoreRefs {
  nextRoomId(): string;
  recordBuildStep(): void;
  clearBuildHistory(): void;
  closeModalIfRoomMissing(): void;
}

export type StoreMutators = Pick<
  HandlerContext,
  'nextRoomId' | 'recordBuildStep' | 'clearBuildHistory' | 'closeModalIfRoomMissing'
>;
