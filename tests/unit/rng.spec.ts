import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('rng', () => {
  it('repeats the same sequence for an identical seed and stream', () => {
    const first = createRng('cinder-seed', 'spawn');
    const second = createRng('cinder-seed', 'spawn');

    const firstValues = Array.from({ length: 1000 }, () => first.nextFloat());
    const secondValues = Array.from({ length: 1000 }, () => second.nextFloat());

    expect(firstValues).toEqual(secondValues);
  });

  it('keeps streams independent', () => {
    const spawn = createRng('cinder-seed', 'spawn');
    const cards = createRng('cinder-seed', 'cards');
    const spawnValues = Array.from({ length: 20 }, () => spawn.nextFloat());
    const cardsValues = Array.from({ length: 20 }, () => cards.nextFloat());
    const sameSpawn = createRng('cinder-seed', 'spawn');

    expect(Array.from({ length: 20 }, () => sameSpawn.nextFloat())).toEqual(spawnValues);
    expect(spawnValues).not.toEqual(cardsValues);
  });
});
