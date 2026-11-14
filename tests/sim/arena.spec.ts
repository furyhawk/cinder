import { describe, expect, it } from 'vitest';
import { isSimplePolygon } from '../../src/sim/arena/geometry';
import { foundryLayouts } from '../../src/sim/arena/layouts';
import { createMutationState, stepArenaMutation } from '../../src/sim/arena/mutate';
import { isMutationSafe, pointInPolygon } from '../../src/sim/arena/validate';
import { createInputFrame, createWorld } from '../../src/sim/world';

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

  it('keeps player inside active arena polygon while moving', () => {
    const world = createWorld('arena-bounds', 'normal');
    world.state.arena.currentLayoutId = 'foundry_cross';
    world.state.player.x = 122;
    world.state.player.y = 122;

    for (let tick = 0; tick < 120; tick += 1) {
      world.step(createInputFrame(tick, { moveX: -1, moveY: -1, aimX: 1, aimY: 0 }));
    }

    const polygon = foundryLayouts.find((layout) => layout.id === 'foundry_cross')!.polygon;
    expect(pointInPolygon([world.state.player.x, world.state.player.y], polygon)).toBe(true);
  });
});
