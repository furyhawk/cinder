import { describe, expect, it } from 'vitest';
import { addTrauma, createCameraState, stepCamera } from '../../src/render/camera';

describe('camera shake', () => {
  it('never exceeds 10px displacement', () => {
    let state = createCameraState();
    state = addTrauma(state, 1);
    for (let tick = 0; tick < 200; tick += 1) {
      state = stepCamera(state, 16.666, tick);
      expect(Math.abs(state.x)).toBeLessThanOrEqual(10);
      expect(Math.abs(state.y)).toBeLessThanOrEqual(10);
    }
  });

  it('disables shake when reduced motion is enabled', () => {
    let state = createCameraState();
    state = addTrauma(state, 1);
    state.reducedMotion = true;
    state = stepCamera(state, 16.666, 1);
    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
  });
});
