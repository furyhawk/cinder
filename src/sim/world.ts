import { createRng } from './rng';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type UpgradeId = 'speed' | 'fire' | 'shield' | 'surge';
export type EnemyType = 'drone' | 'runner' | 'turret' | 'spinner' | 'charger' | 'splitter';

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
  type: 'enemy_hit' | 'enemy_died' | 'player_hit' | 'surge_used' | 'pickup' | 'boss_phase' | 'run_ended' | 'card_offered';
  tick: number;
  x?: number;
  y?: number;
  data?: Record<string, number | string>;
}

export interface PlayerState {
  x: number;
  y: number;
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
  deck: 'bulwark' | 'tempest';
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

export interface BossState {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  pattern: number;
  phase: number;
  cooldown: number;
  telegraph: number;
}

export interface PickupState {
  id: number;
  x: number;
  y: number;
  value: number;
  radius: number;
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
}

export interface World {
  state: WorldState;
  step(input: InputFrame): SimEvent[];
  hash(): string;
  applyUpgrade(id: UpgradeId): void;
  setDeck(deck: 'bulwark' | 'tempest'): void;
  restart(): void;
}

const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 720;
const TICK_MS = 1000 / 60;

const difficultyConfig: Record<Difficulty, { hp: number; spawnRate: number; enemyMod: number }> = {
  easy: { hp: 1.1, spawnRate: 1.1, enemyMod: 0.9 },
  normal: { hp: 1, spawnRate: 1, enemyMod: 1 },
  hard: { hp: 1.2, spawnRate: 1.2, enemyMod: 1.2 },
};

const enemyDefinitions: Record<EnemyType, { radius: number; hp: number; speed: number; damage: number; fireRate: number }> = {
  drone: { radius: 12, hp: 18, speed: 120, damage: 12, fireRate: 0 },
  runner: { radius: 11, hp: 15, speed: 200, damage: 10, fireRate: 0 },
  turret: { radius: 14, hp: 24, speed: 0, damage: 10, fireRate: 1.25 },
  spinner: { radius: 15, hp: 32, speed: 90, damage: 14, fireRate: 1.6 },
  charger: { radius: 16, hp: 28, speed: 110, damage: 18, fireRate: 0 },
  splitter: { radius: 18, hp: 26, speed: 100, damage: 12, fireRate: 0 },
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

function createInitialState(seed: string, difficulty: Difficulty): WorldState {
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
    },
    enemies: [],
    projectiles: [],
    pickups: [],
    xp: 0,
    pendingUpgrades: [],
    killCount: 0,
    score: 0,
    rng: 0,
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

function chooseEnemySpawn(state: WorldState): EnemyType {
  const roll = state.rng % 100;
  state.rng = (state.rng + 1) % 1000000;

  if (roll < 24) return 'drone';
  if (roll < 40) return 'runner';
  if (roll < 58) return 'turret';
  if (roll < 72) return 'spinner';
  if (roll < 86) return 'charger';
  return 'splitter';
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

function spawnWave(state: WorldState, waveNumber: number): void {
  const baseCount = clamp(3 + waveNumber * 2, 3, 18);

  for (let index = 0; index < baseCount; index += 1) {
    const type = chooseEnemySpawn(state);
    state.enemies.push(placeEnemyOffscreen(state, type));
  }
}

function launchBoss(state: WorldState): void {
  const health = 240 + state.wave * 26;
  state.boss = {
    active: true,
    x: ARENA_WIDTH / 2,
    y: 180,
    radius: 58,
    hp: health,
    maxHp: health,
    pattern: 0,
    phase: 1,
    cooldown: 0,
    telegraph: 0,
  };
}

function createUpgradeChoices(): UpgradeId[] {
  const pool: UpgradeId[] = ['speed', 'fire', 'shield', 'surge'];
  const choices: UpgradeId[] = [];
  for (let index = 0; index < 3; index += 1) {
    choices.push(pool[(index * 2 + 1) % pool.length]);
  }
  return choices;
}

export function createWorld(seed = 'cinder', difficulty: Difficulty = 'normal'): World {
  const state = createInitialState(seed, difficulty);

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

    const player = state.player;
    player.fireCooldown = Math.max(0, player.fireCooldown - TICK_MS);
    player.invuln = Math.max(0, player.invuln - TICK_MS);
    player.surgeCooldown = Math.max(0, player.surgeCooldown - TICK_MS);
    player.surgeTimer = Math.max(0, player.surgeTimer - TICK_MS);

    const moveX = clamp(input.moveX, -1, 1);
    const moveY = clamp(input.moveY, -1, 1);
    const moveVector = normalize(moveX, moveY);
    const moveSpeed = player.moveSpeed * (player.deck === 'tempest' ? 1.05 : 1);
    player.x = clamp(player.x + moveVector.x * moveSpeed * (1 / 60), 16, ARENA_WIDTH - 16);
    player.y = clamp(player.y + moveVector.y * moveSpeed * (1 / 60), 16, ARENA_HEIGHT - 16);

    if (input.aimX !== 0 || input.aimY !== 0) {
      const target = normalize(input.aimX, input.aimY);
      player.aimX = target.x;
      player.aimY = target.y;
    }

    if (input.surge && player.surgeCooldown <= 0) {
      player.surgeTimer = 140;
      player.surgeCooldown = 420;
      player.invuln = 140;
      events.push({ type: 'surge_used', tick: state.tick, x: player.x, y: player.y, data: { damage: player.surgeDamage } });

      for (let index = 0; index < state.enemies.length; index += 1) {
        const enemy = state.enemies[index];
        const hitDistance = distanceSquared(player.x, player.y, enemy.x, enemy.y);
        if (hitDistance <= (player.radius + enemy.radius + 26) ** 2) {
          enemy.hp -= player.surgeDamage;
          if (enemy.hp <= 0) {
            state.score += 20;
            state.killCount += 1;
            state.xp += 10;
            state.enemies.splice(index, 1);
            events.push({ type: 'enemy_died', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
            index -= 1;
          }
        }
      }
    }

    if (input.fire && player.fireCooldown <= 0) {
      const aimX = player.aimX || 1;
      const aimY = player.aimY || 0;
      spawnProjectile(state, player.x + aimX * 18, player.y + aimY * 18, aimX, aimY, player.projectileSpeed, player.projectileDamage, 'player', 4);
      player.fireCooldown = 1000 / player.shotRate;
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

    if (state.boss && state.boss.active) {
      const boss = state.boss;
      boss.cooldown -= TICK_MS;
      if (boss.cooldown <= 0) {
        const pattern = boss.pattern % 3;
        if (pattern === 0) {
          for (let ring = 0; ring < 12; ring += 1) {
            const angle = (Math.PI * 2 * ring) / 12 + state.tick * 0.05;
            spawnProjectile(state, boss.x, boss.y, Math.cos(angle), Math.sin(angle), 180, 14, 'boss', 5);
          }
        } else if (pattern === 1) {
          for (let shot = -2; shot <= 2; shot += 1) {
            const angle = Math.atan2(player.y - boss.y, player.x - boss.x) + shot * 0.22;
            spawnProjectile(state, boss.x, boss.y, Math.cos(angle), Math.sin(angle), 220, 16, 'boss', 5);
          }
        } else {
          const aim = normalize(player.x - boss.x, player.y - boss.y);
          spawnProjectile(state, boss.x, boss.y, aim.x, aim.y, 240, 18, 'boss', 6);
        }
        boss.cooldown = 1200;
        boss.pattern += 1;
      }

      boss.x += Math.sin(state.tick * 0.03) * 0.5;
      boss.y = 170 + Math.cos(state.tick * 0.02) * 18;
      if (boss.hp <= boss.maxHp * 0.5) {
        boss.phase = 2;
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
        state.boss.hp -= projectile.damage;
        state.projectiles.splice(index, 1);
        if (state.boss.hp <= 0) {
          state.boss.active = false;
          state.status = 'won';
          events.push({ type: 'run_ended', tick: state.tick, x: state.boss.x, y: state.boss.y, data: { outcome: 'victory' } });
        }
        index -= 1;
        continue;
      }

      for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
        const enemy = state.enemies[enemyIndex];
        if (
          projectile.owner === 'player' &&
          distanceSquared(projectile.x, projectile.y, enemy.x, enemy.y) <= (projectile.radius + enemy.radius) ** 2
        ) {
          enemy.hp -= projectile.damage;
          state.projectiles.splice(index, 1);
          events.push({ type: 'enemy_hit', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
          if (enemy.hp <= 0) {
            state.score += 40;
            state.killCount += 1;
            state.xp += 12;
            state.enemies.splice(enemyIndex, 1);
            events.push({ type: 'enemy_died', tick: state.tick, x: enemy.x, y: enemy.y, data: { kind: enemy.kind } });
            if (enemy.kind === 'splitter') {
              for (let split = 0; split < 2; split += 1) {
                const child = placeEnemyOffscreen(state, 'drone');
                state.enemies.push(child);
              }
            }
            if (state.xp >= 24 && state.pendingUpgrades.length === 0) {
              state.pendingUpgrades = createUpgradeChoices();
            }
          }
          index -= 1;
          break;
        }

        if (
          projectile.owner === 'enemy' &&
          distanceSquared(projectile.x, projectile.y, player.x, player.y) <= (projectile.radius + player.radius) ** 2
        ) {
          player.hp -= projectile.damage;
          player.invuln = 80;
          state.projectiles.splice(index, 1);
          events.push({ type: 'player_hit', tick: state.tick, x: player.x, y: player.y, data: { hp: player.hp } });
          if (player.hp <= 0) {
            state.status = 'lost';
            events.push({ type: 'run_ended', tick: state.tick, x: player.x, y: player.y, data: { outcome: 'defeat' } });
          }
          index -= 1;
          break;
        }
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

      if (enemy.kind === 'drone' || enemy.kind === 'runner') {
        enemy.x += (dirX * enemy.speed * (TICK_MS / 1000)) * (enemy.kind === 'runner' ? 1.3 : 1);
        enemy.y += (dirY * enemy.speed * (TICK_MS / 1000)) * (enemy.kind === 'runner' ? 1.3 : 1);
      }

      if (enemy.kind === 'spinner') {
        enemy.x += Math.cos(state.tick * 0.05 + enemy.seed) * 1.5;
        enemy.y += Math.sin(state.tick * 0.05 + enemy.seed) * 1.5;
      }

      if (enemy.kind === 'turret') {
        enemy.fireCooldown -= TICK_MS;
        if (enemy.fireCooldown <= 0 && distance < 460) {
          const shot = normalize(player.x - enemy.x, player.y - enemy.y);
          spawnProjectile(state, enemy.x, enemy.y, shot.x, shot.y, 220, 10, 'enemy', 4);
          enemy.fireCooldown = 1000 / enemyDefinitions.turret.fireRate;
        }
      }

      if (enemy.kind === 'charger') {
        if (distance < 220) {
          enemy.x += dirX * enemy.speed * 1.5 * (TICK_MS / 1000);
          enemy.y += dirY * enemy.speed * 1.5 * (TICK_MS / 1000);
        }
      }

      if (distance < (enemy.radius + player.radius + 2)) {
        player.hp -= enemy.contactDamage;
        player.invuln = 100;
        events.push({ type: 'player_hit', tick: state.tick, x: player.x, y: player.y, data: { hp: player.hp } });
        if (player.hp <= 0) {
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
    }

    if (state.boss && state.boss.active && state.boss.hp <= 0) {
      state.boss.active = false;
      state.status = 'won';
      events.push({ type: 'run_ended', tick: state.tick, x: state.boss.x, y: state.boss.y, data: { outcome: 'victory' } });
    }

    if (state.pickups.length > 0) {
      for (let pickupIndex = state.pickups.length - 1; pickupIndex >= 0; pickupIndex -= 1) {
        const pickup = state.pickups[pickupIndex];
        const pickDistance = distanceSquared(player.x, player.y, pickup.x, pickup.y);
        if (pickDistance <= (player.radius + pickup.radius) ** 2) {
          state.xp += pickup.value;
          state.pickups.splice(pickupIndex, 1);
          events.push({ type: 'pickup', tick: state.tick, x: pickup.x, y: pickup.y, data: { value: pickup.value } });
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
    const fresh = createInitialState(nextSeed, difficulty);
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
