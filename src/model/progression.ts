export type WaveEntry = { templateId: string; count: number };
export type WaveDef = { entries: WaveEntry[] };

/**
 * Pluggable source of waves/rewards. v1 ships a linear escalating provider; a
 * future roguelike branching map can implement this same interface without
 * touching the phase FSM.
 */
export interface ProgressionProvider {
  readonly mode: 'linear' | 'branching';
  getWave(levelIndex: number): WaveDef;
  rewardFor(levelIndex: number): number;
  isFinalLevel(levelIndex: number): boolean;
}
