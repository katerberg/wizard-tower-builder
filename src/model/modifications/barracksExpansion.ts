import type { ModificationDef } from './types';
import { isBarracksRoom } from '@/model/soldiers/capacity';

export const barracksExpansion: ModificationDef = {
  id: 'barracksExpansion',
  name: 'Barracks Expansion',
  glyph: '+',
  color: '#718096',
  description: 'Increases capacity from 5 to 10 soldiers.',
  maxLevel: 1,
  cost: (level) => (level === 1 ? 12 : 0),
  canApply: (room) => isBarracksRoom(room),
};
