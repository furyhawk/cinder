import { createRng } from './rng';
import { createMutationState, stepArenaMutation, type MutationState } from './arena/mutate';
import { foundryLayouts } from './arena/layouts';
import { polygonBounds, type ArenaLayout, type Point } from './arena/geometry';
import {
  findSafeInteriorPoint,
  isMutationSafe,
  isPositionSafe,
  pointInPolygon,
  polygonCentroid,
} from './arena/validate';
import { stepEnemyBehaviour } from './entities/enemy';
import { planWaveSpawns } from './systems/director';
import { createChainState, onDamageTaken, onKill, stepChain, type ChainState } from './systems/chain';
import {
  normalizePowerUpType,
  powerUpDefinition,
  powerUpDropForKill,
  POWER_UP_LIFETIME_MS,
  POWER_UP_MAGNET_RADIUS,
  POWER_UP_MAGNET_SPEED,
  type PowerUpSpawnType,
  type PowerUpType,
} from './powerups';
import {
  createBossRuntime,
  damageBossRuntime,
  stepBossRuntime,
  type BossRuntimeState,
  type BossSpec,
} from './boss';
import wardenGen1 from '../data/boss.warden.json';
import wardenGen2 from '../data/boss.warden.gen2.json';
import forgeheart from '../data/boss.forgeheart.json';
import stageData from '../data/stages.json';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface StageDefinition {
  id: string;
  name: string;
  waveCount: number;
  bossId: string;
  bossName: string;
  /** Enemy archetypes the stage's spawn director may field. */
  enemyPool?: EnemyType[];
}

export const STAGE_DEFINITIONS: readonly StageDefinition[] =
  stageData as unknown as readonly StageDefinition[];
export const STAGE_COUNT = STAGE_DEFINITIONS.length;
/** Intermission between a cleared stage and the next stage's first wave. */
export const STAGE_TRANSITION_MS = 3500;

export const UPGRADE_AXES = ['speed', 'shields', 'missiles', 'blaster', 'surge'] as const;
export type UpgradeAxis = (typeof UPGRADE_AXES)[number];
export type UpgradeId = UpgradeAxis;

export interface UpgradeAxisDefinition {
  axis: UpgradeAxis;
  label: string;
  description: string;
}

export const UPGRADE_AXIS_DEFINITIONS: readonly UpgradeAxisDefinition[] = [
  { axis: 'speed', label: 'SPEED', description: '+20 move speed' },
  { axis: 'shields', label: 'SHIELDS', description: '+25 max HP and repair' },
  { axis: 'missiles', label: 'MISSILES', description: '+10 missile damage, +1 missile' },
  { axis: 'blaster', label: 'BLASTER', description: '+1.25 shots/sec, +6 damage' },
  { axis: 'surge', label: 'SURGE', description: '+12 surge damage, +25 dash' },
];

const UPGRADE_AXIS_COST: Record<UpgradeAxis, { base: number; step: number }> = {
  speed: { base: 6, step: 2 },
  shields: { base: 7, step: 2 },
  missiles: { base: 8, step: 2 },
  blaster: { base: 9, step: 2 },
  surge: { base: 10, step: 2 },
};

export function upgradeAxisCost(axis: UpgradeAxis, level: number): number {
  const cost = UPGRADE_AXIS_COST[axis];
  return cost.base + Math.max(0, level) * cost.step;
}

/** Number of missiles fired per volley at a given Missiles axis level. */
export function missileVolleySize(level: number): number {
  return Math.max(0, Math.floor(level));
}

/**
 * Foundry archetypes available from the start of the campaign. Stage two adds
 * Forge Core specialists on top of this pool.
 */
export const FOUNDRY_ENEMY_TYPES = [
  'drone',
  'runner',
  'orbiter',
  'turret',
  'spinner',
  'charger',
  'splitter',
  'lancer',
  'weaver',
  'bomber',
] as const;
export const FORGE_CORE_ENEMY_TYPES = [
  ...FOUNDRY_ENEMY_TYPES,
  'sentinel',
  'mortar',
  'juggernaut',
] as const;
export type EnemyType = (typeof FORGE_CORE_ENEMY_TYPES)[number];
const ENEMY_TYPE_SET: ReadonlySet<string> = new Set(FORGE_CORE_ENEMY_TYPES);
type DeckId = 'bulwark' | 'tempest';

interface CardEffects {
  moveSpeedMul: number;
  fireRateMul: number;
  surgeCooldownMul: number;
  bossDamageMul: number;
  contactDamageTakenMul: number;
  chainBonus: number;
  shockRingDamage: number;
  healOnSurge: number;
  surgeDamageMul: number;
  resetFireCooldown: boolean;
  reviveHp: number;
}

export interface InputFrame {
  tick: number;
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  fire: boolean;
  surge: boolean;
}

export interface SimEvent {
  type:
    | 'player_fire'
    | 'missile_fire'
    | 'enemy_hit'
    | 'enemy_died'
    | 'player_hit'
    | 'surge_used'
    | 'pickup'
    | 'boss_phase'
    | 'boss_pattern'
    | 'boss_hit'
    | 'boss_module_exposed'
    | 'boss_module_destroyed'
    | 'boss_warning'
    | 'stage_clear'
    | 'stage_transition'
    | 'wave_break'
    | 'mini_wave'
    | 'arena_mutate'
    | 'run_ended'
    | 'upgrade_offered'
    | 'card_offered'
    | 'powerup_dropped'
    | 'powerup_collected';
  tick: number;
  x?: number;
  y?: number;
  data?: Record<string, number | string>;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  fireCooldown: number;
  shotRate: number;
  projectileSpeed: number;
  projectileDamage: number;
  aimX: number;
  aimY: number;
  invuln: number;
  surgeCooldown: number;
  surgeTimer: number;
  surgeDamage: number;
  surgeDistance: number;
  shield: number;
  deck: DeckId;
  fireBufferMs: number;
  surgeBufferMs: number;
  missileDamage: number;
  missileCooldown: number;
}

export interface ProjectileState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  owner: 'player' | 'enemy' | 'boss';
  /** Presentation hint; never used for simulation decisions. */
  kind?: 'blaster' | 'missile' | 'enemy' | 'boss';
}

export interface EnemyState {
  id: number;
  kind: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  contactDamage: number;
  fireCooldown: number;
  seed: number;
  /** Remaining warning time before the enemy becomes active and dangerous. */
  spawnWarningMs?: number;
}

export type BossState = BossRuntimeState & { active: boolean };

export interface PickupState {
  id: number;
  x: number;
  y: number;
  value: number;
  radius: number;
  lifeMs: number;
}

export interface PowerUpState {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  radius: number;
  lifeMs: number;
}

export interface WorldState {
  tick: number;
  seed: string;
  difficulty: Difficulty;
  status: 'playing' | 'won' | 'lost';
  /** Next standard wave number, preserved for save/replay compatibility. */
  wave: number;
  waveTimer: number;
  /** Main wave currently being fought, or 0 before the first wave starts. */
  activeWave?: number;
  /** 1-based index of the mini-wave currently being fought. */
  miniWave?: number;
  /** Number of mini-waves that make up the active main wave. */
  miniWaveTotal?: number;
  /** Remaining pause between mini-waves; null when not between groups. */
  miniWaveBreakMs?: number | null;
  /** Full duration of the current mini-wave pause, for progress display. */
  miniWaveBreakTotalMs?: number;
  /** Threat budgets still queued for the active main wave. */
  miniWaveBudgets?: number[];
  /** Remaining inter-wave breathing room; null when the next wave is not in a break. */
  waveBreakMs: number | null;
  /** Full duration of the current inter-wave break, for progress display. */
  waveBreakTotalMs: number;
  /** Remaining time before the announced boss arrives; zero when inactive. */
  bossWarningMs: number;
  /** Full duration of the active boss announcement, for progress display. */
  bossWarningTotalMs: number;
  boss: BossState | null;
  /** 1-based campaign stage. Optional for save/replay compatibility. */
  stage?: number;
  /** Player-facing stage name, e.g. FOUNDRY or FORGEHEART. */
  stageName?: string;
  /** 1-based wave within the current stage. */
  stageWave?: number;
  /** Number of standard waves in the current stage. */
  stageWaveTotal?: number;
  /** Remaining inter-stage transition; zero when waves may spawn. */
  stageTransitionMs?: number;
  /** Full duration of the current inter-stage transition. */
  stageTransitionTotalMs?: number;
  /** Total bosses defeated in this run. */
  bossesDefeated?: number;
  /** True while an inter-stage transition is waiting to start its first wave. */
  stageAwaitingFirstWave?: boolean;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  pickups: PickupState[];
  powerUps: PowerUpState[];
  xp: number;
  pendingUpgrades: UpgradeAxis[];
  axisLevels: Record<UpgradeAxis, number>;
  killCount: number;
  score: number;
  rng: number;
  arena: MutationState;
  chain: ChainState;
  cardsOwned: string[];
  cardEffects: CardEffects;
  reviveUsed: boolean;
}

