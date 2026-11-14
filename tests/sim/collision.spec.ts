import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import { broadphasePairs, bruteForcePairs, type CircleBody } from '../../src/sim/systems/collision';

function serializePairs(pairs: Array<{ a: number; b: number }>): string[] {
  return pairs
    .map((pair) => `${Math.min(pair.a, pair.b)}:${Math.max(pair.a, pair.b)}`)
    .sort();
}

describe('collision broadphase', () => {
  it('matches brute force overlap results across random fixtures', () => {
    const rng = createRng('collision-fixtures', 'spawn');

    for (let fixture = 0; fixture < 200; fixture += 1) {
      const bodies: CircleBody[] = [];
      for (let index = 0; index < 50; index += 1) {
        bodies.push({
          id: index,
          x: rng.nextFloat() * 1280,
          y: rng.nextFloat() * 720,
          radius: 4 + rng.nextFloat() * 20,
        });
      }

      const broadphase = serializePairs(broadphasePairs(bodies, 64));
      const bruteForce = serializePairs(bruteForcePairs(bodies));
      expect(broadphase).toEqual(bruteForce);
    }
  });
});
