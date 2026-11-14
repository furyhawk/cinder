import powerUpData from '../data/powerups.json';
import { createRng } from './rng';

export const POWER_UP_TYPES = [
  'missile',
  'speed',
  'shield',
  'blaster',
  'surge',
  'health',
] as const;

export type PowerUpType = (typeof POWER_UP_TYPES)[number];
export type PowerUpSpawnType = PowerUpType | 'missiles' | 'shields';
export type PowerUpAxis = 'speed' | 'shields' | 'missiles' | 'blaster' | 'surge';

export interface PowerUpDefinition {
  type: PowerUpType;
  axis: PowerUpAxis | null;
  label: string;
  description: string;
  color: string;
}

export const POWER_UP_DEFINITIONS: readonly PowerUpDefinition[] =
  powerUpData as unknown as readonly PowerUpDefinition[];

export const POWER_UP_DROP_EVERY_KILLS = 4;
export const POWER_UP_LIFETIME_MS = 14000;
export const POWER_UP_MAGNET_RADIUS = 120;
export const POWER_UP_MAGNET_SPEED = 280;

/** Accept both player-facing singular names and the fixed-axis plural names. */
export function normalizePowerUpType(type: PowerUpSpawnType): PowerUpType {
  if (type === 'missiles') return 'missile';
  if (type === 'shields') return 'shield';
  return type;
}

export function powerUpDefinition(type: PowerUpSpawnType): PowerUpDefinition {
  const normalized = normalizePowerUpType(type);
  const definition = POWER_UP_DEFINITIONS.find((entry) => entry.type === normalized);
  if (!definition) {
    throw new Error(`Unknown power-up type: ${type}`);
  }
  return definition;
}

/**
 * Power-ups drop from every fourth kill, with the first kill guaranteed to be
 * a missile so the secondary weapon is introduced early. The type of later
 * drops is chosen deterministically from the run seed.
 */
export function powerUpDropForKill(
  seed: string,
  tick: number,
  killCount: number,
): PowerUpType | null {
  if (killCount === 1) return 'missile';
  if (killCount <= 0 || killCount % POWER_UP_DROP_EVERY_KILLS !== 0) return null;

  const rng = createRng(`${seed}:${tick}:${killCount}`, 'powerup');
  return POWER_UP_TYPES[rng.nextInt(0, POWER_UP_TYPES.length - 1)];
}