export interface WorldOptions {
  /** Test/tuning override for the arena mutation cadence. */
  arenaIntervalMs?: number;
  /** Test/tuning override for the telegraph lead time. */
  arenaTelegraphMs?: number;
  /** Minimum reachable radius a layout must have to be applied. */
  arenaMinRadius?: number;
  /** Alternate layout catalog (used by trap-state tests). */
  layouts?: ArenaLayout[];
  /** Test/tuning override for the boss arrival announcement duration. */
  bossWarningMs?: number;
  /** Test/tuning override for the inter-wave breathing room. */
  waveBreakMs?: number;
  /** Test/tuning override for the pause between mini-waves. */
  miniWaveBreakMs?: number;
  /** Number of mini-waves that make up each standard wave. */
  miniWavesPerWave?: number;
  /** Test/tuning override for the inter-stage transition. */
  stageTransitionMs?: number;
}

export interface World {
  state: WorldState;
  step(input: InputFrame): SimEvent[];
  hash(): string;
  applyUpgrade(id: UpgradeAxis): void;
  spawnPowerUp(type: PowerUpSpawnType, x: number, y: number): PowerUpState;
  collectPowerUp(index: number): boolean;
  setDeck(deck: DeckId): void;
  restart(): void;
}

const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 720;
const TICK_MS = 1000 / 60;
export const BOSS_SPAWN_X = ARENA_WIDTH / 2;
export const BOSS_SPAWN_Y = 210;
export const BOSS_WARNING_DURATION_MS = 5000;
export const WAVE_BREATHING_ROOM_MS = 4500;
/** Standard waves are split into this many smaller spawn groups. */
export const MINI_WAVES_PER_WAVE = 3;
/** Short beat between mini-waves so each new group gets a readable entrance. */
export const MINI_WAVE_BREAK_MS = 300;
const DEFAULT_ARENA_INTERVAL_MS = 22000;
const DEFAULT_ARENA_TELEGRAPH_MS = 1200;
const DEFAULT_ARENA_MIN_RADIUS = 160;
const RELOCATION_IFRAME_MS = 45;
const MAX_ENEMIES = 900;
const MAX_PROJECTILES = 1800;
const PROJECTILE_LIFE_MS = 2400;
export const ENEMY_SPAWN_WARNING_MS = 600;

const WARDEN_SPECS: Record<1 | 2, BossSpec> = {
  1: wardenGen1 as unknown as BossSpec,
  2: wardenGen2 as unknown as BossSpec,
};
const BOSS_SPECS_BY_ID: Record<string, BossSpec> = {
  forgeheart: forgeheart as unknown as BossSpec,
};

const difficultyConfig: Record<Difficulty, { hp: number; spawnRate: number; enemyMod: number }> = {
  easy: { hp: 1.1, spawnRate: 1.1, enemyMod: 0.9 },
  normal: { hp: 1, spawnRate: 1, enemyMod: 1 },
  hard: { hp: 1.2, spawnRate: 1.2, enemyMod: 1.2 },
};

const enemyDefinitions: Record<EnemyType, { radius: number; hp: number; speed: number; damage: number; fireRate: number }> = {
  drone: { radius: 12, hp: 18, speed: 120, damage: 12, fireRate: 0 },
  runner: { radius: 11, hp: 15, speed: 200, damage: 10, fireRate: 0 },
  orbiter: { radius: 13, hp: 22, speed: 150, damage: 12, fireRate: 0 },
  turret: { radius: 14, hp: 24, speed: 0, damage: 10, fireRate: 1.25 },
  spinner: { radius: 15, hp: 32, speed: 90, damage: 14, fireRate: 1.6 },
  charger: { radius: 16, hp: 28, speed: 110, damage: 18, fireRate: 0 },
  splitter: { radius: 18, hp: 26, speed: 100, damage: 12, fireRate: 0 },
  lancer: { radius: 14, hp: 20, speed: 170, damage: 14, fireRate: 1.1 },
  weaver: { radius: 13, hp: 18, speed: 165, damage: 11, fireRate: 0 },
  bomber: { radius: 19, hp: 42, speed: 95, damage: 20, fireRate: 0.48 },
  sentinel: { radius: 18, hp: 46, speed: 70, damage: 15, fireRate: 0.56 },
  mortar: { radius: 20, hp: 40, speed: 45, damage: 16, fireRate: 0.42 },
  juggernaut: { radius: 25, hp: 90, speed: 60, damage: 24, fireRate: 0.45 },
};

export function createInputFrame(
  tick: number,
  overrides: Partial<InputFrame> = {},
): InputFrame {
  return {
    tick,
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    fire: false,
    surge: false,
    ...overrides,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
}

function distanceSquaredToSegment(
  x: number,
  y: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) return distanceSquared(x, y, startX, startY);

  const projection = clamp(
    ((x - startX) * segmentX + (y - startY) * segmentY) / lengthSquared,
    0,
    1,
  );
  return distanceSquared(
    x,
    y,
    startX + segmentX * projection,
    startY + segmentY * projection,
  );
}

function normalize(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const body = sortedKeys
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',');
    return `{${body}}`;
  }

  return JSON.stringify(value);
}

function createInitialState(seed: string, difficulty: Difficulty, layouts: ArenaLayout[]): WorldState {
  const config = difficultyConfig[difficulty];
  return {
    tick: 0,
    seed,
    difficulty,
    status: 'playing',
    wave: 1,
    waveTimer: 0,
    activeWave: 0,
    miniWave: 0,
    miniWaveTotal: 0,
    miniWaveBreakMs: null,
    miniWaveBreakTotalMs: 0,
    miniWaveBudgets: [],
    waveBreakMs: null,
    waveBreakTotalMs: 0,
    bossWarningMs: 0,
    bossWarningTotalMs: 0,
    boss: null,
    stage: 1,
    stageName: STAGE_DEFINITIONS[0]?.name ?? 'FOUNDRY',
    stageWave: 1,
    stageWaveTotal: STAGE_DEFINITIONS[0]?.waveCount ?? 5,
    stageTransitionMs: 0,
    stageTransitionTotalMs: 0,
    bossesDefeated: 0,
    stageAwaitingFirstWave: false,
    player: {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      vx: 0,
      vy: 0,
      radius: 12,
      hp: 100 * config.hp,
      maxHp: 100 * config.hp,
      moveSpeed: 220,
      fireCooldown: 0,
      shotRate: 8.5,
      projectileSpeed: 900,
      projectileDamage: 22,
      aimX: 1,
      aimY: 0,
      invuln: 0,
      surgeCooldown: 0,
      surgeTimer: 0,
      surgeDamage: 24,
      surgeDistance: 110,
      shield: 0,
      deck: 'bulwark',
      fireBufferMs: 0,
      surgeBufferMs: 0,
      missileDamage: 0,
      missileCooldown: 0,
    },
    enemies: [],
    projectiles: [],
    pickups: [],
    powerUps: [],
    xp: 0,
    pendingUpgrades: [],
    axisLevels: {
      speed: 0,
      shields: 0,
      missiles: 0,
      blaster: 0,
      surge: 0,
    },
    killCount: 0,
    score: 0,
    rng: 0,
    arena: createMutationState(layouts[0]?.id ?? 'foundry_ring'),
    chain: createChainState(),
    cardsOwned: [],
    cardEffects: {
      moveSpeedMul: 0,
      fireRateMul: 0,
      surgeCooldownMul: 0,
      bossDamageMul: 0,
      contactDamageTakenMul: 0,
      chainBonus: 0,
      shockRingDamage: 0,
      healOnSurge: 0,
      surgeDamageMul: 0,
      resetFireCooldown: false,
      reviveHp: 0,
    },
    reviveUsed: false,
  };
}

function spawnProjectile(
  state: WorldState,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  speed: number,
  damage: number,
  owner: 'player' | 'enemy' | 'boss',
  radius = 4,
  kind: ProjectileState['kind'] = 'blaster',
): void {
  if (state.projectiles.length >= MAX_PROJECTILES) {
    state.projectiles.splice(0, state.projectiles.length - MAX_PROJECTILES + 1);
  }
  const length = Math.hypot(directionX, directionY) || 1;
  state.projectiles.push({
    x,
    y,
    vx: (directionX / length) * speed,
    vy: (directionY / length) * speed,
    radius,
    damage,
    life: PROJECTILE_LIFE_MS,
    owner,
    kind,
  });
}

