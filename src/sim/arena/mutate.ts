import { foundryLayouts } from './layouts';

export interface MutationState {
  currentLayoutId: string;
  nextLayoutId: string | null;
  timerMs: number;
  telegraphMsRemaining: number;
}

export interface MutationStepInput {
  dtMs: number;
  intervalMs: number;
  telegraphMs: number;
  bossPatternActive: boolean;
}

export interface MutationStepResult {
  state: MutationState;
  didTelegraph: boolean;
  didMutate: boolean;
}

function pickNextLayout(currentLayoutId: string): string {
  const layouts = foundryLayouts.map((layout) => layout.id);
  const index = layouts.indexOf(currentLayoutId);
  return layouts[(index + 1 + layouts.length) % layouts.length];
}

export function createMutationState(initialLayoutId = 'foundry_ring'): MutationState {
  return {
    currentLayoutId: initialLayoutId,
    nextLayoutId: null,
    timerMs: 0,
    telegraphMsRemaining: 0,
  };
}

export function stepArenaMutation(
  state: MutationState,
  input: MutationStepInput,
): MutationStepResult {
  const next: MutationState = { ...state };
  let didTelegraph = false;
  let didMutate = false;

  if (input.bossPatternActive) {
    next.timerMs += input.dtMs;
    return { state: next, didTelegraph, didMutate };
  }

  next.timerMs += input.dtMs;
  if (next.nextLayoutId === null && next.timerMs >= input.intervalMs - input.telegraphMs) {
    next.nextLayoutId = pickNextLayout(next.currentLayoutId);
    next.telegraphMsRemaining = input.telegraphMs;
    didTelegraph = true;
  }

  if (next.nextLayoutId !== null) {
    next.telegraphMsRemaining = Math.max(0, next.telegraphMsRemaining - input.dtMs);
    if (next.telegraphMsRemaining === 0 && next.timerMs >= input.intervalMs) {
      next.currentLayoutId = next.nextLayoutId;
      next.nextLayoutId = null;
      next.timerMs = 0;
      didMutate = true;
    }
  }

  return { state: next, didTelegraph, didMutate };
}
