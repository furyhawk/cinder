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

  it('moves particles and expires them over time', () => {
    const pool = new ParticlePool(10);
    pool.add({ x: 0, y: 0, vx: 100, vy: 0, life: 100, size: 2, color: '#fff' });
    pool.step(50);
    const particle = pool.getParticles()[0];
    expect(particle.x).toBeGreaterThan(0);
    expect(pool.count()).toBe(1);
    pool.step(60);
    expect(pool.count()).toBe(0);
  });
});
