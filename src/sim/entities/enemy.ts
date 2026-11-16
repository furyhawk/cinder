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

  if (input.kind === 'weaver') {
    const weave = Math.sin(input.tick * 0.075 + input.seed * 0.001);
    const sideX = -toPlayer.y;
    const sideY = toPlayer.x;
    return {
      vx: toPlayer.x * input.speed * 0.58 + sideX * input.speed * weave * 0.82,
      vy: toPlayer.y * input.speed * 0.58 + sideY * input.speed * weave * 0.82,
    };
  }

  if (input.kind === 'bomber') {
    const pulse = 0.72 + Math.sin(input.tick * 0.045 + input.seed * 0.002) * 0.28;
    return {
      vx: toPlayer.x * input.speed * pulse,
      vy: toPlayer.y * input.speed * pulse,
    };
  }

  if (input.kind === 'sentinel') {
    // Advance at a deliberate pace, then hold a mid-range firing line.
    const distance = Math.hypot(input.playerX - input.x, input.playerY - input.y);
    const advance = distance > 240 ? 1 : 0.16;
    return {
      vx: toPlayer.x * input.speed * advance,
      vy: toPlayer.y * input.speed * advance,
    };
  }

  if (input.kind === 'mortar') {
    // Keep artillery at range: back off when crowded and strafe at its ideal
    // firing distance.
    const dx = input.playerX - input.x;
    const dy = input.playerY - input.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 300) {
      return { vx: (-dx / distance) * input.speed, vy: (-dy / distance) * input.speed };
    }
    if (distance > 440) {
      return { vx: toPlayer.x * input.speed, vy: toPlayer.y * input.speed };
    }
    const strafeDirection = Math.sin(input.tick * 0.02 + input.seed * 0.001) >= 0 ? 1 : -1;
    return {
      vx: -toPlayer.y * input.speed * 0.65 * strafeDirection,
      vy: toPlayer.x * input.speed * 0.65 * strafeDirection,
    };
  }

  if (input.kind === 'juggernaut') {
    // A heavy bruiser that accelerates into close-range contact.
    const distance = Math.hypot(input.playerX - input.x, input.playerY - input.y);
    const pressure = distance < 260 ? 1.45 : 0.9;
    return {
      vx: toPlayer.x * input.speed * pressure,
      vy: toPlayer.y * input.speed * pressure,
    };
  }

  if (input.kind === 'brute') {
    // Relentless, slow pressure; speeds up for a short stomp when close.
    const distance = Math.hypot(input.playerX - input.x, input.playerY - input.y);
    const pressure = distance < 180 ? 1.25 : 0.82;
    return {
      vx: toPlayer.x * input.speed * pressure,
      vy: toPlayer.y * input.speed * pressure,
    };
  }

  if (input.kind === 'archer') {
    // Hold a precise firing lane at medium range and strafe while reloading.
    const distance = Math.hypot(input.playerX - input.x, input.playerY - input.y);
    const side = Math.sin(input.tick * 0.028 + input.seed * 0.001) >= 0 ? 1 : -1;
    const advance = distance > 390 ? 1 : distance < 250 ? -0.75 : 0;
    return {
      vx: toPlayer.x * input.speed * advance - toPlayer.y * input.speed * 0.42 * side,
      vy: toPlayer.y * input.speed * advance + toPlayer.x * input.speed * 0.42 * side,
    };
  }

  if (input.kind === 'shade') {
    // A fast flanker that oscillates across the player's facing direction.
    const weave = Math.sin(input.tick * 0.095 + input.seed * 0.002);
    const sideX = -toPlayer.y;
    const sideY = toPlayer.x;
    return {
      vx: toPlayer.x * input.speed * 0.72 + sideX * input.speed * weave * 0.95,
      vy: toPlayer.y * input.speed * 0.72 + sideY * input.speed * weave * 0.95,
    };
  }

  if (input.kind === 'prism') {
    // A slow ranged platform that drifts sideways but never closes in.
    const side = Math.sin(input.tick * 0.018 + input.seed * 0.001) >= 0 ? 1 : -1;
    return {
      vx: -toPlayer.y * input.speed * side,
      vy: toPlayer.x * input.speed * side,
    };
  }

  if (input.kind === 'marauder') {
    // Aggressive strafing skirmisher with a close-range shotgun.
    const distance = Math.hypot(input.playerX - input.x, input.playerY - input.y);
    const side = Math.sin(input.tick * 0.04 + input.seed * 0.001) >= 0 ? 1 : -1;
    const advance = distance > 250 ? 1 : 0.2;
    return {
      vx: toPlayer.x * input.speed * advance - toPlayer.y * input.speed * 0.48 * side,
      vy: toPlayer.y * input.speed * advance + toPlayer.x * input.speed * 0.48 * side,
    };
  }

  if (input.kind === 'voidling') {
    // A patient caster that circles at a safe distance.
    const orbit = input.tick * 0.025 + input.seed * 0.001;
    const targetX = input.playerX + Math.cos(orbit) * 270;
    const targetY = input.playerY + Math.sin(orbit) * 270;
    const toOrbit = normalize(targetX - input.x, targetY - input.y);
    return { vx: toOrbit.x * input.speed, vy: toOrbit.y * input.speed };
  }

  // turret + lancer keep near-stationary and fire-driven behaviour.
  return { vx: 0, vy: 0 };
}

