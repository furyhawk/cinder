import { createRng } from './rng';
import { createMutationState, stepArenaMutation, type MutationState } from './arena/mutate';
import { foundryLayouts } from './arena/layouts';
import type { ArenaLayout, Point } from './arena/geometry';
import {
  findSafeInteriorPoint,
  isMutationSafe,
  isPositionSafe,
  pointInPolygon,
} from './arena/validate';
import { stepEnemyBehaviour } from './entities/enemy';
import { planWaveSpawns } from './systems/director';
import { createChainState, onDamageTaken, onKill, stepChain, type ChainState } from './systems/chain';
import {
  createBossRuntime,
  damageBossRuntime,
  stepBossRuntime,
  type BossRuntimeState,
  type BossSpec,
} from './boss';
import wardenGen1 from '../data/boss.warden.json';
import wardenGen2 from '../data/boss.warden.gen2.json';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type UpgradeId = 'speed' | 'fire' | 'shield' | 'surge';
export type EnemyType = 'drone' | 'runner' | 'orbiter' | 'turret' | 'spinner' | 'charger' | 'splitter' | 'lancer';
type DeckId = 'bulwark' | 'tempest';
type CardHook = 'passive' | 'on_surge' | 'on_hit' | 'on_kill';

interface CardSpec {
  id: string;
  deck: DeckId;
  effect: {
    hook: CardHook;
    stat: string;
    value: number;
  };
  stacking: 'stack' | 'unique';
}

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
    | 'arena_mutate'
    | 'run_ended'
    | 'card_offered';
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

export interface WorldState {
  tick: number;
  seed: string;
  difficulty: Difficulty;
  status: 'playing' | 'won' | 'lost';
  wave: number;
  waveTimer: number;
  boss: BossState | null;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  pickups: PickupState[];
  xp: number;
  pendingUpgrades: UpgradeId[];
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
}

export interface World {
  state: WorldState;
  step(input: InputFrame): SimEvent[];
  hash(): string;
  applyUpgrade(id: UpgradeId): void;
  setDeck(deck: DeckId): void;
  restart(): void;
}

const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 720;
const TICK_MS = 1000 / 60;
const DEFAULT_ARENA_INTERVAL_MS = 22000;
const DEFAULT_ARENA_TELEGRAPH_MS = 1200;
const DEFAULT_ARENA_MIN_RADIUS = 160;
const RELOCATION_IFRAME_MS = 45;
const MAX_ENEMIES = 900;
const MAX_PROJECTILES = 1800;
const CARD_POOL: CardSpec[] = [
  { id: 'bulwark_plate', deck: 'bulwark', effect: { hook: 'passive', stat: 'maxHp', value: 8 }, stacking: 'stack' },
  { id: 'bulwark_repair', deck: 'bulwark', effect: { hook: 'on_surge', stat: 'heal', value: 2 }, stacking: 'stack' },
  { id: 'bulwark_guard', deck: 'bulwark', effect: { hook: 'passive', stat: 'contactDamageTakenMul', value: -0.06 }, stacking: 'stack' },
  { id: 'bulwark_battery', deck: 'bulwark', effect: { hook: 'on_hit', stat: 'shield', value: 1 }, stacking: 'stack' },
  { id: 'bulwark_anchor', deck: 'bulwark', effect: { hook: 'on_surge', stat: 'surgeDamageMul', value: 0.1 }, stacking: 'stack' },
  { id: 'bulwark_pulse', deck: 'bulwark', effect: { hook: 'on_hit', stat: 'pulseDamage', value: 10 }, stacking: 'unique' },
  { id: 'bulwark_core', deck: 'bulwark', effect: { hook: 'passive', stat: 'reviveHp', value: 30 }, stacking: 'unique' },
  { id: 'bulwark_rebuke', deck: 'bulwark', effect: { hook: 'on_surge', stat: 'reflectWindowMs', value: 180 }, stacking: 'unique' },
  { id: 'tempest_velocity', deck: 'tempest', effect: { hook: 'passive', stat: 'moveSpeedMul', value: 0.04 }, stacking: 'stack' },
  { id: 'tempest_overdrive', deck: 'tempest', effect: { hook: 'passive', stat: 'fireRateMul', value: 0.05 }, stacking: 'stack' },
  { id: 'tempest_spike', deck: 'tempest', effect: { hook: 'on_kill', stat: 'chainBonus', value: 2 }, stacking: 'stack' },
  { id: 'tempest_flash', deck: 'tempest', effect: { hook: 'passive', stat: 'surgeCooldownMul', value: -0.05 }, stacking: 'stack' },
  { id: 'tempest_split', deck: 'tempest', effect: { hook: 'passive', stat: 'splitShotEvery', value: 6 }, stacking: 'unique' },
  { id: 'tempest_storm', deck: 'tempest', effect: { hook: 'on_kill', stat: 'shockRingDamage', value: 12 }, stacking: 'stack' },
  { id: 'tempest_hunt', deck: 'tempest', effect: { hook: 'passive', stat: 'bossDamageMul', value: 0.2 }, stacking: 'stack' },
  { id: 'tempest_relay', deck: 'tempest', effect: { hook: 'on_surge', stat: 'resetFireCooldown', value: 1 }, stacking: 'unique' },
];

