import { describe, expect, it } from 'vitest';
import { soundForSimEvent } from '../../src/audio/event-map';
import type { SimEvent } from '../../src/sim/world';

function event(type: SimEvent['type'], data?: SimEvent['data']): SimEvent {
  return { type, tick: 1, data };
}

describe('audio event mapping', () => {
  it('maps combat and pickup events', () => {
    expect(soundForSimEvent(event('player_fire'))).toBe('player_fire');
    expect(soundForSimEvent(event('enemy_hit'))).toBe('enemy_hit');
    expect(soundForSimEvent(event('enemy_died'))).toBe('enemy_died');
    expect(soundForSimEvent(event('player_hit'))).toBe('player_hit');
    expect(soundForSimEvent(event('surge_used'))).toBe('surge');
    expect(soundForSimEvent(event('pickup'))).toBe('pickup');
  });

  it('maps boss pattern phases and module events', () => {
    expect(soundForSimEvent(event('boss_phase'))).toBe('boss_phase');
    expect(soundForSimEvent(event('boss_pattern', { phase: 'telegraph' }))).toBe('boss_telegraph');
    expect(soundForSimEvent(event('boss_pattern', { phase: 'active' }))).toBe('boss_attack');
    expect(soundForSimEvent(event('boss_pattern', { phase: 'vulnerable' }))).toBe('boss_vulnerable');
    expect(soundForSimEvent(event('boss_hit'))).toBe('boss_hit');
    expect(soundForSimEvent(event('boss_module_exposed', { exposed: 1 }))).toBe('module_exposed');
    expect(soundForSimEvent(event('boss_module_exposed', { exposed: 0 }))).toBeNull();
    expect(soundForSimEvent(event('boss_module_destroyed'))).toBe('module_destroyed');
  });

  it('maps arena and run-end events', () => {
    expect(soundForSimEvent(event('arena_mutate', { phase: 'telegraph' }))).toBe('arena_telegraph');
    expect(soundForSimEvent(event('arena_mutate', { phase: 'mutated' }))).toBe('arena_mutated');
    expect(soundForSimEvent(event('arena_mutate', { phase: 'blocked' }))).toBeNull();
    expect(soundForSimEvent(event('run_ended', { outcome: 'victory' }))).toBe('victory');
    expect(soundForSimEvent(event('run_ended', { outcome: 'defeat' }))).toBe('defeat');
    expect(soundForSimEvent(event('upgrade_offered'))).toBe('card_offer');
    expect(soundForSimEvent(event('card_offered'))).toBe('card_offer');
  });
});
