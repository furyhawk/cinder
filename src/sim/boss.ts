import { validateBossArc } from '../data/validate/bossArc';

export interface BossModuleSpec {
  id: string;
  offset: [number, number];
  radius: number;
  hp: number;
  exposesDuringPattern?: string;
}

export interface BossProjectileGroupSpec {
  count: number;
  speed: number;
  spreadDeg: number;
  pattern: 'fan' | 'ring' | 'spiral' | 'aimed';
  damage: number;
}

export interface BossPatternSpec {
  id: string;
  durationMs: number;
  telegraphMs: number;
  vulnerableWindowMs: number;
  projectiles: BossProjectileGroupSpec[];
  movement: 'drift' | 'stationary' | 'reposition';
}

export interface BossSpec {
  id: string;
  generation: 1 | 2;
  displayName?: string;
  coreHp?: number;
  modules: BossModuleSpec[];
  patterns: BossPatternSpec[];
  phaseThresholds: number[];
  arenaLock?: string;
}

export interface BossModuleState {
  id: string;
  offsetX: number;
  offsetY: number;
  radius: number;
  hp: number;
  maxHp: number;
  exposed: boolean;
  destroyed: boolean;
  exposesDuringPattern?: string;
}

export type BossPatternPhase = 'telegraph' | 'active' | 'vulnerable';

export interface BossRuntimeState {
  specId: string;
  generation: 1 | 2;
  displayName?: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  hp: number;
  maxHp: number;
  phase: number;
  patternIndex: number;
  patternId: string;
  patternPhase: BossPatternPhase;
  phaseRemainingMs: number;
  volleyTimerMs: number;
  volleysFired: number;
  modules: BossModuleState[];
}

export interface BossStepInput {
  dtMs: number;
  tick: number;
  playerX: number;
  playerY: number;
}

export interface BossShot {
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  speed: number;
  damage: number;
  radius: number;
}

export type BossRuntimeEvent =
  | { type: 'boss_phase'; phase: number; hpFraction: number }
  | { type: 'boss_pattern'; patternId: string; phase: BossPatternPhase }
  | { type: 'boss_module_exposed'; moduleId: string; exposed: boolean }
  | { type: 'boss_module_destroyed'; moduleId: string };

export interface BossStepOutput {
  state: BossRuntimeState;
  events: BossRuntimeEvent[];
  shots: BossShot[];
}

export interface BossDamageResult {
  state: BossRuntimeState;
  dealt: number;
  targetModuleId: string | null;
  destroyedModuleId: string | null;
  defeated: boolean;
}

/** Damage multiplier on the core while intact modules are available to shoot. */
export const CORE_ARMOR_MULTIPLIER = 0.3;
const SPIRAL_VOLLEY_INTERVAL_MS = 180;
const BOSS_RADIUS = 62;
const BOSS_BASE_X = 640;
const BOSS_BASE_Y = 210;

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function cloneState(state: BossRuntimeState): BossRuntimeState {
  return {
    ...state,
    modules: state.modules.map((module) => ({ ...module })),
  };
}

export function phaseForHpFraction(thresholds: number[], fraction: number): number {
  let phase = 1;
  for (const threshold of thresholds) {
    if (fraction <= threshold) phase += 1;
  }
  return phase;
}

export function createBossRuntime(
  spec: BossSpec,
  options: {
    x?: number;
    y?: number;
    hpScale?: number;
  } = {},
): BossRuntimeState {
  const validation = validateBossArc(spec);
  if (!validation.ok) {
    throw new Error(`Invalid boss arc for ${spec.id}: ${validation.errors.join(' ')}`);
  }

  const hpScale = options.hpScale ?? 1;
  const coreHp = (spec.coreHp ?? 240) * hpScale;
  const baseX = options.x ?? BOSS_BASE_X;
  const baseY = options.y ?? BOSS_BASE_Y;

  return {
    specId: spec.id,
    generation: spec.generation,
    displayName: spec.displayName ?? spec.id.toUpperCase(),
    x: baseX,
    y: baseY,
    baseX,
    baseY,
    radius: BOSS_RADIUS,
    hp: coreHp,
    maxHp: coreHp,
    phase: 1,
    patternIndex: 0,
    patternId: spec.patterns[0]?.id ?? 'none',
    patternPhase: 'telegraph',
    phaseRemainingMs: spec.patterns[0]?.telegraphMs ?? 0,
    volleyTimerMs: 0,
    volleysFired: 0,
    modules: spec.modules
      .filter((module) => module.hp > 0 && module.id !== 'core')
      .map((module) => ({
        id: module.id,
        offsetX: module.offset[0],
        offsetY: module.offset[1],
        radius: module.radius,
        hp: module.hp * hpScale,
        maxHp: module.hp * hpScale,
        exposed: false,
        destroyed: false,
        exposesDuringPattern: module.exposesDuringPattern,
      })),
  };
}

