export interface WaveEntry {
  templateId: string;
  count: number;
}
export interface WaveDef {
  entries: WaveEntry[];
}

/** Inputs for height-based wave composition (sampled at Start Wave). */
export interface WaveContext {
  height: number;
  unlockedEnemyIds: ReadonlySet<string>;
}

/**
 * Pluggable source of waves/rewards. v1 ships a height-based provider; a
 * future roguelike branching map can implement this same interface without
 * touching the phase FSM.
 */
export interface ProgressionProvider {
  readonly mode: 'height' | 'branching';
  getWave(ctx: WaveContext): WaveDef;
  rewardFor(height: number): number;
  isVictoryHeight(height: number): boolean;
}
