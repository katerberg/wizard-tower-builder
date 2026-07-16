import type { ModificationDef } from './types';
import { isGuardroom } from '@/model/staff/capacity';

export const guardroomExpansion: ModificationDef = {
  id: 'guardroomExpansion',
  name: 'Guardroom Expansion',
  glyph: '+',
  color: '#718096',
  description: 'Increases capacity from 3 to 6 soldiers.',
  mechanicsAtLevel: () => 'Capacity 6 soldiers',
  maxLevel: 1,
  cost: (level) => (level === 1 ? 12 : 0),
  canApply: (room) => isGuardroom(room),
};