function currentPattern(state: BossRuntimeState, spec: BossSpec): BossPatternSpec {
  return spec.patterns[state.patternIndex % spec.patterns.length];
}

function updateMovement(
  state: BossRuntimeState,
  pattern: BossPatternSpec,
  input: BossStepInput,
): void {
  if (pattern.movement === 'stationary') {
    state.x = state.baseX;
    state.y = state.baseY;
    return;
  }

  if (pattern.movement === 'drift') {
    state.x = state.baseX + Math.sin(input.tick * 0.03) * 36;
    state.y = state.baseY + Math.cos(input.tick * 0.021) * 16;
    return;
  }

  const direction = normalize(input.playerX - state.x, input.playerY - state.y);
  state.x = clamp(state.x + direction.x * 46 * (input.dtMs / 1000), 160, 1120);
  state.y = clamp(state.y + direction.y * 46 * (input.dtMs / 1000), 130, 340);
}

function pushGroupShots(
  state: BossRuntimeState,
  pattern: BossPatternSpec,
  input: BossStepInput,
  shots: BossShot[],
): void {
  const aimAngle = Math.atan2(input.playerY - state.y, input.playerX - state.x);
  const speedScale = 1 + (state.phase - 1) * 0.06;

  for (const group of pattern.projectiles) {
    if (group.pattern === 'spiral') continue;
    const count = Math.max(1, group.count);

    for (let index = 0; index < count; index += 1) {
      let angle: number;
      if (group.pattern === 'ring') {
        angle = (Math.PI * 2 * index) / count + input.tick * 0.01;
      } else if (group.pattern === 'fan') {
        const t = count === 1 ? 0.5 : index / (count - 1);
        angle = aimAngle + degreesToRadians((t - 0.5) * group.spreadDeg);
      } else {
        const t = count === 1 ? 0.5 : index / (count - 1);
        angle = aimAngle + degreesToRadians((t - 0.5) * group.spreadDeg);
      }

      shots.push({
        x: state.x,
        y: state.y,
        directionX: Math.cos(angle),
        directionY: Math.sin(angle),
        speed: group.speed * speedScale,
        damage: group.damage,
        radius: 5,
      });
    }
  }
}

function pushSpiralVolley(state: BossRuntimeState, pattern: BossPatternSpec, shots: BossShot[]): void {
  const speedScale = 1 + (state.phase - 1) * 0.06;
  for (const group of pattern.projectiles) {
    if (group.pattern !== 'spiral') continue;
    const volleyCount = Math.max(1, Math.ceil(group.count / 10));
    for (let index = 0; index < volleyCount; index += 1) {
      const angle = state.volleysFired * 0.48 + index * 0.62 + state.generation * 0.2;
      shots.push({
        x: state.x,
        y: state.y,
        directionX: Math.cos(angle),
        directionY: Math.sin(angle),
        speed: group.speed * speedScale,
        damage: group.damage,
        radius: 5,
      });
    }
  }
}

function setModuleExposure(
  state: BossRuntimeState,
  pattern: BossPatternSpec,
  exposed: boolean,
  events: BossRuntimeEvent[],
): void {
  for (const module of state.modules) {
    if (module.destroyed) continue;
    if (module.exposesDuringPattern !== pattern.id) continue;
    if (module.exposed === exposed) continue;
    module.exposed = exposed;
    events.push({ type: 'boss_module_exposed', moduleId: module.id, exposed });
  }
}

