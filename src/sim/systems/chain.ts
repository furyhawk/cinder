export interface ChainState {
  count: number;
  timerMs: number;
  multiplier: number;
}

export function createChainState(): ChainState {
  return {
    count: 0,
    timerMs: 0,
    multiplier: 1,
  };
}

function multiplierForCount(count: number): number {
  if (count >= 32) return 4;
  if (count >= 16) return 3;
  if (count >= 8) return 2;
  return 1;
}

export function onKill(state: ChainState): ChainState {
  const nextCount = state.count + 1;
  return {
    count: nextCount,
    timerMs: 3000,
    multiplier: multiplierForCount(nextCount),
  };
}

export function onDamageTaken(): ChainState {
  return {
    count: 0,
    timerMs: 0,
    multiplier: 1,
  };
}

export function stepChain(state: ChainState, dtMs: number): ChainState {
  const timer = Math.max(0, state.timerMs - dtMs);
  if (timer <= 0) {
    return {
      count: 0,
      timerMs: 0,
      multiplier: 1,
    };
  }

  return {
    ...state,
    timerMs: timer,
  };
}
