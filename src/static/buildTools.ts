export interface BuildToolDef {
  id: string;
  name: string;
  glyph: string;
  description: string;
}

export const SELECT_TOOL: BuildToolDef = {
  id: 'select',
  name: 'Select',
  glyph: '✋',
  description: 'Click rooms to inspect them, add modifications, or remove blocks. Default mode when no blueprint is selected.',
};

export function getBuildTool(id: string): BuildToolDef | undefined {
  if (id === SELECT_TOOL.id) return SELECT_TOOL;
  return undefined;
}
