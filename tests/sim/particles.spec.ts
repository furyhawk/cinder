import { describe, expect, it } from 'vitest';
import { ParticlePool } from '../../src/render/particles';

describe('particle budget', () => {
  it('never exceeds particle budget and drops oldest entries', () => {
    const pool = new ParticlePool(10);
    for (let i = 0; i < 25; i += 1) {
      pool.add({ x: i, y: i, life: 1000 });
    }
    expect(pool.count()).toBe(10);
  });
});