function createEnemy(
  state: WorldState,
  type: EnemyType,
  x: number,
  y: number,
  spawnWarningMs = 0,
): EnemyState {
  const spawnIndex = state.enemies.length;
  const rng = createRng(
    `${state.seed}:${state.wave}:${state.tick}:${spawnIndex}`,
    'spawn',
  );
  const def = enemyDefinitions[type];
  return {
    id: state.tick * 100 + spawnIndex + 1,
    kind: type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hp * difficultyConfig[state.difficulty].hp,
    maxHp: def.hp * difficultyConfig[state.difficulty].hp,
    speed: def.speed * difficultyConfig[state.difficulty].enemyMod,
    contactDamage: def.damage,
    fireCooldown: rng.nextInt(0, 120),
    seed: rng.nextInt(0, 999999),
    spawnWarningMs,
  };
}

function interiorSpawnPoints(polygon: Point[], clearance: number): Array<{ x: number; y: number }> {
  const bounds = polygonBounds(polygon);
  const points: Array<{ x: number; y: number }> = [];
  const step = 100;
  const inset = clearance + 8;

  for (let y = bounds.minY + inset; y <= bounds.maxY - inset; y += step) {
    for (let x = bounds.minX + inset; x <= bounds.maxX - inset; x += step) {
      if (isPositionSafe([x, y], polygon, clearance)) {
        points.push({ x, y });
      }
    }
  }

  if (points.length > 0) return points;

  const centroid = polygonCentroid(polygon);
  const fallback = findSafeInteriorPoint(polygon, centroid, clearance);
  return [{ x: fallback[0], y: fallback[1] }];
}

function waveThreatBudget(waveNumber: number): number {
  return clamp(2 + waveNumber * 4, 6, 34);
}

/**
 * Split a wave's threat budget into deterministic, nearly equal mini-wave
 * shares. The returned entries always sum to totalBudget (integer input) and
 * no share is zero when the budget can support the requested group count.
 */
export function splitWaveThreatBudget(
  totalBudget: number,
  groupCount: number,
): number[] {
  const total = Number.isFinite(totalBudget)
    ? Math.max(0, Math.floor(totalBudget))
    : 0;
  const desiredGroups = Number.isFinite(groupCount)
    ? Math.max(1, Math.floor(groupCount))
    : 1;
  const groups = Math.max(1, Math.min(desiredGroups, Math.max(1, total)));
  const base = Math.floor(total / groups);
  const remainder = total % groups;
  return Array.from({ length: groups }, (_, index) => base + (index < remainder ? 1 : 0));
}

function spawnMiniWave(
  state: WorldState,
  waveNumber: number,
  threatBudget: number,
  miniWaveIndex: number,
  miniWaveTotal: number,
  polygon: Point[],
  events: SimEvent[],
  minimumSpawns: number,
  enemyTypes: readonly EnemyType[],
): void {
  if (threatBudget <= 0) return;

  const spawnPoints = interiorSpawnPoints(polygon, 28);
  const plan = planWaveSpawns(
    threatBudget,
    spawnPoints,
    { x: state.player.x, y: state.player.y },
    minimumSpawns,
    enemyTypes,
  );

  for (const entry of plan) {
    if (state.enemies.length >= MAX_ENEMIES) break;
    state.enemies.push(
      createEnemy(
        state,
        entry.type,
        entry.point.x,
        entry.point.y,
        entry.delayMs,
      ),
    );
  }

  events.push({
    type: 'mini_wave',
    tick: state.tick,
    data: {
      phase: 'started',
      wave: waveNumber,
      miniWave: miniWaveIndex,
      total: miniWaveTotal,
      threatBudget,
    },
  });
}

function beginWave(
  state: WorldState,
  waveNumber: number,
  polygon: Point[],
  miniWavesPerWave: number,
  events: SimEvent[],
): void {
  const budgets = splitWaveThreatBudget(
    waveThreatBudget(waveNumber),
    miniWavesPerWave,
  );
  state.activeWave = waveNumber;
  state.stageAwaitingFirstWave = false;
  state.miniWave = 1;
  state.miniWaveTotal = budgets.length;
  state.miniWaveBudgets = budgets.slice(1);
  state.miniWaveBreakMs = null;
  state.miniWaveBreakTotalMs = 0;
  const minimumSpawns = budgets.length > 1 ? 2 : 1;
  spawnMiniWave(
    state,
    waveNumber,
    budgets[0] ?? 0,
    1,
    budgets.length,
    polygon,
    events,
    minimumSpawns,
    enemyTypesForStage(state.stage ?? 1),
  );
}

function hasPendingMiniWaves(state: WorldState): boolean {
  return (state.miniWaveBudgets?.length ?? 0) > 0;
}

function spawnNextMiniWave(
  state: WorldState,
  polygon: Point[],
  events: SimEvent[],
): boolean {
  if (!hasPendingMiniWaves(state)) return false;

  const nextBudget = state.miniWaveBudgets!.shift()!;
  state.miniWave = (state.miniWave ?? 0) + 1;
  spawnMiniWave(
    state,
    state.activeWave ?? state.wave,
    nextBudget,
    state.miniWave,
    state.miniWaveTotal ?? state.miniWave,
    polygon,
    events,
    (state.miniWaveTotal ?? 1) > 1 ? 2 : 1,
    enemyTypesForStage(state.stage ?? 1),
  );
  return true;
}

function spawnXpPickup(state: WorldState, x: number, y: number): void {
  state.pickups.push({
    id: state.tick * 1000 + state.pickups.length + 1,
    x,
    y,
    value: 4,
    radius: 7,
    lifeMs: 12000,
  });
}

function spawnPowerUp(
  state: WorldState,
  type: PowerUpSpawnType,
  x: number,
  y: number,
): PowerUpState {
  const normalized = normalizePowerUpType(type);
  // Validate against content data so a typo can never create an inert pickup.
  powerUpDefinition(normalized);
  const powerUp: PowerUpState = {
    id: state.tick * 10000 + state.powerUps.length + 1,
    type: normalized,
    x,
    y,
    radius: 10,
    lifeMs: POWER_UP_LIFETIME_MS,
  };
  state.powerUps.push(powerUp);
  return powerUp;
}

function maybeDropPowerUp(
  state: WorldState,
  x: number,
  y: number,
  events: SimEvent[],
): void {
  const type = powerUpDropForKill(state.seed, state.tick, state.killCount);
  if (!type) return;

  const powerUp = spawnPowerUp(state, type, x, y);
  events.push({
    type: 'powerup_dropped',
    tick: state.tick,
    x,
    y,
    data: { powerUp: powerUp.type },
  });
}

function grantAxisLevel(state: WorldState, id: UpgradeAxis): void {
  const player = state.player;
  state.axisLevels[id] += 1;

  if (id === 'speed') {
    player.moveSpeed += 20;
  }
  if (id === 'shields') {
    player.maxHp += 25;
    player.hp = Math.min(player.maxHp, player.hp + 25);
    player.shield += 1;
  }
  if (id === 'missiles') {
    player.missileDamage += 10;
    player.missileCooldown = Math.min(player.missileCooldown, 250);
  }
  if (id === 'blaster') {
    player.shotRate += 1.25;
    player.projectileDamage += 6;
  }
  if (id === 'surge') {
    player.surgeDamage += 12;
    player.surgeDistance += 25;
    player.surgeCooldown = Math.max(0, player.surgeCooldown - 20);
  }
}

function applyPowerUpEffect(state: WorldState, type: PowerUpType): void {
  const definition = powerUpDefinition(type);

  if (definition.axis) {
    grantAxisLevel(state, definition.axis);
  }
  if (type === 'health') {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 30);
  }
  if (type === 'missile') {
    // Make the pickup immediately useful rather than waiting out a cooldown.
    state.player.missileCooldown = 0;
  }
  if (type === 'surge') {
    state.player.surgeCooldown = 0;
  }
}

function currentArenaPolygon(state: WorldState, layouts: ArenaLayout[]): Point[] {
  const fallback = layouts[0]?.polygon ?? foundryLayouts[0].polygon;
  return layouts.find((layout) => layout.id === state.arena.currentLayoutId)?.polygon ?? fallback;
}

