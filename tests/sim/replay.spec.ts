import { describe, expect, it } from 'vitest';
import { createInputFrame } from '../../src/sim/world';
import { recordReplay } from '../../src/sim/replay';

describe('replay', () => {
  it('produces identical hashes across identical replays', () => {
    const inputs = Array.from({ length: 120 }, (_, tick) =>
      createInputFrame(tick, {
        moveX: (tick % 3) / 2 - 0.5,
        moveY: ((tick + 1) % 4) / 3 - 0.5,
        fire: tick % 11 === 0,
        surge: tick % 17 === 0,
      }),
    );

    const first = recordReplay('dot-seed', inputs);
    const second = recordReplay('dot-seed', inputs);
    const third = recordReplay('dot-seed', inputs);

    expect(first.hashes).toEqual(second.hashes);
    expect(second.hashes).toEqual(third.hashes);
  });
});
