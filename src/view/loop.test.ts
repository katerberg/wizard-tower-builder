import { describe, expect, it } from 'vitest';
import { FIXED_DT, MAX_STEPS_PER_FRAME } from '@/config/constants';
import { planSimSteps } from './loop';

describe('planSimSteps', () => {
  it('runs one step per frame at 1× when the display matches the sim rate', () => {
    const { steps, accumulator } = planSimSteps(0, FIXED_DT, 1);
    expect(steps).toBe(1);
    expect(accumulator).toBeCloseTo(0);
  });

  it('multiplies real time so 10× yields ten steps in one frame', () => {
    const { steps, accumulator } = planSimSteps(0, FIXED_DT, 10);
    expect(steps).toBe(10);
    expect(accumulator).toBeCloseTo(0);
  });

  it('caps steps at MAX_STEPS_PER_FRAME', () => {
    const { steps } = planSimSteps(0, FIXED_DT * 20, 10);
    expect(steps).toBe(MAX_STEPS_PER_FRAME);
  });

  it('does not invent steps without accumulated time', () => {
    // Old bug: capping at simSpeed while only adding real frame time left
    // 2×/4× stuck at one step/frame. Multiplied time is what enables speed-up.
    const { steps } = planSimSteps(0, FIXED_DT, 1);
    expect(steps).toBe(1);
    expect(planSimSteps(0, FIXED_DT, 5).steps).toBe(5);
  });

  it('runs no steps while paused', () => {
    const { steps, accumulator } = planSimSteps(0, FIXED_DT, 0);
    expect(steps).toBe(0);
    expect(accumulator).toBe(0);
  });
});
