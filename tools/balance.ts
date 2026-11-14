import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInputFrame, createWorld, type Difficulty } from '../src/sim/world';

const OUTPUT_PATH = join(process.cwd(), 'docs', 'balance.csv');

function parseNumberArg(name: string, fallback: number): number {
  const prefixed = `--${name}=`;
  const fromEquals = process.argv.find((arg) => arg.startsWith(prefixed));
  if (fromEquals) {
    const value = Number(fromEquals.slice(prefixed.length));
    return Number.isFinite(value) ? value : fallback;
  }

  const idx = process.argv.findIndex((arg) => arg === `--${name}`);
  if (idx >= 0) {
    const value = Number(process.argv[idx + 1]);
    return Number.isFinite(value) ? value : fallback;
  }

  return fallback;
}

function runSingle(seed: string, difficulty: Difficulty, maxTicks: number) {
  const world = createWorld(seed, difficulty);
  const startedAtTick = world.state.tick;
  const maxEntities = 900;
  let endReason: 'completed' | 'entity_cap' | 'run_ended' = 'completed';

  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (world.state.enemies.length + world.state.projectiles.length + 1 > maxEntities) {
      endReason = 'entity_cap';
      break;
    }

    const phase = tick / 45;
    const input = createInputFrame(tick, {
      moveX: Math.sin(phase),
      moveY: Math.cos(phase * 0.7),
      aimX: Math.cos(phase * 1.3),
      aimY: Math.sin(phase * 1.1),
      fire: true,
      surge: tick % 100 === 0,
    });
    world.step(input);
    if (world.state.status !== 'playing') {
      endReason = 'run_ended';
      break;
    }
  }

  return {
    difficulty,
    outcome: world.state.status,
    endReason,
    durationTicks: world.state.tick - startedAtTick,
    score: world.state.score,
    kills: world.state.killCount,
    wave: world.state.wave,
  };
}

export function main() {
  const runsPerDifficulty = Math.max(1, parseNumberArg('runs', 8));
  const maxTicks = Math.max(1, parseNumberArg('maxTicks', 60 * 8 * 60));
  const rows = ['difficulty,outcome,end_reason,duration_ticks,score,kills,wave'];
  const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
  let run = 0;

  for (const difficulty of difficulties) {
    for (let index = 0; index < runsPerDifficulty; index += 1) {
      const result = runSingle(`balance-${difficulty}-${index}`, difficulty, maxTicks);
      rows.push(
        [
          result.difficulty,
          result.outcome,
          result.endReason,
          result.durationTicks,
          result.score,
          result.kills,
          result.wave,
        ].join(','),
      );
      run += 1;
    }
  }

  mkdirSync(join(process.cwd(), 'docs'), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${rows.join('\n')}\n`, 'utf8');
  console.log(
    JSON.stringify(
      {
        type: 'balance_result',
        runs: run,
        runsPerDifficulty,
        maxTicks,
        output: OUTPUT_PATH,
      },
      null,
      2,
    ),
  );
}

main();
