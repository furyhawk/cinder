import { describe, expect, it } from 'vitest';
import { createChainState, onDamageTaken, onKill, stepChain } from '../../src/sim/systems/chain';

describe('chain multiplier', () => {
  it('increments tiers at 8/16/32 kills', () => {
    let state = createChainState();
    for (let i = 0; i < 8; i += 1) state = onKill(state);
    expect(state.multiplier).toBe(2);

    for (let i = 0; i < 8; i += 1) state = onKill(state);
    expect(state.multiplier).toBe(3);

    for (let i = 0; i < 16; i += 1) state = onKill(state);
    expect(state.multiplier).toBe(4);
  });

  it('resets on damage and timeout', () => {
    let state = createChainState();
    state = onKill(state);
    state = onDamageTaken();
    expect(state.multiplier).toBe(1);
    expect(state.count).toBe(0);

    state = onKill(state);
    state = stepChain(state, 4000);
    expect(state.count).toBe(0);
    expect(state.multiplier).toBe(1);
  });
});