function relocateOutsideEntities(
  state: WorldState,
  polygon: Point[],
  events: SimEvent[],
): number {
  let relocated = 0;
  const player = state.player;

  const reloc = (position: Point, clearance: number): Point =>
    findSafeInteriorPoint(polygon, position, clearance);

  if (!isPositionSafe([player.x, player.y], polygon, player.radius)) {
    const target = reloc([player.x, player.y], player.radius + 2);
    player.x = target[0];
    player.y = target[1];
    player.vx = 0;
    player.vy = 0;
    // Anti-cheap-death rule: relocation grants a short grace window.
    player.invuln = Math.max(player.invuln, RELOCATION_IFRAME_MS);
    relocated += 1;
    events.push({
      type: 'arena_mutate',
      tick: state.tick,
      x: target[0],
      y: target[1],
      data: { phase: 'relocated', entity: 'player' },
    });
  }

  for (const enemy of state.enemies) {
    if (isPositionSafe([enemy.x, enemy.y], polygon, enemy.radius)) continue;
    const target = reloc([enemy.x, enemy.y], enemy.radius + 2);
    enemy.x = target[0];
    enemy.y = target[1];
    enemy.vx = 0;
    enemy.vy = 0;
    relocated += 1;
  }

  for (const pickup of state.pickups) {
    if (isPositionSafe([pickup.x, pickup.y], polygon, pickup.radius)) continue;
    const target = reloc([pickup.x, pickup.y], pickup.radius + 2);
    pickup.x = target[0];
    pickup.y = target[1];
    relocated += 1;
  }

  for (const powerUp of state.powerUps) {
    if (isPositionSafe([powerUp.x, powerUp.y], polygon, powerUp.radius)) continue;
    const target = reloc([powerUp.x, powerUp.y], powerUp.radius + 2);
    powerUp.x = target[0];
    powerUp.y = target[1];
    relocated += 1;
  }

  return relocated;
}

function resolveArenaPosition(
  polygon: Array<[number, number]>,
  prevX: number,
  prevY: number,
  nextX: number,
  nextY: number,
): { x: number; y: number } {
  if (pointInPolygon([nextX, nextY], polygon)) {
    return { x: nextX, y: nextY };
  }

  // Axis-separated sliding. Never return a point known to be outside the
  // active polygon; this is the last line of defence against trap states.
  if (pointInPolygon([nextX, prevY], polygon)) {
    return { x: nextX, y: prevY };
  }
  if (pointInPolygon([prevX, nextY], polygon)) {
    return { x: prevX, y: nextY };
  }

  return { x: prevX, y: prevY };
}

/**
 * Moves an enemy toward the active arena if it spawned outside the polygon.
 * Once inside, normal collision sliding applies. Without this entry phase the
 * resolver would pin wave spawns to their off-screen spawn points forever.
 */
function resolveEnemyArenaStep(
  enemy: EnemyState,
  polygon: Array<[number, number]>,
  velocityX: number,
  velocityY: number,
): { x: number; y: number } {
  const prevX = enemy.x;
  const prevY = enemy.y;
  const stepX = velocityX * (TICK_MS / 1000);
  const stepY = velocityY * (TICK_MS / 1000);

  if (!isPositionSafe([prevX, prevY], polygon, enemy.radius + 2)) {
    const entry = findSafeInteriorPoint(polygon, [prevX, prevY], enemy.radius + 2);
    const direction = normalize(entry[0] - prevX, entry[1] - prevY);
    const entrySpeed = Math.max(enemy.speed, 160);
    return {
      x: prevX + direction.x * entrySpeed * (TICK_MS / 1000),
      y: prevY + direction.y * entrySpeed * (TICK_MS / 1000),
    };
  }

  return resolveArenaPosition(polygon, prevX, prevY, prevX + stepX, prevY + stepY);
}

function addKillScore(state: WorldState, baseScore: number): void {
  state.score += (baseScore + state.cardEffects.chainBonus) * state.chain.multiplier;
}

