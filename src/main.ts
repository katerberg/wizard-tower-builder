import { Renderer } from './view/canvas/renderer';
import { snapViewportHeight } from '@/calculations/camera';
import { attachInput, type PointerTracker } from './view/input';
import { createHud } from './view/dom/hud';
import { createLibrary } from './view/dom/library';
import { createMessageLog } from './view/dom/messageLog';
import { createModal } from './view/dom/modal';
import { createOverlay } from './view/dom/overlay';
import { createTooltip } from './view/dom/tooltip';
import { startLoop } from './view/loop';
import { Store } from './store/store';

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

const canvas = requireEl('board') as HTMLCanvasElement;
const stage = requireEl('stage');
const store = new Store();
const pointer: PointerTracker = { x: 0, y: 0 };

const renderer = new Renderer(canvas);
attachInput(canvas, stage, store, pointer);

function syncViewportHeight(): void {
  store.dispatch({ type: 'setViewportHeight', height: snapViewportHeight(stage.clientHeight) });
}

syncViewportHeight();
new ResizeObserver(() => syncViewportHeight()).observe(stage);

const domViews = [
  createHud(requireEl('hud'), store),
  createLibrary(requireEl('library'), store),
  createMessageLog(requireEl('message-log'), store),
  createModal(requireEl('modal-root'), store),
  createOverlay(requireEl('overlay-root'), store),
  createTooltip(requireEl('tooltip-root'), store, pointer),
];

function renderDom(): void {
  for (const render of domViews) render();
}

// DOM reacts to discrete state changes (dispatch + per-frame flush during the
// attack phase); the canvas redraws every frame regardless.
store.subscribe(renderDom);

startLoop(store, () => {
  renderer.draw(store.getSnapshot());
});

renderDom();
