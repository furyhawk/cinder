import { describe, expect, it } from 'vitest';
import { stepEnemyBehaviour } from '../../src/sim/entities/enemy';
import type { EnemyType } from '../../src/sim/world';

const kinds: EnemyType[] = [
  'drone',
  'runner',
  'orbiter',
  'charger',
  'turret',
  'spinner',
  'splitter',
  'lancer',
  'weaver',
  'bomber',
];

describe('enemy behaviour determinism', () => {
  it('returns deterministic output for each archetype with fixed seed/tick', () => {
    for (const kind of kinds) {
      const first = stepEnemyBehaviour({
        kind,
        x: 100,
        y: 120,
        speed: 150,
        seed: 4242,
        tick: 180,
        playerX: 640,
        playerY: 360,
      });
      const second = stepEnemyBehaviour({
        kind,
        x: 100,
        y: 120,
        speed: 150,
        seed: 4242,
        tick: 180,
        playerX: 640,
        playerY: 360,
      });
      expect(first).toEqual(second);
    }
  });
});
