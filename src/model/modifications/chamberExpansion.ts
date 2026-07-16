import type { ModificationDef } from './types';
import { isChamber } from '@/model/staff/capacity';

export const chamberExpansion: ModificationDef = {
  id: 'chamberExpansion',
  name: 'Chamber Expansion',
  glyph: '+',
  color: '#9f7aea',
  description: 'Increases capacity from 1 to 2 magi.',
  mechanicsAtLevel: () => 'Capacity 2 magi',
  maxLevel: 1,
  cost: (level) => (level === 1 ? 10 : 0),
  canApply: (room) => isChamber(room),
};
