export interface FixedStepLoopState {
  accumulatorMs: number;
  lastTimestampMs: number | null;
}

export interface FixedStepLoopResult {
  state: FixedStepLoopState;
  steps: number;
  stepDtMs: number;
}

export interface FixedStepLoopOptions {
  tickRateHz: number;
  maxCatchUpSteps: number;
}

export function createFixedStepLoopState(): FixedStepLoopState {
  return {
    accumulatorMs: 0,
    lastTimestampMs: null,
  };
}

export function updateFixedStepLoop(
  state: FixedStepLoopState,
  nowMs: number,
  options: FixedStepLoopOptions,
): FixedStepLoopResult {
  const stepDtMs = 1000 / options.tickRateHz;
  const nextState: FixedStepLoopState = { ...state };

  if (nextState.lastTimestampMs === null) {
    nextState.lastTimestampMs = nowMs;
    return { state: nextState, steps: 0, stepDtMs };
  }

  const deltaMs = Math.max(0, nowMs - nextState.lastTimestampMs);
  nextState.lastTimestampMs = nowMs;
  nextState.accumulatorMs += deltaMs;

  let steps = 0;
  while (nextState.accumulatorMs >= stepDtMs && steps < options.maxCatchUpSteps) {
    nextState.accumulatorMs -= stepDtMs;
    steps += 1;
  }

  if (steps === options.maxCatchUpSteps && nextState.accumulatorMs >= stepDtMs) {
    nextState.accumulatorMs = 0;
  }

  return { state: nextState, steps, stepDtMs };
}
