import { foundryLayouts } from './layouts';
import type { ArenaLayout } from './geometry';

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
  layouts?: ArenaLayout[];
  isLayoutSafe?: (layout: ArenaLayout) => boolean;
}

export interface MutationStepResult {
  state: MutationState;
  didTelegraph: boolean;
  didMutate: boolean;
  didBlock: boolean;
}

function pickNextLayout(currentLayoutId: string, layouts: ArenaLayout[]): ArenaLayout | null {
  if (layouts.length === 0) return null;
  const index = layouts.findIndex((layout) => layout.id === currentLayoutId);
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
  const layouts = input.layouts ?? foundryLayouts;
  const isSafe = input.isLayoutSafe ?? (() => true);
  let didTelegraph = false;
  let didMutate = false;
  let didBlock = false;

  if (input.bossPatternActive) {
    next.timerMs += input.dtMs;
    return { state: next, didTelegraph, didMutate, didBlock };
  }

  next.timerMs += input.dtMs;

  if (next.nextLayoutId === null && next.timerMs >= input.intervalMs - input.telegraphMs) {
    const candidate = pickNextLayout(next.currentLayoutId, layouts);
    if (candidate && !isSafe(candidate)) {
      // Safety invariant: never begin a telegraph for an arena shape that can
      // trap the player. Retry after a full interval instead.
      next.timerMs = 0;
      didBlock = true;
      return { state: next, didTelegraph, didMutate, didBlock };
    }
    next.nextLayoutId = candidate?.id ?? null;
    next.telegraphMsRemaining = input.telegraphMs;
    didTelegraph = next.nextLayoutId !== null;
  }

  if (next.nextLayoutId !== null) {
    next.telegraphMsRemaining = Math.max(0, next.telegraphMsRemaining - input.dtMs);
    if (next.telegraphMsRemaining === 0 && next.timerMs >= input.intervalMs) {
      const selected = layouts.find((layout) => layout.id === next.nextLayoutId);
      if (!selected || !isSafe(selected)) {
        next.nextLayoutId = null;
        next.timerMs = 0;
        didBlock = true;
        return { state: next, didTelegraph, didMutate, didBlock };
      }

      next.currentLayoutId = selected.id;
      next.nextLayoutId = null;
      next.timerMs = 0;
      didMutate = true;
    }
  }

  return { state: next, didTelegraph, didMutate, didBlock };
}
