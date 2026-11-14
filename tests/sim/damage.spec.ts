import { describe, expect, it } from 'vitest';
import { damage } from '../../src/sim/systems/damage';

describe('damage pipeline', () => {
  it('handles overkill by clamping to zero hp', () => {
    const target = { hp: 10, invulnerableTicks: 0 };
    const result = damage(target, 999, 'test', 'projectile');

    expect(result.killed).toBe(true);
    expect(target.hp).toBe(0);
  });

  it('ignores damage while invulnerable', () => {
    const target = { hp: 10, invulnerableTicks: 3 };
    const result = damage(target, 4, 'test', 'contact');

    expect(result.applied).toBe(false);
    expect(target.hp).toBe(10);
  });

  it('supports simultaneous mutual kill semantics in sequence', () => {
    const a = { hp: 5, invulnerableTicks: 0 };
    const b = { hp: 5, invulnerableTicks: 0 };

    const aHit = damage(a, 5, 'b', 'self');
    const bHit = damage(b, 5, 'a', 'self');

    expect(aHit.killed).toBe(true);
    expect(bHit.killed).toBe(true);
  });
});
