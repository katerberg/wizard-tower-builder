import { BOILER_THROUGHPUT } from '@/config/constants';
import { isBoilerRoom } from '@/model/pipes';
import type { ModificationDef } from './types';

export const boilerExpansion: ModificationDef = {
  id: 'boilerExpansion',
  name: 'Boiler Expansion',
  glyph: '+',
  color: '#c05621',
  description: 'Increases steam throughput for connected turrets.',
  mechanicsAtLevel: (level) => `Throughput ${BOILER_THROUGHPUT[level] ?? BOILER_THROUGHPUT[0]} units`,
  maxLevel: 2,
  cost: (level) => (level === 1 ? 14 : level === 2 ? 18 : 0),
  canApply: (room) => isBoilerRoom(room),
};
