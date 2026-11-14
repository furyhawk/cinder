import { describe, expect, it } from 'vitest';
import { createInputFrame, createWorld } from '../../src/sim/world';

describe('feel invariants', () => {
  it('reaches movement cap quickly and decelerates with friction', () => {
    const world = createWorld('feel-move', 'normal');

    for (let tick = 0; tick < 8; tick += 1) {
      world.step(createInputFrame(tick, { moveX: 1, moveY: 0 }));
    }
    const speedAtPeak = Math.hypot(world.state.player.vx, world.state.player.vy);
    expect(speedAtPeak).toBeGreaterThan(170);

    for (let tick = 8; tick < 16; tick += 1) {
      world.step(createInputFrame(tick, { moveX: 0, moveY: 0 }));
    }
    const speedAfterRelease = Math.hypot(world.state.player.vx, world.state.player.vy);
    expect(speedAfterRelease).toBeLessThan(speedAtPeak);
  });

  it('surge applies full i-frame window and cooldown rhythm', () => {
    const world = createWorld('feel-surge', 'normal');
    world.step(createInputFrame(0, { surge: true }));
    expect(world.state.player.invuln).toBeGreaterThan(120);
    expect(world.state.player.surgeCooldown).toBeGreaterThanOrEqual(420);
  });
});
