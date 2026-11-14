import { describe, expect, it } from 'vitest';
import { isSimplePolygon } from '../../src/sim/arena/geometry';
import { foundryLayouts } from '../../src/sim/arena/layouts';
import { createMutationState, stepArenaMutation } from '../../src/sim/arena/mutate';
import { isMutationSafe } from '../../src/sim/arena/validate';

describe('arena invariants', () => {
  it('keeps all layouts as simple polygons', () => {
    for (const layout of foundryLayouts) {
      expect(isSimplePolygon(layout.polygon)).toBe(true);
    }
  });

  it('does not mutate while boss pattern is active', () => {
    let state = createMutationState('foundry_ring');
    for (let t = 0; t < 30; t += 1) {
      const result = stepArenaMutation(state, {
        dtMs: 1000,
        intervalMs: 22000,
        telegraphMs: 1200,
        bossPatternActive: true,
      });
      state = result.state;
      expect(result.didMutate).toBe(false);
    }
  });

  it('validates mutation safety against minimum reachable radius', () => {
    for (const layout of foundryLayouts) {
      expect(isMutationSafe(layout.polygon, 160)).toBe(true);
    }
  });
});