export function stepBossRuntime(
  current: BossRuntimeState,
  spec: BossSpec,
  input: BossStepInput,
): BossStepOutput {
  const state = cloneState(current);
  const events: BossRuntimeEvent[] = [];
  const shots: BossShot[] = [];
  const pattern = currentPattern(state, spec);
  state.patternId = pattern.id;

  updateMovement(state, pattern, input);

  const previousPhase = state.phase;
  const hpFraction = state.maxHp > 0 ? state.hp / state.maxHp : 0;
  state.phase = phaseForHpFraction(spec.phaseThresholds, hpFraction);
  if (state.phase !== previousPhase) {
    events.push({ type: 'boss_phase', phase: state.phase, hpFraction });
  }

  state.phaseRemainingMs -= input.dtMs;
  state.volleyTimerMs = Math.max(0, state.volleyTimerMs - input.dtMs);

  if (state.patternPhase === 'telegraph') {
    if (state.phaseRemainingMs <= 0) {
      state.patternPhase = 'active';
      state.phaseRemainingMs += pattern.durationMs - pattern.telegraphMs;
      state.volleysFired = 0;
      state.volleyTimerMs = 0;
      events.push({ type: 'boss_pattern', patternId: pattern.id, phase: 'active' });
      pushGroupShots(state, pattern, input, shots);
      if (pattern.projectiles.some((group) => group.pattern === 'spiral')) {
        pushSpiralVolley(state, pattern, shots);
        state.volleysFired += 1;
        state.volleyTimerMs = SPIRAL_VOLLEY_INTERVAL_MS;
      }
    }
  } else if (state.patternPhase === 'active') {
    if (pattern.projectiles.some((group) => group.pattern === 'spiral') && state.volleyTimerMs <= 0) {
      pushSpiralVolley(state, pattern, shots);
      state.volleysFired += 1;
      state.volleyTimerMs = SPIRAL_VOLLEY_INTERVAL_MS;
    }

    if (state.phaseRemainingMs <= 0) {
      state.patternPhase = 'vulnerable';
      state.phaseRemainingMs += pattern.vulnerableWindowMs;
      events.push({ type: 'boss_pattern', patternId: pattern.id, phase: 'vulnerable' });
      setModuleExposure(state, pattern, true, events);
    }
  } else if (state.phaseRemainingMs <= 0) {
    setModuleExposure(state, pattern, false, events);
    state.patternIndex = (state.patternIndex + 1) % spec.patterns.length;
    const nextPattern = currentPattern(state, spec);
    state.patternId = nextPattern.id;
    state.patternPhase = 'telegraph';
    state.phaseRemainingMs = nextPattern.telegraphMs;
    state.volleyTimerMs = 0;
    events.push({ type: 'boss_pattern', patternId: nextPattern.id, phase: 'telegraph' });
  }

  return { state, events, shots };
}

/**
 * Routes player damage to an exposed module when one exists, otherwise to the
 * armoured core. Destroying every module removes the core armour.
 */
export function damageBossRuntime(
  current: BossRuntimeState,
  amount: number,
  impactX: number,
  impactY: number,
): BossDamageResult {
  const state = cloneState(current);
  const exposed = state.modules.filter((module) => module.exposed && !module.destroyed);

  let targetModuleId: string | null = null;
  let destroyedModuleId: string | null = null;
  let dealt = 0;

  if (exposed.length > 0) {
    let target = exposed[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const module of exposed) {
      const dx = state.x + module.offsetX - impactX;
      const dy = state.y + module.offsetY - impactY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        target = module;
        bestDistance = distance;
      }
    }

    const before = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    dealt = Math.min(before, amount);
    targetModuleId = target.id;

    if (target.hp <= 0) {
      target.destroyed = true;
      target.exposed = false;
      destroyedModuleId = target.id;
    }
  } else {
    const armour = state.modules.every((module) => module.destroyed)
      ? 1
      : CORE_ARMOR_MULTIPLIER;
    const before = state.hp;
    state.hp = Math.max(0, state.hp - amount * armour);
    dealt = Math.min(before, amount * armour);
  }

  return {
    state,
    dealt,
    targetModuleId,
    destroyedModuleId,
    defeated: state.hp <= 0,
  };
}
