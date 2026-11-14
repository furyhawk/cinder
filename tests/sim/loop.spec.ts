import { describe, expect, it } from 'vitest';
import { createFixedStepLoopState, updateFixedStepLoop } from '../../src/sim/loop';

describe('fixed-step loop', () => {
  it('caps catch-up steps to the configured max after a stall', () => {
    let state = createFixedStepLoopState();
    const config = { tickRateHz: 60, maxCatchUpSteps: 5 };

    state = updateFixedStepLoop(state, 0, config).state;
    const afterStall = updateFixedStepLoop(state, 200, config);

    expect(afterStall.steps).toBe(5);
    expect(afterStall.state.accumulatorMs).toBe(0);
  });
});
