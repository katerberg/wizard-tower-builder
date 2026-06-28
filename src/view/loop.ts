import { FIXED_DT, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } from '@/config/constants';
import type { Store } from '@/store/store';

/**
 * Fixed-timestep loop with one sim step per frame so canvas motion, combat log
 * ticks, and model state stay aligned. Positions interpolate between steps.
 */
export function startLoop(store: Store, render: () => void): void {
  let accumulator = 0;
  let last = performance.now();

  function frame(now: number): void {
    const frameTime = Math.min((now - last) / 1000, MAX_FRAME_TIME);
    last = now;
    accumulator += frameTime;

    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      store.captureForRender();
      store.advance(FIXED_DT);
      accumulator -= FIXED_DT;
      steps += 1;
    }

    store.setRenderAlpha(Math.min(1, accumulator / FIXED_DT));
    store.flush();
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
