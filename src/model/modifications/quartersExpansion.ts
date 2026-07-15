import type { ModificationDef } from './types';
import { isQuarters } from '@/model/staff/capacity';

export const quartersExpansion: ModificationDef = {
  id: 'quartersExpansion',
  name: 'Quarters Expansion',
  glyph: '+',
  color: '#dd6b20',
  description: 'Increases capacity from 6 to 12 laborers.',
  mechanicsAtLevel: () => 'Capacity 12 laborers',
  maxLevel: 1,
  cost: (level) => (level === 1 ? 14 : 0),
  canApply: (room) => isQuarters(room),
};