function emitShockRing(state: WorldState, x: number, y: number, events: SimEvent[]): void {
  const damage = state.cardEffects.shockRingDamage;
  if (damage <= 0) return;

  const radiusSq = 120 * 120;
  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    if (distanceSquared(x, y, enemy.x, enemy.y) > radiusSq) continue;

    enemy.hp -= damage;
    events.push({ type: 'enemy_hit', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
    if (enemy.hp <= 0) {
      state.chain = onKill(state.chain);
      addKillScore(state, 18);
      state.killCount += 1;
      state.xp += 8;
      spawnXpPickup(state, enemy.x, enemy.y);
      maybeDropPowerUp(state, enemy.x, enemy.y, events);
      state.enemies.splice(index, 1);
      events.push({ type: 'enemy_died', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
    }
  }
}

export function bossGenerationForRun(difficulty: Difficulty, wave: number): 1 | 2 {
  // Generation scaling is a data-only choice; wave is part of the contract so
  // future data can gate generation without changing callers.
  void wave;
  return difficulty === 'hard' ? 2 : 1;
}

export function stageDefinitionFor(stage: number): StageDefinition {
  const index = Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(stage) - 1));
  return STAGE_DEFINITIONS[index] ?? {
    id: 'foundry',
    name: 'FOUNDRY',
    waveCount: 5,
    bossId: 'warden',
    bossName: 'WARDEN',
    enemyPool: [...FOUNDRY_ENEMY_TYPES],
  };
}

/**
 * Returns the authored enemy pool for a campaign stage. Stage one keeps the
 * original Foundry roster; stage two adds Forge Core specialists. Unknown or
 * empty pools fall back to a stage-appropriate safe default so malformed data
 * can never stop wave spawning.
 */
export function enemyTypesForStage(stage: number): readonly EnemyType[] {
  const definition = stageDefinitionFor(stage);
  const authored = definition.enemyPool?.filter(
    (kind): kind is EnemyType => ENEMY_TYPE_SET.has(kind),
  );
  if (authored && authored.length > 0) return authored;
  return (stage >= 2 ? FORGE_CORE_ENEMY_TYPES : FOUNDRY_ENEMY_TYPES).slice();
}

/** Global wave number for the first wave of a stage. */
export function firstWaveForStage(stage: number): number {
  let wave = 1;
  for (let index = 0; index < Math.max(0, stage - 1); index += 1) {
    wave += STAGE_DEFINITIONS[index]?.waveCount ?? 5;
  }
  return wave;
}

/**
 * Selects the boss data for a campaign stage. Stage 1 preserves the original
 * difficulty-based Warden generation contract; stage 2 always fields the
 * dedicated Forgeheart encounter.
 */
export function bossSpecForStage(
  stage: number,
  difficulty: Difficulty,
  wave: number,
): BossSpec {
  const definition = stageDefinitionFor(stage);
  if (definition.bossId === 'warden') {
    return WARDEN_SPECS[bossGenerationForRun(difficulty, wave)];
  }
  return BOSS_SPECS_BY_ID[definition.bossId] ?? WARDEN_SPECS[1];
}

function bossSpecForRuntime(boss: BossRuntimeState): BossSpec {
  if (boss.specId === 'warden') {
    return WARDEN_SPECS[boss.generation];
  }
  return BOSS_SPECS_BY_ID[boss.specId] ?? WARDEN_SPECS[1];
}

function launchBoss(state: WorldState): void {
  const stage = state.stage ?? 1;
  const spec = bossSpecForStage(stage, state.difficulty, state.wave);
  const hpScale = 1
    + Math.max(0, state.wave - 5) * 0.12
    + (state.difficulty === 'hard' ? 0.1 : 0)
    + Math.max(0, stage - 1) * 0.25;
  const runtime = createBossRuntime(spec, {
    x: BOSS_SPAWN_X,
    y: BOSS_SPAWN_Y,
    hpScale,
  });
  state.boss = { active: true, ...runtime };
}

function beginBossWarning(
  state: WorldState,
  durationMs: number,
  events: SimEvent[],
): void {
  if (state.boss !== null || state.bossWarningMs > 0) return;

  const stage = state.stage ?? 1;
  const spec = bossSpecForStage(stage, state.difficulty, state.wave);
  const warningData = {
    generation: spec.generation,
    bossId: spec.id,
    bossName: spec.displayName ?? stageDefinitionFor(stage).bossName,
    stage,
  };

  if (durationMs <= 0) {
    launchBoss(state);
    events.push({
      type: 'boss_warning',
      tick: state.tick,
      x: BOSS_SPAWN_X,
      y: BOSS_SPAWN_Y,
      data: {
        phase: 'spawned',
        ...warningData,
      },
    });
    return;
  }

  state.bossWarningMs = durationMs;
  state.bossWarningTotalMs = durationMs;
  events.push({
    type: 'boss_warning',
    tick: state.tick,
    x: BOSS_SPAWN_X,
    y: BOSS_SPAWN_Y,
    data: {
      phase: 'warning',
      durationMs,
      ...warningData,
    },
  });
}

/**
 * Handles a boss reaching zero HP. Intermediate stages hand off to the next
 * campaign stage after a transition; only the final stage ends the run.
 */
function completeBossDefeat(
  state: WorldState,
  stageTransitionDurationMs: number,
  events: SimEvent[],
): void {
  const defeatedStage = state.stage ?? 1;
  const defeatedDefinition = stageDefinitionFor(defeatedStage);
  const bossId = state.boss?.specId ?? defeatedDefinition.bossId;
  state.bossesDefeated = (state.bossesDefeated ?? 0) + 1;

  events.push({
    type: 'stage_clear',
    tick: state.tick,
    x: state.boss?.x,
    y: state.boss?.y,
    data: {
      stage: defeatedStage,
      stageName: defeatedDefinition.name,
      bossId,
      bossesDefeated: state.bossesDefeated,
    },
  });

  if (defeatedStage >= STAGE_COUNT) {
    // Preserve the original end-of-run representation: the defeated boss is
    // still available for presentation, but it is inactive and the run is won.
    if (state.boss) state.boss.active = false;
    state.status = 'won';
    events.push({
      type: 'run_ended',
      tick: state.tick,
      x: state.boss?.x,
      y: state.boss?.y,
      data: { outcome: 'victory', stage: defeatedStage, bossesDefeated: state.bossesDefeated },
    });
    return;
  }

  const nextStage = defeatedStage + 1;
  const nextDefinition = stageDefinitionFor(nextStage);
  state.boss = null;
  state.bossWarningMs = 0;
  state.bossWarningTotalMs = 0;
  state.stage = nextStage;
  state.stageName = nextDefinition.name;
  state.stageWave = 1;
  state.stageWaveTotal = nextDefinition.waveCount;
  state.activeWave = 0;
  state.miniWave = 0;
  state.miniWaveTotal = 0;
  state.miniWaveBudgets = [];
  state.miniWaveBreakMs = null;
  state.miniWaveBreakTotalMs = 0;
  state.waveBreakMs = null;
  state.waveBreakTotalMs = 0;
  state.wave = firstWaveForStage(nextStage);
  state.waveTimer = 0;
  state.stageTransitionMs = Math.max(0, stageTransitionDurationMs);
  state.stageTransitionTotalMs = Math.max(0, stageTransitionDurationMs);
  state.stageAwaitingFirstWave = true;

  events.push({
    type: 'stage_transition',
    tick: state.tick,
    data: {
      phase: 'started',
      fromStage: defeatedStage,
      stage: nextStage,
      stageName: nextDefinition.name,
      durationMs: state.stageTransitionMs,
    },
  });
}

export function createWorld(
  seed = 'cinder',
  difficulty: Difficulty = 'normal',
  options: WorldOptions = {},
): World {
  const layouts = options.layouts && options.layouts.length > 0 ? options.layouts : foundryLayouts;
  const arenaIntervalMs = options.arenaIntervalMs ?? DEFAULT_ARENA_INTERVAL_MS;
  const arenaTelegraphMs = options.arenaTelegraphMs ?? DEFAULT_ARENA_TELEGRAPH_MS;
  const arenaMinRadius = options.arenaMinRadius ?? DEFAULT_ARENA_MIN_RADIUS;
  const bossWarningDurationMs = options.bossWarningMs ?? BOSS_WARNING_DURATION_MS;
  const waveBreakDurationMs = options.waveBreakMs ?? WAVE_BREATHING_ROOM_MS;
  const miniWaveBreakDurationMs = options.miniWaveBreakMs ?? MINI_WAVE_BREAK_MS;
  const stageTransitionDurationMs = Math.max(
    0,
    options.stageTransitionMs ?? STAGE_TRANSITION_MS,
  );
  const miniWavesPerWave = Math.max(
    1,
    Math.floor(options.miniWavesPerWave ?? MINI_WAVES_PER_WAVE),
  );
  const state = createInitialState(seed, difficulty, layouts);

  const applyUpgrade = (id: UpgradeAxis): void => {
    const cost = upgradeAxisCost(id, state.axisLevels[id]);
    if (!UPGRADE_AXES.includes(id) || state.xp < cost) return;

    state.xp = Math.max(0, state.xp - cost);
    grantAxisLevel(state, id);
  };

  const step = (input: InputFrame): SimEvent[] => {
    const events: SimEvent[] = [];
    if (state.status !== 'playing') {
      return events;
    }

    state.tick += 1;
    state.waveTimer += TICK_MS;
    let waveBreakFinished = false;
    if (state.waveBreakMs !== null) {
      waveBreakFinished = state.waveBreakMs <= TICK_MS;
      state.waveBreakMs = Math.max(0, state.waveBreakMs - TICK_MS);
      if (state.waveBreakMs <= 0) {
        state.waveBreakMs = null;
      }
    }

    let miniWaveBreakFinished = false;
    if ((state.miniWaveBreakMs ?? null) !== null) {
      miniWaveBreakFinished = state.miniWaveBreakMs! <= TICK_MS;
      state.miniWaveBreakMs = Math.max(0, state.miniWaveBreakMs! - TICK_MS);
      if (state.miniWaveBreakMs <= 0) {
        state.miniWaveBreakMs = null;
      }
    }

    if ((state.stageTransitionMs ?? 0) > 0) {
      state.stageTransitionMs = Math.max(0, state.stageTransitionMs! - TICK_MS);
      if (state.stageTransitionMs <= 0) {
        events.push({
          type: 'stage_transition',
          tick: state.tick,
          data: {
            phase: 'complete',
            stage: state.stage ?? 1,
            stageName: state.stageName ?? stageDefinitionFor(state.stage ?? 1).name,
          },
        });
      }
    }
    state.chain = stepChain(state.chain, TICK_MS);
    const arenaPolygon = currentArenaPolygon(state, layouts);

    const player = state.player;
    player.fireCooldown = Math.max(0, player.fireCooldown - TICK_MS);
    player.invuln = Math.max(0, player.invuln - TICK_MS);
    player.surgeCooldown = Math.max(0, player.surgeCooldown - TICK_MS);
    player.surgeTimer = Math.max(0, player.surgeTimer - TICK_MS);
    player.fireBufferMs = Math.max(0, player.fireBufferMs - TICK_MS);
    player.surgeBufferMs = Math.max(0, player.surgeBufferMs - TICK_MS);

    if (input.fire) {
      player.fireBufferMs = 100;
    }
    if (input.surge) {
      player.surgeBufferMs = 100;
    }

    const moveX = clamp(input.moveX, -1, 1);
    const moveY = clamp(input.moveY, -1, 1);
    const moveVector = normalize(moveX, moveY);
    const moveSpeed = player.moveSpeed * (1 + state.cardEffects.moveSpeedMul);
    const accel = 2800;
    const friction = 10;
    player.vx += moveVector.x * accel * (1 / 60);
    player.vy += moveVector.y * accel * (1 / 60);
    player.vx *= Math.max(0, 1 - friction * (1 / 60));
    player.vy *= Math.max(0, 1 - friction * (1 / 60));
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > moveSpeed) {
      const scale = moveSpeed / speed;
      player.vx *= scale;
      player.vy *= scale;
    }
    const nextPlayerX = clamp(player.x + player.vx * (1 / 60), 16, ARENA_WIDTH - 16);
    const nextPlayerY = clamp(player.y + player.vy * (1 / 60), 16, ARENA_HEIGHT - 16);
    const playerPosition = resolveArenaPosition(arenaPolygon, player.x, player.y, nextPlayerX, nextPlayerY);
    if (playerPosition.x === player.x) {
      player.vx = 0;
    }
    if (playerPosition.y === player.y) {
      player.vy = 0;
    }
    player.x = playerPosition.x;
    player.y = playerPosition.y;

    if (input.aimX !== 0 || input.aimY !== 0) {
      const target = normalize(input.aimX, input.aimY);
      player.aimX = target.x;
      player.aimY = target.y;
    }

    if (player.surgeBufferMs > 0 && player.surgeCooldown <= 0) {
      const surgeDamage = player.surgeDamage * (1 + state.cardEffects.surgeDamageMul);
      const surgeDirection = normalize(player.aimX, player.aimY);
      const surgeStartX = player.x;
      const surgeStartY = player.y;
      const dashSteps = Math.max(1, Math.ceil(player.surgeDistance / 16));
      const dashStepDistance = player.surgeDistance / dashSteps;

      for (let dashStep = 0; dashStep < dashSteps; dashStep += 1) {
        const nextX = player.x + surgeDirection.x * dashStepDistance;
        const nextY = player.y + surgeDirection.y * dashStepDistance;
        const dashPosition = resolveArenaPosition(arenaPolygon, player.x, player.y, nextX, nextY);
        if (dashPosition.x === player.x && dashPosition.y === player.y) break;
        player.x = dashPosition.x;
        player.y = dashPosition.y;
      }
      player.vx = 0;
      player.vy = 0;

      player.surgeTimer = 140;
      player.surgeCooldown = Math.max(120, 420 * (1 + state.cardEffects.surgeCooldownMul));
      player.invuln = 140;
      player.surgeBufferMs = 0;
      if (state.cardEffects.healOnSurge > 0) {
        player.hp = Math.min(player.maxHp, player.hp + state.cardEffects.healOnSurge);
      }
      if (state.cardEffects.resetFireCooldown) {
        player.fireCooldown = 0;
      }
      events.push({ type: 'surge_used', tick: state.tick, x: player.x, y: player.y, data: { damage: surgeDamage } });

      let surgeKillCount = 0;
      for (let index = 0; index < state.enemies.length; index += 1) {
        const enemy = state.enemies[index];
        const hitDistance = distanceSquaredToSegment(
          enemy.x,
          enemy.y,
          surgeStartX,
          surgeStartY,
          player.x,
          player.y,
        );
        if (hitDistance <= (player.radius + enemy.radius + 26) ** 2) {
          enemy.hp -= surgeDamage;
          if (enemy.hp <= 0) {
            state.chain = onKill(state.chain);
            addKillScore(state, 20);
            state.killCount += 1;
            state.xp += 10;
            surgeKillCount += 1;
            spawnXpPickup(state, enemy.x, enemy.y);
            maybeDropPowerUp(state, enemy.x, enemy.y, events);
            state.enemies.splice(index, 1);
            events.push({ type: 'enemy_died', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
            emitShockRing(state, enemy.x, enemy.y, events);
            index -= 1;
          }
        }
      }
      if (surgeKillCount > 0) {
        player.surgeCooldown *= 0.6;
      }
    }

    if (player.fireBufferMs > 0 && player.fireCooldown <= 0) {
      const aimX = player.aimX || 1;
      const aimY = player.aimY || 0;
      const shotX = player.x + aimX * 18;
      const shotY = player.y + aimY * 18;
      spawnProjectile(state, shotX, shotY, aimX, aimY, player.projectileSpeed, player.projectileDamage, 'player', 4);
      player.fireCooldown = 1000 / (player.shotRate * (1 + state.cardEffects.fireRateMul));
      player.fireBufferMs = 0;
      events.push({ type: 'player_fire', tick: state.tick, x: shotX, y: shotY });
    }

    player.missileCooldown = Math.max(0, player.missileCooldown - TICK_MS);
    if (player.missileDamage > 0 && player.missileCooldown <= 0) {
      const targets: Array<{ x: number; y: number; distanceSq: number }> = [];

      for (const enemy of state.enemies) {
        if ((enemy.spawnWarningMs ?? 0) > 0) continue;
        targets.push({
          x: enemy.x,
          y: enemy.y,
          distanceSq: distanceSquared(player.x, player.y, enemy.x, enemy.y),
        });
      }

      if (state.boss && state.boss.active) {
        targets.push({
          x: state.boss.x,
          y: state.boss.y,
          distanceSq: distanceSquared(player.x, player.y, state.boss.x, state.boss.y),
        });
      }

      targets.sort((a, b) => a.distanceSq - b.distanceSq);
      const axisVolleySize = missileVolleySize(state.axisLevels.missiles);
      // Support direct state tweaks/tests that set damage without raising the
      // axis, while higher axis levels scale the volley count one-for-one.
      const volleySize = Math.max(axisVolleySize, 1);

      if (targets.length > 0) {
        for (let missileIndex = 0; missileIndex < volleySize; missileIndex += 1) {
          const target = targets[Math.min(missileIndex, targets.length - 1)];
          const baseDirection = normalize(target.x - player.x, target.y - player.y);
          const spreadIndex = missileIndex - (volleySize - 1) / 2;
          const spreadAngle = spreadIndex * 0.08;
          const cos = Math.cos(spreadAngle);
          const sin = Math.sin(spreadAngle);
          const missileDirection = {
            x: baseDirection.x * cos - baseDirection.y * sin,
            y: baseDirection.x * sin + baseDirection.y * cos,
          };
          const lateralOffset = spreadIndex * 7;
          const perpendicular = { x: -missileDirection.y, y: missileDirection.x };

          spawnProjectile(
            state,
            player.x + missileDirection.x * 16 + perpendicular.x * lateralOffset,
            player.y + missileDirection.y * 16 + perpendicular.y * lateralOffset,
            missileDirection.x,
            missileDirection.y,
            620,
            player.missileDamage,
            'player',
            5,
            'missile',
          );
        }
        player.missileCooldown = 1200;
        events.push({
          type: 'missile_fire',
          tick: state.tick,
          x: player.x,
          y: player.y,
          data: { count: volleySize },
        });
      }
    }

    const spawnEveryMs = 1000 * (1 / (state.wave * 0.55 + 1.2)) * (1 / difficultyConfig[state.difficulty].spawnRate);
    if (state.bossWarningMs > 0) {
      state.bossWarningMs = Math.max(0, state.bossWarningMs - TICK_MS);
      if (state.bossWarningMs <= 0) {
        launchBoss(state);
        state.waveTimer = 0;
        events.push({
          type: 'boss_warning',
          tick: state.tick,
          x: BOSS_SPAWN_X,
          y: BOSS_SPAWN_Y,
          data: {
            phase: 'spawned',
            generation: state.boss?.generation ?? 1,
            bossId: state.boss?.specId ?? stageDefinitionFor(state.stage ?? 1).bossId,
            bossName: state.boss?.displayName ?? stageDefinitionFor(state.stage ?? 1).bossName,
            stage: state.stage ?? 1,
          },
        });
      }
    } else if (miniWaveBreakFinished) {
      // The next mini-wave was queued when the previous group was cleared.
      spawnNextMiniWave(state, arenaPolygon, events);
    } else if (
      state.enemies.length === 0 &&
      state.boss === null &&
      state.waveBreakMs === null &&
      (state.miniWaveBreakMs ?? null) === null &&
      (state.stageTransitionMs ?? 0) <= 0 &&
      (waveBreakFinished || state.waveTimer > spawnEveryMs * 1.4)
    ) {
      if (hasPendingMiniWaves(state)) {
        // Safety fallback for externally manipulated state: never skip a
        // queued mini-wave even if its pause was cleared manually.
        spawnNextMiniWave(state, arenaPolygon, events);
      } else {
        const stage = state.stage ?? 1;
        const definition = stageDefinitionFor(stage);
        const stageWave =
          state.stageWave ?? (state.wave - firstWaveForStage(stage) + 1);
        const legacyStageOneBossReady = stage === 1 && state.wave >= 5;
        if (stageWave > definition.waveCount || legacyStageOneBossReady) {
          beginBossWarning(state, bossWarningDurationMs, events);
          state.waveTimer = 0;
        } else {
          beginWave(state, state.wave, arenaPolygon, miniWavesPerWave, events);
          state.wave += 1;
          state.stageWave = stageWave + 1;
          state.stageWaveTotal = definition.waveCount;
          state.waveTimer = 0;
          state.waveBreakTotalMs = 0;
        }
      }
    }

    const arenaStep = stepArenaMutation(state.arena, {
      dtMs: TICK_MS,
      intervalMs: arenaIntervalMs,
      telegraphMs: arenaTelegraphMs,
      bossPatternActive: state.boss?.active ?? false,
      layouts,
      isLayoutSafe: (layout) => isMutationSafe(layout.polygon, arenaMinRadius),
    });
    state.arena = arenaStep.state;
    if (arenaStep.didTelegraph) {
      events.push({
        type: 'arena_mutate',
        tick: state.tick,
        data: {
          phase: 'telegraph',
          next: state.arena.nextLayoutId ?? '',
          telegraphMs: arenaTelegraphMs,
          cue: 'edge_pulse+decal+audio',
        },
      });
    }
    if (arenaStep.didBlock) {
      events.push({
        type: 'arena_mutate',
        tick: state.tick,
        data: { phase: 'blocked', layout: state.arena.currentLayoutId, reason: 'unsafe' },
      });
    }
    if (arenaStep.didMutate) {
      const newPolygon = currentArenaPolygon(state, layouts);
      const relocated = relocateOutsideEntities(state, newPolygon, events);
      events.push({
        type: 'arena_mutate',
        tick: state.tick,
        data: {
          phase: 'mutated',
          layout: state.arena.currentLayoutId,
          relocated,
        },
      });
    }

    if (state.boss && state.boss.active) {
      const bossStep = stepBossRuntime(state.boss, bossSpecForRuntime(state.boss), {
        dtMs: TICK_MS,
        tick: state.tick,
        playerX: player.x,
        playerY: player.y,
      });
      state.boss = { active: true, ...bossStep.state };

      for (const shot of bossStep.shots) {
        spawnProjectile(
          state,
          shot.x,
          shot.y,
          shot.directionX,
          shot.directionY,
          shot.speed,
          shot.damage,
          'boss',
          shot.radius,
        );
      }

      for (const runtimeEvent of bossStep.events) {
        if (runtimeEvent.type === 'boss_phase') {
          events.push({
            type: 'boss_phase',
            tick: state.tick,
            x: state.boss.x,
            y: state.boss.y,
            data: { phase: runtimeEvent.phase, hpFraction: runtimeEvent.hpFraction },
          });
        } else if (runtimeEvent.type === 'boss_pattern') {
          events.push({
            type: 'boss_pattern',
            tick: state.tick,
            x: state.boss.x,
            y: state.boss.y,
            data: { patternId: runtimeEvent.patternId, phase: runtimeEvent.phase },
          });
        } else if (runtimeEvent.type === 'boss_module_exposed') {
          events.push({
            type: 'boss_module_exposed',
            tick: state.tick,
            x: state.boss.x,
            y: state.boss.y,
            data: { moduleId: runtimeEvent.moduleId, exposed: runtimeEvent.exposed ? 1 : 0 },
          });
        }
      }
    }

    for (let index = 0; index < state.projectiles.length; index += 1) {
      const projectile = state.projectiles[index];
      if (!projectile) {
        state.projectiles.splice(index, 1);
        index -= 1;
        continue;
      }
      projectile.x += projectile.vx * (TICK_MS / 1000);
      projectile.y += projectile.vy * (TICK_MS / 1000);
      projectile.life -= TICK_MS;

      if (
        projectile.owner === 'player' &&
        state.boss &&
        state.boss.active &&
        distanceSquared(projectile.x, projectile.y, state.boss.x, state.boss.y) <= (projectile.radius + state.boss.radius) ** 2
      ) {
        const bossHit = damageBossRuntime(
          state.boss,
          projectile.damage * (1 + state.cardEffects.bossDamageMul),
          projectile.x,
          projectile.y,
        );
        state.boss = { active: true, ...bossHit.state };
        state.projectiles.splice(index, 1);
        events.push({
          type: 'boss_hit',
          tick: state.tick,
          x: projectile.x,
          y: projectile.y,
          data: {
            dealt: bossHit.dealt,
            target: bossHit.targetModuleId ?? 'core',
          },
        });

        if (bossHit.destroyedModuleId) {
          events.push({
            type: 'boss_module_destroyed',
            tick: state.tick,
            x: state.boss.x,
            y: state.boss.y,
            data: { moduleId: bossHit.destroyedModuleId },
          });
        }

        if (bossHit.defeated) {
          completeBossDefeat(state, stageTransitionDurationMs, events);
        }
        index -= 1;
        continue;
      }

      if (projectile.owner === 'player') {
        for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
          const enemy = state.enemies[enemyIndex];
          if (distanceSquared(projectile.x, projectile.y, enemy.x, enemy.y) <= (projectile.radius + enemy.radius) ** 2) {
            enemy.hp -= projectile.damage;
            state.projectiles.splice(index, 1);
            events.push({ type: 'enemy_hit', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
            if (enemy.hp <= 0) {
              state.chain = onKill(state.chain);
              addKillScore(state, 40);
              state.killCount += 1;
              state.xp += 12;
              spawnXpPickup(state, enemy.x, enemy.y);
              maybeDropPowerUp(state, enemy.x, enemy.y, events);
              state.enemies.splice(enemyIndex, 1);
              events.push({ type: 'enemy_died', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
              emitShockRing(state, enemy.x, enemy.y, events);
              if (enemy.kind === 'splitter') {
                for (let split = 0; split < 2; split += 1) {
                  const angle = (Math.PI * 2 * split) / 2 + state.tick * 0.31;
                  const desired: Point = [
                    enemy.x + Math.cos(angle) * (enemy.radius + 12),
                    enemy.y + Math.sin(angle) * (enemy.radius + 12),
                  ];
                  const spawnPoint = findSafeInteriorPoint(arenaPolygon, desired, 24);
                  const child = createEnemy(
                    state,
                    'drone',
                    spawnPoint[0],
                    spawnPoint[1],
                    ENEMY_SPAWN_WARNING_MS,
                  );
                  if (state.enemies.length < MAX_ENEMIES) {
                    state.enemies.push(child);
                  }
                }
              }
            }
            index -= 1;
            break;
          }
        }
      } else if (
        player.invuln <= 0 &&
        distanceSquared(projectile.x, projectile.y, player.x, player.y) <= (projectile.radius + player.radius) ** 2
      ) {
        player.hp -= projectile.damage * (1 + state.cardEffects.contactDamageTakenMul);
        state.chain = onDamageTaken();
        player.invuln = 80;
        state.projectiles.splice(index, 1);
        events.push({
          type: 'player_hit',
          tick: state.tick,
          x: player.x,
          y: player.y,
          data: { hp: player.hp, source: 'projectile', kind: projectile.owner },
        });
        if (player.hp <= 0 && !state.reviveUsed && state.cardEffects.reviveHp > 0) {
          state.reviveUsed = true;
          player.hp = state.cardEffects.reviveHp;
        } else if (player.hp <= 0) {
          state.status = 'lost';
          events.push({ type: 'run_ended', tick: state.tick, x: player.x, y: player.y, data: { outcome: 'defeat' } });
        }
        index -= 1;
        continue;
      }

      if (projectile.life <= 0) {
        state.projectiles.splice(index, 1);
        index -= 1;
      }
    }

    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if ((enemy.spawnWarningMs ?? 0) > 0) {
        enemy.spawnWarningMs = Math.max(0, (enemy.spawnWarningMs ?? 0) - TICK_MS);
        continue;
      }

      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      const dirX = dx / distance;
      const dirY = dy / distance;

      const behaviour = stepEnemyBehaviour({
        kind: enemy.kind,
        x: enemy.x,
        y: enemy.y,
        speed: enemy.speed,
        seed: enemy.seed,
        tick: state.tick,
        playerX: player.x,
        playerY: player.y,
      });
      const enemyPosition = resolveEnemyArenaStep(
        enemy,
        arenaPolygon,
        behaviour.vx,
        behaviour.vy,
      );
      enemy.x = enemyPosition.x;
      enemy.y = enemyPosition.y;

      if (enemy.kind === 'turret' || enemy.kind === 'lancer') {
        enemy.fireCooldown -= TICK_MS;
        if (enemy.fireCooldown <= 0 && distance < 460) {
          const shot = normalize(player.x - enemy.x, player.y - enemy.y);
          const speed = enemy.kind === 'lancer' ? 420 : 220;
          const damage = enemy.kind === 'lancer' ? 14 : 10;
          spawnProjectile(state, enemy.x, enemy.y, shot.x, shot.y, speed, damage, 'enemy', 4);
          enemy.fireCooldown = 1000 / enemyDefinitions[enemy.kind].fireRate;
        }
      }

      if (enemy.kind === 'bomber') {
        enemy.fireCooldown -= TICK_MS;
        if (enemy.fireCooldown <= 0 && distance < 360) {
          for (let burst = 0; burst < 8; burst += 1) {
            const angle = (Math.PI * 2 * burst) / 8 + state.tick * 0.02;
            spawnProjectile(
              state,
              enemy.x,
              enemy.y,
              Math.cos(angle),
              Math.sin(angle),
              190,
              11,
              'enemy',
              5,
            );
          }
          enemy.fireCooldown = 1000 / enemyDefinitions[enemy.kind].fireRate;
        }
      }

      if (enemy.kind === 'sentinel') {
        enemy.fireCooldown -= TICK_MS;
        if (enemy.fireCooldown <= 0 && distance < 520) {
          const aimAngle = Math.atan2(dy, dx);
          for (let spread = -1; spread <= 1; spread += 1) {
            const angle = aimAngle + spread * 0.14;
            spawnProjectile(
              state,
              enemy.x,
              enemy.y,
              Math.cos(angle),
              Math.sin(angle),
              260,
              12,
              'enemy',
              4,
            );
          }
          enemy.fireCooldown = 1000 / enemyDefinitions[enemy.kind].fireRate;
        }
      }

      if (enemy.kind === 'mortar') {
        enemy.fireCooldown -= TICK_MS;
        if (enemy.fireCooldown <= 0 && distance < 620) {
          const aimAngle = Math.atan2(dy, dx);
          for (let spread = -1; spread <= 1; spread += 1) {
            const angle = aimAngle + spread * 0.2;
            spawnProjectile(
              state,
              enemy.x,
              enemy.y,
              Math.cos(angle),
              Math.sin(angle),
              180,
              14,
              'enemy',
              6,
            );
          }
          enemy.fireCooldown = 1000 / enemyDefinitions[enemy.kind].fireRate;
        }
      }

      if (enemy.kind === 'juggernaut') {
        enemy.fireCooldown -= TICK_MS;
        if (enemy.fireCooldown <= 0 && distance < 360) {
          for (let burst = 0; burst < 10; burst += 1) {
            const angle = (Math.PI * 2 * burst) / 10 + state.tick * 0.015;
            spawnProjectile(
              state,
              enemy.x,
              enemy.y,
              Math.cos(angle),
              Math.sin(angle),
              180,
              13,
              'enemy',
              5,
            );
          }
          enemy.fireCooldown = 1000 / enemyDefinitions[enemy.kind].fireRate;
        }
      }

      if (enemy.kind === 'charger') {
        if (distance < 220) {
          enemy.x += dirX * enemy.speed * 1.5 * (TICK_MS / 1000);
          enemy.y += dirY * enemy.speed * 1.5 * (TICK_MS / 1000);
        }
      }

      if (player.invuln <= 0 && distance < (enemy.radius + player.radius + 2)) {
        player.hp -= enemy.contactDamage * (1 + state.cardEffects.contactDamageTakenMul);
        state.chain = onDamageTaken();
        player.invuln = 100;
        events.push({
          type: 'player_hit',
          tick: state.tick,
          x: player.x,
          y: player.y,
          data: { hp: player.hp, source: 'contact', kind: enemy.kind },
        });
        if (player.hp <= 0 && !state.reviveUsed && state.cardEffects.reviveHp > 0) {
          state.reviveUsed = true;
          player.hp = state.cardEffects.reviveHp;
        } else if (player.hp <= 0) {
          state.status = 'lost';
          events.push({ type: 'run_ended', tick: state.tick, x: player.x, y: player.y, data: { outcome: 'defeat' } });
        }
      }
    }

    if (state.status === 'playing' && player.hp <= 0) {
      state.status = 'lost';
    }


    if (state.pickups.length > 0) {
      for (let pickupIndex = state.pickups.length - 1; pickupIndex >= 0; pickupIndex -= 1) {
        const pickup = state.pickups[pickupIndex];
        pickup.lifeMs -= TICK_MS;
        const magnetRadius = 100;
        const pickDistance = distanceSquared(player.x, player.y, pickup.x, pickup.y);
        if (pickDistance <= magnetRadius * magnetRadius) {
          const toward = normalize(player.x - pickup.x, player.y - pickup.y);
          const nextPickupX = pickup.x + toward.x * 240 * (TICK_MS / 1000);
          const nextPickupY = pickup.y + toward.y * 240 * (TICK_MS / 1000);
          const pickupPosition = resolveArenaPosition(arenaPolygon, pickup.x, pickup.y, nextPickupX, nextPickupY);
          pickup.x = pickupPosition.x;
          pickup.y = pickupPosition.y;
        }

        if (state.enemies.length > MAX_ENEMIES) {
          state.enemies.splice(MAX_ENEMIES);
        }
        if (state.projectiles.length > MAX_PROJECTILES) {
          state.projectiles.splice(0, state.projectiles.length - MAX_PROJECTILES);
        }
        if (pickDistance <= (player.radius + pickup.radius) ** 2) {
          state.xp += pickup.value;
          state.pickups.splice(pickupIndex, 1);
          events.push({ type: 'pickup', tick: state.tick, x: pickup.x, y: pickup.y, data: { value: pickup.value } });
        } else if (pickup.lifeMs <= 0) {
          state.pickups.splice(pickupIndex, 1);
        }
      }
    }

    if (state.powerUps.length > 0) {
      for (let powerUpIndex = state.powerUps.length - 1; powerUpIndex >= 0; powerUpIndex -= 1) {
        const powerUp = state.powerUps[powerUpIndex];
        powerUp.lifeMs -= TICK_MS;
        const powerUpDistance = distanceSquared(player.x, player.y, powerUp.x, powerUp.y);

        if (powerUpDistance <= POWER_UP_MAGNET_RADIUS * POWER_UP_MAGNET_RADIUS) {
          const toward = normalize(player.x - powerUp.x, player.y - powerUp.y);
          const nextPowerUpX = powerUp.x + toward.x * POWER_UP_MAGNET_SPEED * (TICK_MS / 1000);
          const nextPowerUpY = powerUp.y + toward.y * POWER_UP_MAGNET_SPEED * (TICK_MS / 1000);
          const powerUpPosition = resolveArenaPosition(arenaPolygon, powerUp.x, powerUp.y, nextPowerUpX, nextPowerUpY);
          powerUp.x = powerUpPosition.x;
          powerUp.y = powerUpPosition.y;
        }

        if (powerUpDistance <= (player.radius + powerUp.radius) ** 2) {
          applyPowerUpEffect(state, powerUp.type);
          state.powerUps.splice(powerUpIndex, 1);
          events.push({
            type: 'powerup_collected',
            tick: state.tick,
            x: powerUp.x,
            y: powerUp.y,
            data: { powerUp: powerUp.type },
          });
        } else if (powerUp.lifeMs <= 0) {
          state.powerUps.splice(powerUpIndex, 1);
        }
      }
    }

    if (
      state.status === 'playing' &&
      state.enemies.length === 0 &&
      state.boss === null &&
      state.bossWarningMs <= 0 &&
      state.waveBreakMs === null &&
      (state.miniWaveBreakMs ?? null) === null &&
      (state.stageTransitionMs ?? 0) <= 0 &&
      !(state.stageAwaitingFirstWave ?? false) &&
      state.wave > 1
    ) {
      if (hasPendingMiniWaves(state)) {
        state.miniWaveBreakMs = miniWaveBreakDurationMs;
        state.miniWaveBreakTotalMs = miniWaveBreakDurationMs;
        state.waveTimer = 0;
        events.push({
          type: 'mini_wave',
          tick: state.tick,
          data: {
            phase: 'break_started',
            wave: state.activeWave ?? state.wave,
            miniWave: state.miniWave ?? 0,
            nextMiniWave: (state.miniWave ?? 0) + 1,
            total: state.miniWaveTotal ?? 0,
            durationMs: miniWaveBreakDurationMs,
          },
        });
      } else {
        state.waveBreakMs = waveBreakDurationMs;
        state.waveBreakTotalMs = waveBreakDurationMs;
        state.waveTimer = 0;
        events.push({
          type: 'wave_break',
          tick: state.tick,
          data: { phase: 'started', durationMs: waveBreakDurationMs, nextWave: state.wave },
        });
      }
    }

    if (
      state.tick % 120 === 0 &&
      state.status === 'playing' &&
      (state.stage ?? 1) === 1 &&
      state.boss === null &&
      state.bossWarningMs <= 0 &&
      state.waveBreakMs === null &&
      (state.miniWaveBreakMs ?? null) === null &&
      (state.stageTransitionMs ?? 0) <= 0 &&
      !hasPendingMiniWaves(state) &&
      state.enemies.length === 0 &&
      (state.wave - 1) >= 5
    ) {
      state.wave += 1;
    }

    return events;
  };

  const restart = () => {
    const nextSeed = `${seed}:${state.tick || 0}:restart`;
    const fresh = createInitialState(nextSeed, difficulty, layouts);
    Object.assign(state, fresh);
    state.rng = 0;
  };

  return {
    state,
    step,
    hash(): string {
      return stableStringify(state);
    },
    applyUpgrade,
    spawnPowerUp(type: PowerUpSpawnType, x: number, y: number): PowerUpState {
      return spawnPowerUp(state, type, x, y);
    },
    collectPowerUp(index: number): boolean {
      const powerUp = state.powerUps[index];
      if (!powerUp) return false;
      applyPowerUpEffect(state, powerUp.type);
      state.powerUps.splice(index, 1);
      return true;
    },
    setDeck(deck: 'bulwark' | 'tempest') {
      state.player.deck = deck;
      if (deck === 'bulwark') {
        state.player.maxHp += 20;
        state.player.hp = state.player.maxHp;
      } else {
        state.player.shotRate += 1.5;
      }
    },
    restart,
  };
}

export function createReplaySeed(seed: string, count: number): InputFrame[] {
  const frames: InputFrame[] = [];
  const rng = createRng(seed, 'cards');

  for (let tick = 0; tick < count; tick += 1) {
    frames.push(
      createInputFrame(tick, {
        moveX: rng.nextFloat() * 2 - 1,
        moveY: rng.nextFloat() * 2 - 1,
        aimX: rng.nextFloat() * 2 - 1,
        aimY: rng.nextFloat() * 2 - 1,
        fire: tick % 12 === 0,
        surge: tick % 90 === 0,
      }),
    );
  }

  return frames;
}
