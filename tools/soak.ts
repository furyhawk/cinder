import { createInputFrame, createWorld } from '../src/sim/world';

interface SoakConfig {
  ticks: number;
  entities: number;
  seed: string;
}

function parseNumberArg(name: string, fallback: number): number {
  const prefixed = `--${name}=`;
  const fromEquals = process.argv.find((arg) => arg.startsWith(prefixed));
  if (fromEquals) {
    const value = Number(fromEquals.slice(prefixed.length));
    return Number.isFinite(value) ? value : fallback;
  }

  const flagIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (flagIndex >= 0) {
    const next = Number(process.argv[flagIndex + 1]);
    return Number.isFinite(next) ? next : fallback;
  }

  return fallback;
}

function parseStringArg(name: string, fallback: string): string {
  const prefixed = `--${name}=`;
  const fromEquals = process.argv.find((arg) => arg.startsWith(prefixed));
  if (fromEquals) {
    return fromEquals.slice(prefixed.length) || fallback;
  }

  const flagIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (flagIndex >= 0) {
    return process.argv[flagIndex + 1] || fallback;
  }

  return fallback;
}

function buildConfig(): SoakConfig {
  return {
    ticks: Math.max(1, parseNumberArg('ticks', 10000)),
    entities: Math.max(1, parseNumberArg('entities', 900)),
    seed: parseStringArg('seed', 'soak-seed'),
  };
}

function buildInput(tick: number) {
  const phase = tick / 60;
  return createInputFrame(tick, {
    moveX: Math.sin(phase),
    moveY: Math.cos(phase * 0.8),
    aimX: Math.cos(phase * 1.4),
    aimY: Math.sin(phase * 1.1),
    fire: tick % 2 === 0,
    surge: tick % 120 === 0,
  });
}

function assertFinite(world: ReturnType<typeof createWorld>): void {
  const player = world.state.player;
  const finiteValues = [player.x, player.y, player.hp, world.state.xp, world.state.score];
  if (finiteValues.some((value) => !Number.isFinite(value))) {
    throw new Error('NaN or infinite value detected in player or score state.');
  }
}

export function runSoak(config: SoakConfig) {
  const world = createWorld(config.seed, 'normal');

  const startedAt = performance.now();
  let peakEntities = 0;
  let totalEntities = 0;

  for (let tick = 0; tick < config.ticks; tick += 1) {
    const events = world.step(buildInput(tick));
    const entityCount = world.state.enemies.length + world.state.projectiles.length + 1;

    if (entityCount > peakEntities) peakEntities = entityCount;
    totalEntities += entityCount;
    assertFinite(world);

    if (events.some((event) => event.type === 'run_ended')) {
      world.restart();
    }

    if (tick > 0 && tick % 180 === 0) {
      world.restart();
    }
  }

  const elapsedMs = performance.now() - startedAt;
  const msPerTick = elapsedMs / config.ticks;

  return {
    ticks: config.ticks,
    elapsedMs,
    msPerTick,
    peakEntities,
    avgEntities: totalEntities / config.ticks,
  };
}

export function main() {
  const config = buildConfig();
  const result = runSoak(config);
  console.log(
    JSON.stringify(
      {
        type: 'soak_result',
        ticks: result.ticks,
        elapsedMs: Number(result.elapsedMs.toFixed(3)),
        msPerTick: Number(result.msPerTick.toFixed(6)),
        peakEntities: result.peakEntities,
        avgEntities: Number(result.avgEntities.toFixed(2)),
      },
      null,
      2,
    ),
  );
}

main();
