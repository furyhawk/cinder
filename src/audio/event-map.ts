import type { SimEvent } from '../sim/world';
import type { SoundEffect } from './sfx';

export function soundForSimEvent(event: SimEvent): SoundEffect | null {
  switch (event.type) {
    case 'player_fire':
      return 'player_fire';
    case 'missile_fire':
      return 'missile_fire';
    case 'enemy_hit':
      return 'enemy_hit';
    case 'enemy_died':
      return 'enemy_died';
    case 'player_hit':
      return 'player_hit';
    case 'surge_used':
      return 'surge';
    case 'pickup':
      return 'pickup';
    case 'powerup_collected':
      return 'powerup';
    case 'powerup_dropped':
      return 'powerup_drop';
    case 'wave_break':
      return 'wave_clear';
    case 'stage_clear':
      return 'wave_clear';
    case 'stage_transition':
      return event.data?.phase === 'complete' ? 'wave_start' : null;
    case 'mini_wave':
      // The first mini-wave is announced by the normal wave transition.
      // Later groups get their own lightweight spawn cue.
      return event.data?.phase === 'started' && Number(event.data?.miniWave ?? 1) > 1
        ? 'wave_start'
        : null;
    case 'boss_warning':
      return 'boss_warning';
    case 'boss_phase':
      return 'boss_phase';
    case 'boss_pattern': {
      const phase = String(event.data?.phase ?? '');
      if (phase === 'telegraph') return 'boss_telegraph';
      if (phase === 'vulnerable') return 'boss_vulnerable';
      return 'boss_attack';
    }
    case 'boss_hit':
      return 'boss_hit';
    case 'boss_module_exposed':
      return Number(event.data?.exposed ?? 0) > 0 ? 'module_exposed' : null;
    case 'boss_module_destroyed':
      return 'module_destroyed';
    case 'arena_mutate': {
      const phase = String(event.data?.phase ?? '');
      if (phase === 'telegraph') return 'arena_telegraph';
      if (phase === 'mutated') return 'arena_mutated';
      return null;
    }
    case 'run_ended':
      return event.data?.outcome === 'victory' ? 'victory' : 'defeat';
    case 'upgrade_offered':
    case 'card_offered':
      return 'card_offer';
    default:
      return null;
  }
}
