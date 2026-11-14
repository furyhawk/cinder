import { describe, expect, it } from 'vitest';
import {
  cameraTraumaForSimEvent,
  particlesForSimEvent,
} from '../../src/render/effects';
import type { SimEvent } from '../../src/sim/world';

function event(
  type: SimEvent['type'],
  tick = 1,
  x = 100,
  y = 200,
  data?: SimEvent['data'],
): SimEvent {
  return { type, tick, x, y, data };
}

describe('event-driven visual effects', () => {
  it('creates deterministic enemy death and power-up bursts', () => {
    const death = particlesForSimEvent(event('enemy_died', 5, 120, 240, { kind: 'bomber' }));
    const repeat = particlesForSimEvent(event('enemy_died', 5, 120, 240, { kind: 'bomber' }));
    const powerUp = particlesForSimEvent(event('powerup_collected', 7, 50, 60, { powerUp: 'health' }));

    expect(death.length).toBeGreaterThan(10);
    expect(death).toEqual(repeat);
    expect(death[0]).toMatchObject({ x: 120, y: 240, color: '#fb923c' });
    expect(powerUp.length).toBeGreaterThan(10);
    expect(powerUp[0].color).toBe('#fb7185');
  });

  it('covers combat, missile, boss, and arena effect events', () => {
    expect(particlesForSimEvent(event('player_fire')).length).toBeGreaterThan(0);
    expect(particlesForSimEvent(event('missile_fire', 1, 10, 20, { count: 4 })).length).toBeGreaterThan(6);
    expect(particlesForSimEvent(event('player_hit')).length).toBeGreaterThan(0);
    expect(particlesForSimEvent(event('surge_used')).length).toBeGreaterThan(0);
    expect(particlesForSimEvent(event('boss_module_destroyed')).length).toBeGreaterThan(0);
    expect(particlesForSimEvent(event('arena_mutate', 1, 0, 0, { phase: 'mutated' })).length).toBeGreaterThan(0);
    expect(particlesForSimEvent(event('arena_mutate', 1, 0, 0, { phase: 'telegraph' }))).toEqual([]);
  });

  it('maps camera trauma only for impactful events', () => {
    expect(cameraTraumaForSimEvent(event('enemy_died'))).toBeGreaterThan(0);
    expect(cameraTraumaForSimEvent(event('boss_module_destroyed'))).toBeGreaterThan(0.4);
    expect(cameraTraumaForSimEvent(event('boss_warning', 1, 0, 0, { phase: 'warning' }))).toBeGreaterThan(0);
    expect(cameraTraumaForSimEvent(event('pickup'))).toBe(0);
  });
});
