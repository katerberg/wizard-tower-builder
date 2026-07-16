/** Build-library sidebar sections (order = display order). */
export type LibrarySectionId =
  | 'structure'
  | 'housing'
  | 'generators'
  | 'infrastructure'
  | 'damagers';

export interface LibrarySectionDef {
  id: LibrarySectionId;
  label: string;
}

export const LIBRARY_SECTIONS: LibrarySectionDef[] = [
  { id: 'structure', label: 'Spire & buttresses' },
  { id: 'housing', label: 'Housing' },
  { id: 'generators', label: 'Generators' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'damagers', label: 'Damagers' },
];

/** Blueprint id → library section. Unlisted ids are omitted from grouped view. */
export const BLUEPRINT_LIBRARY_SECTION: Record<string, LibrarySectionId> = {
  stem: 'structure',
  buttress2: 'structure',
  buttress3: 'structure',

  guardroomRoom: 'housing',
  chamberRoom: 'housing',
  quartersRoom: 'housing',

  goldMineRoom: 'generators',
  manaSpringRoom: 'generators',
  boilerRoom: 'generators',

  staircase: 'infrastructure',
  pipe: 'infrastructure',

  turretRoom: 'damagers',
  slotRoom: 'damagers',
  steamTurretRoom: 'damagers',
};

export function librarySectionFor(blueprintId: string): LibrarySectionId | null {
  return BLUEPRINT_LIBRARY_SECTION[blueprintId] ?? null;
}