const BOSS_SPECS: Record<1 | 2, BossSpec> = {
  1: wardenGen1 as unknown as BossSpec,
  2: wardenGen2 as unknown as BossSpec,
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
    boss: null,
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
    },
    enemies: [],
    projectiles: [],
    pickups: [],
    xp: 0,
    pendingUpgrades: [],
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
    life: 90,
    owner,
  });
}

function placeEnemyOffscreen(state: WorldState, type: EnemyType): EnemyState {
  const rng = createRng(`${state.seed}:${state.wave}:${state.tick}`, 'spawn');
  const side = rng.nextInt(0, 3);
  const margin = 80;
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = -margin;
    y = rng.nextInt(0, ARENA_HEIGHT);
  } else if (side === 1) {
    x = ARENA_WIDTH + margin;
    y = rng.nextInt(0, ARENA_HEIGHT);
  } else if (side === 2) {
    x = rng.nextInt(0, ARENA_WIDTH);
    y = -margin;
  } else {
    x = rng.nextInt(0, ARENA_WIDTH);
    y = ARENA_HEIGHT + margin;
  }

  const def = enemyDefinitions[type];
  return {
    id: state.tick * 100 + state.enemies.length + 1,
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
  };
}

function waveThreatBudget(waveNumber: number): number {
  return clamp(2 + waveNumber * 4, 6, 34);
}

