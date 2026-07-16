import type { ModificationDef } from './types';
import { isSlotRoom } from '@/model/staff/capacity';

export const slotExpansion: ModificationDef = {
  id: 'slotExpansion',
  name: 'Slot Expansion',
  glyph: '+',
  color: '#805ad5',
  description: 'Increases stationed soldiers from 2 to 4.',
  mechanicsAtLevel: () => 'Capacity 4 stationed soldiers',
  maxLevel: 1,
  cost: (level) => (level === 1 ? 10 : 0),
  canApply: (room) => isSlotRoom(room),
};
