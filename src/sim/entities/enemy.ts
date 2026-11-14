import type { EnemyType } from '../world';

export interface EnemyStepInput {
  kind: EnemyType;
  x: number;
  y: number;
  speed: number;
  seed: number;
  tick: number;
  playerX: number;
  playerY: number;
}

export interface EnemyStepOutput {
  vx: number;
  vy: number;
}

function normalize(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export function stepEnemyBehaviour(input: EnemyStepInput): EnemyStepOutput {
  const toPlayer = normalize(input.playerX - input.x, input.playerY - input.y);

  if (input.kind === 'drone') {
    return { vx: toPlayer.x * input.speed, vy: toPlayer.y * input.speed };
  }

  if (input.kind === 'runner') {
    return { vx: toPlayer.x * input.speed * 1.3, vy: toPlayer.y * input.speed * 1.3 };
  }

  if (input.kind === 'orbiter') {
    const angle = input.tick * 0.04 + input.seed * 0.00001;
    const targetX = input.playerX + Math.cos(angle) * 160;
    const targetY = input.playerY + Math.sin(angle) * 160;
    const toOrbit = normalize(targetX - input.x, targetY - input.y);
    return { vx: toOrbit.x * input.speed, vy: toOrbit.y * input.speed };
  }

  if (input.kind === 'charger') {
    return { vx: toPlayer.x * input.speed * 1.5, vy: toPlayer.y * input.speed * 1.5 };
  }

  if (input.kind === 'spinner') {
    return {
      vx: Math.cos(input.tick * 0.05 + input.seed) * 90,
      vy: Math.sin(input.tick * 0.05 + input.seed) * 90,
    };
  }

  if (input.kind === 'splitter') {
    return { vx: toPlayer.x * input.speed * 0.85, vy: toPlayer.y * input.speed * 0.85 };
  }

  // turret + lancer keep near-stationary and fire-driven behaviour.
  return { vx: 0, vy: 0 };
}

