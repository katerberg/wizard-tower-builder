import { getEnemyTemplate } from '@/model/enemies';
import { framingHeight } from '@/model/phases';
import {
  ENEMY_POINT_COST,
  WAVE_BUILDER_ENEMY_IDS,
  estimatePlateauForScore,
  heightProgression,
  plateauForHeight,
  waveDefFromCounts,
  wavePointScore,
} from '@/model/waves';
import type { Snapshot } from '../store';

export interface WaveBuilderRow {
  templateId: string;
  name: string;
  glyph: string;
  color: string;
  pointCost: number;
  count: number;
}

export interface WaveBuilderSummary {
  visible: boolean;
  rows: WaveBuilderRow[];
  score: number;
  totalFoes: number;
  estimatedHeight: number;
  estimatedBudget: number;
  currentHeight: number;
  currentBudget: number;
  clearGold: number;
  overridesStartWave: boolean;
}

export function selectWaveBuilderSummary(snapshot: Snapshot): WaveBuilderSummary {
  const { game, view } = snapshot;
  const visible = game.devMode && view.waveBuilder.open;
  const def = waveDefFromCounts(view.waveBuilder.counts);
  const score = wavePointScore(def);
  const totalFoes = def.entries.reduce((n, e) => n + e.count, 0);
  const estimated = estimatePlateauForScore(score);
  const currentHeight = framingHeight(game);
  const currentBudget = plateauForHeight(currentHeight).budget;
  const clearGold = heightProgression.rewardFor(currentHeight);

  const rows: WaveBuilderRow[] = WAVE_BUILDER_ENEMY_IDS.map((templateId) => {
    const template = getEnemyTemplate(templateId);
    return {
      templateId,
      name: template?.type ?? templateId,
      glyph: template?.glyph ?? '?',
      color: template?.color ?? '#ccc',
      pointCost: ENEMY_POINT_COST[templateId] ?? 1,
      count: Math.max(0, Math.floor(view.waveBuilder.counts[templateId] ?? 0)),
    };
  });

  return {
    visible,
    rows,
    score,
    totalFoes,
    estimatedHeight: estimated.minHeight,
    estimatedBudget: estimated.budget,
    currentHeight,
    currentBudget,
    clearGold,
    overridesStartWave: visible,
  };
}