function spawnWave(state: WorldState, waveNumber: number): void {
  const budget = waveThreatBudget(waveNumber);
  const plan = planWaveSpawns(
    budget,
    [
      { x: -80, y: 120 },
      { x: 1360, y: 220 },
      { x: 420, y: -80 },
      { x: 960, y: 800 },
    ],
    { x: state.player.x, y: state.player.y },
  );

  for (const entry of plan) {
    if (state.enemies.length >= MAX_ENEMIES) break;
    const enemy = placeEnemyOffscreen(state, entry.type);
    enemy.x = entry.point.x;
    enemy.y = entry.point.y;
    state.enemies.push(enemy);
  }
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

function addKillScore(state: WorldState, baseScore: number): void {
  state.score += (baseScore + state.cardEffects.chainBonus) * state.chain.multiplier;
}

function drawDeckCard(state: WorldState): CardSpec | null {
  const deckCards = CARD_POOL.filter((card) => card.deck === state.player.deck);
  if (deckCards.length === 0) return null;

  for (let offset = 0; offset < deckCards.length; offset += 1) {
    const card = deckCards[(state.cardsOwned.length + offset) % deckCards.length];
    if (card.stacking === 'unique' && state.cardsOwned.includes(card.id)) {
      continue;
    }
    return card;
  }

  return null;
}

function applyCard(state: WorldState, card: CardSpec): void {
  state.cardsOwned.push(card.id);

  const effect = card.effect;
  if (effect.hook === 'passive' && effect.stat === 'moveSpeedMul') state.cardEffects.moveSpeedMul += effect.value;
  if (effect.hook === 'passive' && effect.stat === 'fireRateMul') state.cardEffects.fireRateMul += effect.value;
  if (effect.hook === 'passive' && effect.stat === 'surgeCooldownMul') state.cardEffects.surgeCooldownMul += effect.value;
  if (effect.hook === 'passive' && effect.stat === 'bossDamageMul') state.cardEffects.bossDamageMul += effect.value;
  if (effect.hook === 'passive' && effect.stat === 'contactDamageTakenMul') state.cardEffects.contactDamageTakenMul += effect.value;
  if (effect.hook === 'passive' && effect.stat === 'maxHp') {
    state.player.maxHp += effect.value;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + effect.value);
  }
  if (effect.hook === 'passive' && effect.stat === 'reviveHp') {
    state.cardEffects.reviveHp = Math.max(state.cardEffects.reviveHp, effect.value);
  }
  if (effect.hook === 'on_surge' && effect.stat === 'heal') state.cardEffects.healOnSurge += effect.value;
  if (effect.hook === 'on_surge' && effect.stat === 'surgeDamageMul') state.cardEffects.surgeDamageMul += effect.value;
  if (effect.hook === 'on_surge' && effect.stat === 'resetFireCooldown') state.cardEffects.resetFireCooldown = effect.value > 0;
  if (effect.hook === 'on_kill' && effect.stat === 'chainBonus') state.cardEffects.chainBonus += effect.value;
  if (effect.hook === 'on_kill' && effect.stat === 'shockRingDamage') state.cardEffects.shockRingDamage += effect.value;
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

function launchBoss(state: WorldState): void {
  const generation = bossGenerationForRun(state.difficulty, state.wave);
  const spec = BOSS_SPECS[generation];
  const hpScale = 1
    + Math.max(0, state.wave - 5) * 0.12
    + (state.difficulty === 'hard' ? 0.1 : 0);
  const runtime = createBossRuntime(spec, {
    x: ARENA_WIDTH / 2,
    y: 210,
    hpScale,
  });
  state.boss = { active: true, ...runtime };
}

function createUpgradeChoices(): UpgradeId[] {
  const pool: UpgradeId[] = ['speed', 'fire', 'shield', 'surge'];
  const choices: UpgradeId[] = [];
  for (let index = 0; index < 3; index += 1) {
    choices.push(pool[(index * 2 + 1) % pool.length]);
  }
  return choices;
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
  const state = createInitialState(seed, difficulty, layouts);

  const applyUpgrade = (id: UpgradeId): void => {
    const player = state.player;

    if (id === 'speed') {
      player.moveSpeed += 20;
    }
    if (id === 'fire') {
      player.shotRate += 1.25;
      player.projectileDamage += 6;
    }
    if (id === 'shield') {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      player.shield += 1;
    }
    if (id === 'surge') {
      player.surgeDamage += 12;
      player.surgeDistance += 25;
      player.surgeCooldown = Math.max(0, player.surgeCooldown - 20);
    }

    state.pendingUpgrades = [];
    state.xp = Math.max(0, state.xp - 12);
  };

  const step = (input: InputFrame): SimEvent[] => {
    const events: SimEvent[] = [];
    if (state.status !== 'playing') {
      return events;
    }

    state.tick += 1;
    state.waveTimer += TICK_MS;
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
    const moveSpeed = player.moveSpeed * (player.deck === 'tempest' ? 1.05 : 1) * (1 + state.cardEffects.moveSpeedMul);
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
        const hitDistance = distanceSquared(player.x, player.y, enemy.x, enemy.y);
        if (hitDistance <= (player.radius + enemy.radius + 26) ** 2) {
          enemy.hp -= surgeDamage;
          if (enemy.hp <= 0) {
            state.chain = onKill(state.chain);
            addKillScore(state, 20);
            state.killCount += 1;
            state.xp += 10;
            surgeKillCount += 1;
            spawnXpPickup(state, enemy.x, enemy.y);
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
      spawnProjectile(state, player.x + aimX * 18, player.y + aimY * 18, aimX, aimY, player.projectileSpeed, player.projectileDamage, 'player', 4);
      player.fireCooldown = 1000 / (player.shotRate * (1 + state.cardEffects.fireRateMul));
      player.fireBufferMs = 0;
    }

    const spawnEveryMs = 1000 * (1 / (state.wave * 0.55 + 1.2)) * (1 / difficultyConfig[state.difficulty].spawnRate);
    if (state.enemies.length === 0 && state.boss === null && state.waveTimer > spawnEveryMs * 1.4) {
      if (state.wave >= 5) {
        launchBoss(state);
        state.waveTimer = 0;
      } else {
        spawnWave(state, state.wave);
        state.wave += 1;
        state.waveTimer = 0;
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
      const bossStep = stepBossRuntime(state.boss, BOSS_SPECS[state.boss.generation], {
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
          state.boss.active = false;
          state.status = 'won';
          events.push({ type: 'run_ended', tick: state.tick, x: state.boss.x, y: state.boss.y, data: { outcome: 'victory' } });
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
              state.enemies.splice(enemyIndex, 1);
              events.push({ type: 'enemy_died', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
              emitShockRing(state, enemy.x, enemy.y, events);
              if (enemy.kind === 'splitter') {
                for (let split = 0; split < 2; split += 1) {
                  const child = placeEnemyOffscreen(state, 'drone');
                    if (state.enemies.length < MAX_ENEMIES) {
                      state.enemies.push(child);
                    }
                }
              }
              if (state.xp >= 24 && state.pendingUpgrades.length === 0) {
                state.pendingUpgrades = createUpgradeChoices();
                const card = drawDeckCard(state);
                if (card) {
                  applyCard(state, card);
                }
                events.push({ type: 'card_offered', tick: state.tick, data: { count: state.pendingUpgrades.length, card: card?.id ?? '' } });
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
      enemy.x += behaviour.vx * (TICK_MS / 1000);
      enemy.y += behaviour.vy * (TICK_MS / 1000);
      const enemyPosition = resolveArenaPosition(
        arenaPolygon,
        enemy.x - behaviour.vx * (TICK_MS / 1000),
        enemy.y - behaviour.vy * (TICK_MS / 1000),
        enemy.x,
        enemy.y,
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

    if ((state.status === 'playing' && player.hp <= 0) || state.status === 'won') {
      state.status = state.status === 'won' ? 'won' : 'lost';
    }

    if (state.pendingUpgrades.length === 0 && state.xp >= 24) {
      state.pendingUpgrades = createUpgradeChoices();
      const card = drawDeckCard(state);
      if (card) {
        applyCard(state, card);
      }
      events.push({ type: 'card_offered', tick: state.tick, data: { count: state.pendingUpgrades.length, card: card?.id ?? '' } });
    }

    if (state.pickups.length > 0) {
      for (let pickupIndex = state.pickups.length - 1; pickupIndex >= 0; pickupIndex -= 1) {
        const pickup = state.pickups[pickupIndex];
        pickup.lifeMs -= TICK_MS;
        const magnetRadius = player.deck === 'bulwark' ? 90 : 110;
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

    if (state.tick % 120 === 0 && state.boss === null && state.enemies.length === 0 && (state.wave - 1) >= 5) {
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
