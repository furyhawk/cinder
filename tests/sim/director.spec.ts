import { describe, expect, it } from 'vitest';
import { planWaveSpawns } from '../../src/sim/systems/director';

describe('spawn director', () => {
  it('never exceeds threat budget', () => {
    const budget = 34;
    const plan = planWaveSpawns(
      budget,
      [
        { x: -80, y: 120 },
        { x: 1360, y: 220 },
        { x: 420, y: -80 },
      ],
      { x: 640, y: 360 },
    );

    const spent = plan.reduce((sum, entry) => sum + entry.threat, 0);
    expect(spent).toBeLessThanOrEqual(budget);
  });

  it('never spawns within 120px of the player and sets telegraph delay', () => {
    const plan = planWaveSpawns(
      12,
      [
        { x: 640, y: 360 },
        { x: 100, y: 100 },
        { x: 1180, y: 620 },
      ],
      { x: 640, y: 360 },
    );

    for (const entry of plan) {
      const dx = entry.point.x - 640;
      const dy = entry.point.y - 360;
      expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(120 * 120);
      expect(entry.delayMs).toBe(600);
    }
  });

  it('spreads consecutive spawns away from each other', () => {
    const plan = planWaveSpawns(
      12,
      [
        { x: 116, y: 116 },
        { x: 216, y: 116 },
        { x: 316, y: 116 },
        { x: 1116, y: 516 },
        { x: 1016, y: 516 },
      ],
      { x: 640, y: 360 },
    );

    expect(plan.length).toBeGreaterThanOrEqual(2);
    const first = plan[0].point;
    const second = plan[1].point;
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(500);
  });
});
