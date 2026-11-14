import type { SimEvent } from '../sim/world';
import type { Particle } from './particles';
import {
  ENEMY_COLORS,
  NEON,
  POWER_UP_COLORS,
  PROJECTILE_COLORS,
  withAlpha,
} from './theme';

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createParticleBurst(
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number,
  lifeMs: number,
  seed = 1,
): Particle[] {
  const particles: Particle[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / Math.max(1, count) + deterministicUnit(index, seed) * 0.45;
    const velocity = speed * (0.55 + deterministicUnit(index + 17, seed) * 0.7);
    const life = lifeMs * (0.7 + deterministicUnit(index + 31, seed) * 0.6);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life,
      maxLife: life,
      size: 1.5 + deterministicUnit(index + 43, seed) * 2.5,
      color,
      drag: 2.4,
    });
  }
  return particles;
}

/**
 * Converts authoritative simulation events into presentation-only particle
 * bursts. Keeping this mapper pure makes the effect coverage testable without
 * a canvas or audio context.
 */
export function particlesForSimEvent(event: SimEvent): Particle[] {
  const x = event.x ?? 0;
  const y = event.y ?? 0;

  switch (event.type) {
    case 'player_fire':
      return createParticleBurst(x, y, PROJECTILE_COLORS.player, 4, 70, 180, event.tick);
    case 'missile_fire':
      return createParticleBurst(
        x,
        y,
        NEON.amber,
        6 + Math.min(8, Number(event.data?.count ?? 1)),
        105,
        240,
        event.tick,
      );
    case 'enemy_hit':
      return createParticleBurst(
        x,
        y,
        ENEMY_COLORS[String(event.data?.kind ?? '')] ?? NEON.pinkBright,
        5,
        85,
        220,
        event.tick,
      );
    case 'enemy_died':
      return createParticleBurst(
        x,
        y,
        ENEMY_COLORS[String(event.data?.kind ?? '')] ?? NEON.red,
        14,
        150,
        480,
        event.tick,
      );
    case 'player_hit':
      return createParticleBurst(x, y, NEON.red, 12, 130, 420, event.tick);
    case 'surge_used':
      return createParticleBurst(x, y, NEON.cyanBright, 20, 210, 520, event.tick);
    case 'pickup':
      return createParticleBurst(x, y, NEON.green, 6, 85, 260, event.tick);
    case 'powerup_dropped':
      return createParticleBurst(
        x,
        y,
        POWER_UP_COLORS[String(event.data?.powerUp ?? '')] ?? NEON.white,
        10,
        110,
        360,
        event.tick,
      );
    case 'powerup_collected':
      return createParticleBurst(
        x,
        y,
        POWER_UP_COLORS[String(event.data?.powerUp ?? '')] ?? NEON.white,
        18,
        175,
        460,
        event.tick,
      );
    case 'boss_warning':
      return createParticleBurst(x, y, NEON.red, 22, 125, 700, event.tick);
    case 'boss_hit':
      return createParticleBurst(x, y, NEON.amber, 8, 120, 300, event.tick);
    case 'boss_module_destroyed':
      return createParticleBurst(x, y, NEON.orange, 28, 220, 750, event.tick);
    case 'arena_mutate':
      return event.data?.phase === 'mutated'
        ? createParticleBurst(x || 640, y || 360, withAlpha(NEON.amber, 0.92), 16, 130, 550, event.tick)
        : [];
    default:
      return [];
  }
}

export function cameraTraumaForSimEvent(event: SimEvent): number {
  switch (event.type) {
    case 'enemy_died':
      return 0.45;
    case 'player_hit':
      return 0.2;
    case 'powerup_collected':
      return 0.15;
    case 'boss_hit':
      return 0.08;
    case 'boss_module_destroyed':
      return 0.55;
    case 'boss_warning':
      return event.data?.phase === 'warning' ? 0.3 : 0.5;
    default:
      return 0;
  }
}
